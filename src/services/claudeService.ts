/**
 * Claude AI Service Integration
 * 
 * Provides AI-powered assistance by integrating with Anthropic's Claude API.
 * Handles request processing, response validation, rate limiting, and error recovery.
 */

import {
  AIRequest,
  AIResponse,
  TaskType,
  OutputFormat,
  SecurityConstraints,
  WebsiteContext,
  ValidationUtils
} from '../types/index.js';
import { securityManager, SecurityWarning } from './securityManager.js';
import { CacheService } from './cacheService.js';
import { PerformanceMonitor } from './performanceMonitor.js';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export interface ClaudeServiceConfig {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  timeout?: number;
  maxRetries?: number;
  rateLimitRpm?: number; // requests per minute
}

export interface ClaudeMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ClaudeRequest {
  model: string;
  max_tokens: number;
  temperature: number;
  messages: ClaudeMessage[];
}

export interface ClaudeResponse {
  id: string;
  type: string;
  role: string;
  content: Array<{
    type: string;
    text: string;
  }>;
  model: string;
  stop_reason: string;
  stop_sequence: null | string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export class ClaudeError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'ClaudeError';
  }
}

// ============================================================================
// CLAUDE SERVICE IMPLEMENTATION
// ============================================================================

/**
 * Available Claude models with their configurations
 */
export const AVAILABLE_CLAUDE_MODELS = {
  'claude-3-5-sonnet-20241022': { maxTokens: 200000, name: 'Claude 3.5 Sonnet (Latest)' },
  'claude-3-5-haiku-20241022': { maxTokens: 200000, name: 'Claude 3.5 Haiku (Fast)' },
  'claude-3-opus-20240229': { maxTokens: 200000, name: 'Claude 3 Opus (Most Capable)' },
  'claude-3-sonnet-20240229': { maxTokens: 200000, name: 'Claude 3 Sonnet (Balanced)' },
  'claude-3-haiku-20240307': { maxTokens: 200000, name: 'Claude 3 Haiku (Fast)' }
} as const;

export class ClaudeService {
  private config: Required<ClaudeServiceConfig>;
  private cacheService?: CacheService;
  private performanceMonitor?: PerformanceMonitor;

  constructor(config: ClaudeServiceConfig) {
    this.config = {
      baseUrl: 'https://api.anthropic.com/v1',
      model: 'claude-3-5-sonnet-20241022',
      maxTokens: 8000,
      temperature: 0.7,
      timeout: 30000,
      maxRetries: 3,
      rateLimitRpm: 60,
      ...config
    };
  }

  /**
   * Sets the cache service for response caching
   */
  setCacheService(cacheService: CacheService): void {
    this.cacheService = cacheService;
  }

  /**
   * Sets the performance monitor for tracking metrics
   */
  setPerformanceMonitor(performanceMonitor: PerformanceMonitor): void {
    this.performanceMonitor = performanceMonitor;
  }

  /**
   * Process an AI request with Claude API
   */
  async processRequest(request: AIRequest): Promise<AIResponse> {
    let operationId = '';
    
    if (this.performanceMonitor) {
      operationId = this.performanceMonitor.startOperation('claude-request', {
        taskType: request.taskType,
        outputFormat: request.outputFormat,
        domain: request.context.domain
      });
    }

    try {
      // Validate request
      if (!ValidationUtils.validateAIRequest(request)) {
        throw new ClaudeError('Invalid AI request format', 'INVALID_REQUEST');
      }

      // Check cache first
      if (this.cacheService) {
        const cacheKey = this.cacheService.generateAIRequestKey(request, {
          includeUserContext: true,
          includeTimestamp: false
        });
        
        const cachedResponse = await this.cacheService.getCachedAIResponse(cacheKey);
        if (cachedResponse) {
          if (this.performanceMonitor) {
            this.performanceMonitor.endOperation(operationId, true);
          }
          return cachedResponse;
        }
      }

      // Generate security warnings
      const warnings = securityManager.generateSecurityWarnings(request.context, request);
      
      // Check if request should be blocked due to security concerns
      const errorWarning = warnings.find(w => w.level === 'error');
      if (errorWarning) {
        throw new ClaudeError(errorWarning.message, errorWarning.code);
      }

      // Sanitize request content for security
      const sanitizedRequest = this.sanitizeRequest(request);

      // Execute request
      const response = await this.executeRequest(sanitizedRequest);

      // Add security warnings to response metadata if any
      if (warnings.length > 0) {
        (response as any).securityWarnings = warnings;
      }

      // Cache the response
      if (this.cacheService) {
        const cacheKey = this.cacheService.generateAIRequestKey(request, {
          includeUserContext: true,
          includeTimestamp: false
        });
        await this.cacheService.cacheAIResponse(cacheKey, response);
      }

      if (this.performanceMonitor) {
        this.performanceMonitor.endOperation(operationId, true);
      }

      return response;

    } catch (error) {
      if (this.performanceMonitor) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.performanceMonitor.endOperation(operationId, false, errorMessage);
      }
      throw error;
    }
  }

  /**
   * Execute individual Claude request with retry logic
   */
  private async executeRequest(request: AIRequest): Promise<AIResponse> {
    const prompt = this.buildPrompt(request);
    const apiRequest = this.buildClaudeRequest(prompt, request);

    return this.retryWithBackoff(async () => {
      const response = await this.makeClaudeAPICall(apiRequest);
      return this.parseClaudeResponse(response, request);
    });
  }

  /**
   * Build prompt from AI request
   */
  private buildPrompt(request: AIRequest): string {
    const { context, taskType, prompt, userInput } = request;
    
    let systemPrompt = this.getSystemPrompt(taskType, request.outputFormat);
    let contextPrompt = this.buildContextPrompt(context);
    let userPrompt = prompt;

    // Add user input if provided
    if (userInput && Object.keys(userInput).length > 0) {
      const inputStr = Object.entries(userInput)
        .map(([key, value]) => `${key}: ${value}`)
        .join('\n');
      userPrompt += `\n\nAdditional Input:\n${inputStr}`;
    }

    return `${systemPrompt}\n\n${contextPrompt}\n\n${userPrompt}`;
  }

  /**
   * Get system prompt based on task type
   */
  private getSystemPrompt(taskType: TaskType, outputFormat: OutputFormat): string {
    const basePrompt = "You are Claude, an AI assistant helping users with web-based tasks. ";
    
    const taskPrompts = {
      [TaskType.GENERATE_TEXT]: "Generate helpful, relevant text content based on the user's request and website context.",
      [TaskType.ANALYZE_CONTENT]: "Analyze the provided website content and provide insights, summaries, or explanations.",
      [TaskType.AUTOMATE_ACTION]: "Provide step-by-step instructions for automating web page interactions.",
      [TaskType.EXTRACT_DATA]: "Extract and structure relevant data from the provided website content."
    };

    const formatPrompts = {
      [OutputFormat.PLAIN_TEXT]: "Respond in plain text format.",
      [OutputFormat.HTML]: "Respond in HTML format with appropriate tags.",
      [OutputFormat.MARKDOWN]: "Respond in Markdown format.",
      [OutputFormat.JSON]: "Respond in valid JSON format."
    };

    return basePrompt + taskPrompts[taskType] + " " + formatPrompts[outputFormat];
  }

  /**
   * Build context prompt from website context
   */
  private buildContextPrompt(context: WebsiteContext): string {
    return `Website Context:
- Domain: ${context.domain}
- Category: ${context.category}
- Page Type: ${context.pageType}
- Security Level: ${context.securityLevel}
- Extracted Data: ${JSON.stringify(context.extractedData, null, 2)}`;
  }

  /**
   * Build Claude API request payload
   */
  private buildClaudeRequest(prompt: string, request: AIRequest): ClaudeRequest {
    return {
      model: this.config.model,
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    };
  }

  /**
   * Make API call to Claude
   */
  private async makeClaudeAPICall(apiRequest: ClaudeRequest): Promise<ClaudeResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(`${this.config.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(apiRequest),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new ClaudeError(
          `Claude API request failed: ${response.statusText} - ${errorData.error?.message || 'Unknown error'}`,
          'API_ERROR',
          response.status,
          response.status >= 500 || response.status === 429
        );
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof ClaudeError) {
        throw error;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new ClaudeError('Request timeout', 'TIMEOUT', undefined, true);
      }

      throw new ClaudeError(
        `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'NETWORK_ERROR',
        undefined,
        true
      );
    }
  }

  /**
   * Parse Claude API response into AIResponse format
   */
  private parseClaudeResponse(claudeResponse: ClaudeResponse, originalRequest: AIRequest): AIResponse {
    try {
      const content = claudeResponse.content
        .filter(block => block.type === 'text')
        .map(block => block.text)
        .join('\n')
        .trim();
      
      if (!content) {
        throw new ClaudeError('Empty response content', 'EMPTY_RESPONSE');
      }

      const response: AIResponse = {
        content,
        format: originalRequest.outputFormat,
        confidence: 0.9, // Claude typically provides high-quality responses
        timestamp: new Date(),
        requestId: claudeResponse.id
      };

      // Try to extract suggestions if the response contains them
      if (originalRequest.taskType === TaskType.GENERATE_TEXT) {
        response.suggestions = this.extractSuggestions(content);
      }

      // Try to extract automation instructions if applicable
      if (originalRequest.taskType === TaskType.AUTOMATE_ACTION) {
        response.automationInstructions = this.extractAutomationInstructions(content);
      }

      return response;
    } catch (error) {
      throw new ClaudeError(
        `Failed to parse Claude response: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'PARSE_ERROR'
      );
    }
  }

  /**
   * Extract suggestions from response content
   */
  private extractSuggestions(content: string): string[] {
    const suggestions: string[] = [];
    
    // Look for numbered lists or bullet points
    const listRegex = /(?:^\d+\.|^[-*])\s*(.+)$/gm;
    let match;
    
    while ((match = listRegex.exec(content)) !== null) {
      suggestions.push(match[1].trim());
    }
    
    return suggestions.slice(0, 5); // Limit to 5 suggestions
  }

  /**
   * Extract automation instructions from response content
   */
  private extractAutomationInstructions(content: string): any[] {
    const instructions: any[] = [];
    
    // Look for step-by-step instructions
    const stepRegex = /(?:step\s*\d+|^\d+\.)\s*(.+)$/gim;
    let match;
    
    while ((match = stepRegex.exec(content)) !== null) {
      instructions.push({
        type: 'manual',
        description: match[1].trim()
      });
    }
    
    return instructions;
  }

  /**
   * Sanitize request to remove sensitive information
   */
  private sanitizeRequest(request: AIRequest): AIRequest {
    const sanitized = { ...request };
    
    // Use SecurityManager for comprehensive sanitization
    if (securityManager.containsSensitiveData(request.prompt)) {
      const securityLevel = request.context.securityLevel;
      sanitized.prompt = this.applySanitization(request.prompt, securityLevel);
    }
    
    // Sanitize user input
    if (sanitized.userInput) {
      sanitized.userInput = ValidationUtils.sanitizeUserInput(sanitized.userInput);
    }
    
    // Apply security constraints
    const constraints = securityManager.createSecurityConstraints(request.context);
    sanitized.constraints = { ...request.constraints, ...constraints };
    
    // Limit content length based on security constraints
    if (sanitized.prompt.length > sanitized.constraints.maxContentLength) {
      sanitized.prompt = sanitized.prompt.slice(0, sanitized.constraints.maxContentLength) + '... [TRUNCATED FOR SECURITY]';
    }
    
    return sanitized;
  }

  /**
   * Apply sanitization based on security level
   */
  private applySanitization(text: string, securityLevel: any): string {
    let sanitized = text;
    
    // Remove credit card numbers
    sanitized = sanitized.replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[CREDIT_CARD_REDACTED]');
    
    // Remove SSNs
    sanitized = sanitized.replace(/\b\d{3}-?\d{2}-?\d{4}\b/g, '[SSN_REDACTED]');
    
    // Remove phone numbers
    sanitized = sanitized.replace(/\b(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/g, '[PHONE_REDACTED]');
    
    // Remove email addresses (but keep domain for context)
    sanitized = sanitized.replace(/\b[A-Za-z0-9._%+-]+@([A-Za-z0-9.-]+\.[A-Z|a-z]{2,})\b/g, '[EMAIL_REDACTED]@$1');
    
    // Remove API keys and tokens
    sanitized = sanitized.replace(/\b(?:api[_-]?key|token|secret)[_-]?[:=]\s*['""]?[a-zA-Z0-9_-]{16,}['""]?\b/gi, '[API_KEY_REDACTED]');
    
    // Remove passwords
    sanitized = sanitized.replace(/\b(?:password|passwd|pwd)[_-]?[:=]\s*['""]?[^\s'"",]{6,}['""]?\b/gi, '[PASSWORD_REDACTED]');
    
    return sanitized;
  }

  /**
   * Enhanced retry logic with exponential backoff and jitter
   */
  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    maxRetries: number = this.config.maxRetries,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: ClaudeError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = this.handleError(error);

        // Don't retry if error is not retryable
        if (!lastError.retryable) {
          throw lastError;
        }

        // Don't retry if we've reached max attempts
        if (attempt === maxRetries) {
          throw lastError;
        }

        // Calculate delay with exponential backoff and jitter
        const exponentialDelay = baseDelay * Math.pow(2, attempt);
        const jitter = Math.random() * 0.1 * exponentialDelay; // 10% jitter
        const delay = exponentialDelay + jitter;

        await this.sleep(delay);

        console.log(`Retrying Claude request (attempt ${attempt + 1}/${maxRetries}) after ${Math.round(delay)}ms delay`);
      }
    }

    throw lastError!;
  }

  /**
   * Handle and categorize errors with enhanced retry logic
   */
  private handleError(error: unknown): ClaudeError {
    if (error instanceof ClaudeError) {
      return error;
    }

    if (error instanceof Error) {
      // Network errors - retryable
      if (error.message.includes('fetch') || error.message.includes('network')) {
        return new ClaudeError(`Network error: ${error.message}`, 'NETWORK_ERROR', undefined, true);
      }

      // Timeout errors - retryable
      if (error.name === 'AbortError' || error.message.includes('timeout')) {
        return new ClaudeError('Request timeout', 'TIMEOUT', undefined, true);
      }

      // Rate limit errors - retryable with delay
      if (error.message.includes('429') || error.message.includes('rate limit')) {
        return new ClaudeError('Rate limit exceeded', 'RATE_LIMIT', 429, true);
      }

      // Server errors (5xx) - retryable
      if (error.message.includes('500') || error.message.includes('502') || 
          error.message.includes('503') || error.message.includes('504')) {
        return new ClaudeError(`Server error: ${error.message}`, 'SERVER_ERROR', undefined, true);
      }

      // Authentication errors - not retryable
      if (error.message.includes('401') || error.message.includes('unauthorized')) {
        return new ClaudeError('Authentication failed', 'AUTH_ERROR', 401, false);
      }

      // Client errors (4xx except 429) - not retryable
      if (error.message.includes('400') || error.message.includes('403') || error.message.includes('404')) {
        return new ClaudeError(`Client error: ${error.message}`, 'CLIENT_ERROR', undefined, false);
      }

      return new ClaudeError(`Unknown error: ${error.message}`, 'UNKNOWN_ERROR');
    }

    return new ClaudeError('Unknown error occurred', 'UNKNOWN_ERROR');
  }

  /**
   * Sleep utility for delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Update service configuration
   */
  updateConfig(newConfig: Partial<ClaudeServiceConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

// ============================================================================
// FACTORY AND UTILITIES
// ============================================================================

/**
 * Factory function to create Claude service instance
 */
export function createClaudeService(config: ClaudeServiceConfig): ClaudeService {
  return new ClaudeService(config);
}

/**
 * Default configuration for Claude service
 */
export const DEFAULT_CLAUDE_CONFIG: Omit<ClaudeServiceConfig, 'apiKey'> = {
  baseUrl: 'https://api.anthropic.com/v1',
  model: 'claude-3-5-sonnet-20241022',
  maxTokens: 8000,
  temperature: 0.7,
  timeout: 30000,
  maxRetries: 3,
  rateLimitRpm: 60
};

/**
 * Utility to validate Claude service configuration
 */
export function validateClaudeConfig(config: ClaudeServiceConfig): boolean {
  if (!config.apiKey || typeof config.apiKey !== 'string') {
    throw new Error('API key is required and must be a string');
  }

  if (config.baseUrl && typeof config.baseUrl !== 'string') {
    throw new Error('Base URL must be a string');
  }

  if (config.maxTokens !== undefined && (typeof config.maxTokens !== 'number' || config.maxTokens <= 0)) {
    throw new Error('Max tokens must be a positive number');
  }

  if (config.temperature !== undefined && (typeof config.temperature !== 'number' || config.temperature < 0 || config.temperature > 1)) {
    throw new Error('Temperature must be a number between 0 and 1');
  }

  if (config.timeout !== undefined && (typeof config.timeout !== 'number' || config.timeout <= 0)) {
    throw new Error('Timeout must be a positive number');
  }

  if (config.rateLimitRpm !== undefined && (typeof config.rateLimitRpm !== 'number' || config.rateLimitRpm <= 0)) {
    throw new Error('Rate limit RPM must be a positive number');
  }

  return true;
}

export function getClaudeModelMaxTokens(model: string): number {
  return AVAILABLE_CLAUDE_MODELS[model as keyof typeof AVAILABLE_CLAUDE_MODELS]?.maxTokens || 8000;
}