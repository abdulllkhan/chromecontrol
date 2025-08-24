/**
 * AI Agent Integration Service
 * 
 * Provides AI-powered assistance by integrating with external AI services.
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

export interface AIServiceConfig {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  timeout?: number;
  maxRetries?: number;
  rateLimitRpm?: number; // requests per minute
  enableStreaming?: boolean;
}

export interface QueuedRequest {
  id: string;
  request: AIRequest;
  resolve: (response: AIResponse) => void;
  reject: (error: AIError) => void;
  timestamp: Date;
  retryCount: number;
}

export interface RateLimitState {
  requestCount: number;
  windowStart: Date;
  queue: QueuedRequest[];
}

export interface StreamingResponse {
  content: string;
  isComplete: boolean;
  error?: string;
}

export class AIError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'AIError';
  }
}

// ============================================================================
// AI SERVICE IMPLEMENTATION
// ============================================================================

export class AIService {
  private config: Required<AIServiceConfig>;
  private rateLimitState: RateLimitState;
  private requestQueue: QueuedRequest[] = [];
  private isProcessingQueue = false;
  private cacheService?: CacheService;
  private performanceMonitor?: PerformanceMonitor;

  constructor(config: AIServiceConfig) {
    this.config = {
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4',
      maxTokens: 2000,
      temperature: 0.7,
      timeout: 30000,
      maxRetries: 3,
      rateLimitRpm: 60,
      enableStreaming: false,
      ...config
    };

    this.rateLimitState = {
      requestCount: 0,
      windowStart: new Date(),
      queue: []
    };

    // Start queue processing
    this.startQueueProcessor();
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
   * Process an AI request with rate limiting and error handling
   */
  async processRequest(request: AIRequest): Promise<AIResponse> {
    let operationId = '';
    
    if (this.performanceMonitor) {
      operationId = this.performanceMonitor.startOperation('ai-request', {
        taskType: request.taskType,
        outputFormat: request.outputFormat,
        domain: request.context.domain
      });
    }

    try {
      // Validate request
      if (!ValidationUtils.validateAIRequest(request)) {
        throw new AIError('Invalid AI request format', 'INVALID_REQUEST');
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
        throw new AIError(errorWarning.message, errorWarning.code);
      }

      // Sanitize request content for security
      const sanitizedRequest = this.sanitizeRequest(request);

      const response = await new Promise<AIResponse>((resolve, reject) => {
        const queuedRequest: QueuedRequest = {
          id: this.generateRequestId(),
          request: sanitizedRequest,
          resolve: async (response: AIResponse) => {
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

            resolve(response);
          },
          reject,
          timestamp: new Date(),
          retryCount: 0
        };

        this.addToQueue(queuedRequest);
      });

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
   * Process streaming AI request
   */
  async processStreamingRequest(
    request: AIRequest,
    onChunk: (chunk: StreamingResponse) => void
  ): Promise<AIResponse> {
    if (!this.config.enableStreaming) {
      throw new AIError('Streaming not enabled', 'STREAMING_DISABLED');
    }

    const sanitizedRequest = this.sanitizeRequest(request);
    
    try {
      const response = await this.makeStreamingAPICall(sanitizedRequest, onChunk);
      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Validate AI response format and content
   */
  validateResponse(response: AIResponse): boolean {
    try {
      // Check required fields
      if (!response.content || typeof response.content !== 'string') {
        return false;
      }

      if (!response.format || !Object.values(OutputFormat).includes(response.format)) {
        return false;
      }

      if (typeof response.confidence !== 'number' || response.confidence < 0 || response.confidence > 1) {
        return false;
      }

      if (!response.timestamp || !(response.timestamp instanceof Date)) {
        return false;
      }

      if (!response.requestId || typeof response.requestId !== 'string') {
        return false;
      }

      // Validate optional fields
      if (response.suggestions && !Array.isArray(response.suggestions)) {
        return false;
      }

      if (response.automationInstructions && !Array.isArray(response.automationInstructions)) {
        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Update service configuration
   */
  updateConfig(newConfig: Partial<AIServiceConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current rate limit status
   */
  getRateLimitStatus(): { remaining: number; resetTime: Date; queueLength: number } {
    const now = new Date();
    const windowDuration = 60000; // 1 minute
    
    // Reset window if needed
    if (now.getTime() - this.rateLimitState.windowStart.getTime() >= windowDuration) {
      this.rateLimitState.requestCount = 0;
      this.rateLimitState.windowStart = now;
    }

    const remaining = Math.max(0, this.config.rateLimitRpm - this.rateLimitState.requestCount);
    const resetTime = new Date(this.rateLimitState.windowStart.getTime() + windowDuration);

    return {
      remaining,
      resetTime,
      queueLength: this.requestQueue.length
    };
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Add request to processing queue
   */
  private addToQueue(request: QueuedRequest): void {
    this.requestQueue.push(request);
    
    if (!this.isProcessingQueue) {
      this.processQueue();
    }
  }

  /**
   * Start the queue processor
   */
  private startQueueProcessor(): void {
    setInterval(() => {
      if (!this.isProcessingQueue && this.requestQueue.length > 0) {
        this.processQueue();
      }
    }, 1000); // Check every second
  }

  /**
   * Process queued requests with rate limiting
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      while (this.requestQueue.length > 0) {
        const rateLimitStatus = this.getRateLimitStatus();
        
        if (rateLimitStatus.remaining <= 0) {
          // Wait until rate limit resets
          const waitTime = rateLimitStatus.resetTime.getTime() - Date.now();
          if (waitTime > 0) {
            await this.sleep(Math.min(waitTime, 1000)); // Shorter wait for tests
            continue;
          }
        }

        const queuedRequest = this.requestQueue.shift();
        if (!queuedRequest) continue;

        try {
          const response = await this.executeRequest(queuedRequest.request);
          queuedRequest.resolve(response);
          this.rateLimitState.requestCount++;
        } catch (error) {
          const aiError = this.handleError(error);
          
          // Retry logic
          if (aiError.retryable && queuedRequest.retryCount < this.config.maxRetries) {
            queuedRequest.retryCount++;
            queuedRequest.timestamp = new Date();
            this.requestQueue.unshift(queuedRequest); // Add back to front of queue
            await this.sleep(Math.pow(2, queuedRequest.retryCount) * 100); // Shorter backoff for tests
          } else {
            queuedRequest.reject(aiError);
          }
        }
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * Execute individual AI request with retry logic
   */
  private async executeRequest(request: AIRequest): Promise<AIResponse> {
    const prompt = this.buildPrompt(request);
    const apiRequest = this.buildAPIRequest(prompt, request);

    return this.retryWithBackoff(async () => {
      const response = await this.makeAPICall(apiRequest);
      return this.parseAPIResponse(response, request);
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
    const basePrompt = "You are an AI assistant helping users with web-based tasks. ";
    
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
   * Build API request payload
   */
  private buildAPIRequest(prompt: string, request: AIRequest): any {
    return {
      model: this.config.model,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
      stream: false
    };
  }

  /**
   * Make API call to OpenAI
   */
  private async makeAPICall(apiRequest: any): Promise<any> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify(apiRequest),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new AIError(
          `API request failed: ${response.statusText}`,
          'API_ERROR',
          response.status,
          response.status >= 500 || response.status === 429
        );
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof AIError) {
        throw error;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new AIError('Request timeout', 'TIMEOUT', undefined, true);
      }

      throw new AIError(
        `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'NETWORK_ERROR',
        undefined,
        true
      );
    }
  }

  /**
   * Make streaming API call
   */
  private async makeStreamingAPICall(
    request: AIRequest,
    onChunk: (chunk: StreamingResponse) => void
  ): Promise<AIResponse> {
    const prompt = this.buildPrompt(request);
    const apiRequest = { ...this.buildAPIRequest(prompt, request), stream: true };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify(apiRequest),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new AIError(
          `Streaming API request failed: ${response.statusText}`,
          'API_ERROR',
          response.status,
          response.status >= 500 || response.status === 429
        );
      }

      let fullContent = '';
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new AIError('No response body', 'NO_RESPONSE_BODY');
      }

      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n').filter(line => line.trim() !== '');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              
              if (data === '[DONE]') {
                onChunk({ content: fullContent, isComplete: true });
                break;
              }

              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content || '';
                
                if (content) {
                  fullContent += content;
                  onChunk({ content: fullContent, isComplete: false });
                }
              } catch (parseError) {
                // Skip invalid JSON chunks
                continue;
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      // Return final response
      return {
        content: fullContent,
        format: request.outputFormat,
        confidence: 0.8, // Default confidence for streaming
        timestamp: new Date(),
        requestId: this.generateRequestId()
      };

    } catch (error) {
      clearTimeout(timeoutId);
      throw this.handleError(error);
    }
  }

  /**
   * Parse API response into AIResponse format
   */
  private parseAPIResponse(apiResponse: any, originalRequest: AIRequest): AIResponse {
    try {
      const content = apiResponse.choices?.[0]?.message?.content || '';
      
      if (!content) {
        throw new AIError('Empty response content', 'EMPTY_RESPONSE');
      }

      const response: AIResponse = {
        content: content.trim(),
        format: originalRequest.outputFormat,
        confidence: this.calculateConfidence(apiResponse),
        timestamp: new Date(),
        requestId: this.generateRequestId()
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
      throw new AIError(
        `Failed to parse API response: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'PARSE_ERROR'
      );
    }
  }

  /**
   * Calculate confidence score from API response
   */
  private calculateConfidence(apiResponse: any): number {
    // Use logprobs if available, otherwise default confidence
    const logprobs = apiResponse.choices?.[0]?.logprobs;
    if (logprobs && logprobs.content) {
      // Calculate average probability
      const probs = logprobs.content.map((token: any) => Math.exp(token.logprob));
      return probs.reduce((sum: number, prob: number) => sum + prob, 0) / probs.length;
    }
    
    return 0.8; // Default confidence
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
    // This is a simplified extraction - in practice, you'd want more sophisticated parsing
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
   * Sanitize request to remove sensitive information using SecurityManager
   */
  private sanitizeRequest(request: AIRequest): AIRequest {
    const sanitized = { ...request };
    
    // Use SecurityManager for comprehensive sanitization
    if (securityManager.containsSensitiveData(request.prompt)) {
      // Apply security-level appropriate sanitization
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
    // Use the same patterns as SecurityManager but simplified for AI service
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
   * Handle and categorize errors with enhanced retry logic
   */
  private handleError(error: unknown): AIError {
    if (error instanceof AIError) {
      return error;
    }

    if (error instanceof Error) {
      // Network errors - retryable
      if (error.message.includes('fetch') || error.message.includes('network')) {
        return new AIError(`Network error: ${error.message}`, 'NETWORK_ERROR', undefined, true);
      }

      // Timeout errors - retryable
      if (error.name === 'AbortError' || error.message.includes('timeout')) {
        return new AIError('Request timeout', 'TIMEOUT', undefined, true);
      }

      // Rate limit errors - retryable with delay
      if (error.message.includes('429') || error.message.includes('rate limit')) {
        return new AIError('Rate limit exceeded', 'RATE_LIMIT', 429, true);
      }

      // Server errors (5xx) - retryable
      if (error.message.includes('500') || error.message.includes('502') || 
          error.message.includes('503') || error.message.includes('504')) {
        return new AIError(`Server error: ${error.message}`, 'SERVER_ERROR', undefined, true);
      }

      // Parse errors - not retryable
      if (error.message.includes('JSON') || error.message.includes('parse')) {
        return new AIError(`Parse error: ${error.message}`, 'PARSE_ERROR');
      }

      // Authentication errors - not retryable
      if (error.message.includes('401') || error.message.includes('unauthorized')) {
        return new AIError('Authentication failed', 'AUTH_ERROR', 401, false);
      }

      // Client errors (4xx except 429) - not retryable
      if (error.message.includes('400') || error.message.includes('403') || error.message.includes('404')) {
        return new AIError(`Client error: ${error.message}`, 'CLIENT_ERROR', undefined, false);
      }

      return new AIError(`Unknown error: ${error.message}`, 'UNKNOWN_ERROR');
    }

    return new AIError('Unknown error occurred', 'UNKNOWN_ERROR');
  }

  /**
   * Enhanced retry logic with exponential backoff and jitter
   */
  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    maxRetries: number = this.config.maxRetries,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: AIError;

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

        // Special handling for rate limit errors
        if (lastError.code === 'RATE_LIMIT') {
          const rateLimitDelay = this.getRateLimitDelay();
          await this.sleep(Math.max(delay, rateLimitDelay));
        } else {
          await this.sleep(delay);
        }

        console.log(`Retrying AI request (attempt ${attempt + 1}/${maxRetries}) after ${Math.round(delay)}ms delay`);
      }
    }

    throw lastError!;
  }

  /**
   * Get appropriate delay for rate limit errors
   */
  private getRateLimitDelay(): number {
    const rateLimitStatus = this.getRateLimitStatus();
    const resetTime = rateLimitStatus.resetTime.getTime() - Date.now();
    return Math.max(resetTime, 5000); // At least 5 seconds
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Sleep utility for delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// FACTORY AND UTILITIES
// ============================================================================

/**
 * Factory function to create AI service instance
 */
export function createAIService(config: AIServiceConfig): AIService {
  return new AIService(config);
}

/**
 * Default configuration for AI service
 */
export const DEFAULT_AI_CONFIG: Omit<AIServiceConfig, 'apiKey'> = {
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4',
  maxTokens: 2000,
  temperature: 0.7,
  timeout: 30000,
  maxRetries: 3,
  rateLimitRpm: 60,
  enableStreaming: false
};

/**
 * Utility to validate AI service configuration
 */
export function validateAIConfig(config: AIServiceConfig): boolean {
  if (!config.apiKey || typeof config.apiKey !== 'string') {
    throw new Error('API key is required and must be a string');
  }

  if (config.baseUrl && typeof config.baseUrl !== 'string') {
    throw new Error('Base URL must be a string');
  }

  if (config.maxTokens !== undefined && (typeof config.maxTokens !== 'number' || config.maxTokens <= 0)) {
    throw new Error('Max tokens must be a positive number');
  }

  if (config.temperature !== undefined && (typeof config.temperature !== 'number' || config.temperature < 0 || config.temperature > 2)) {
    throw new Error('Temperature must be a number between 0 and 2');
  }

  if (config.timeout !== undefined && (typeof config.timeout !== 'number' || config.timeout <= 0)) {
    throw new Error('Timeout must be a positive number');
  }

  if (config.rateLimitRpm !== undefined && (typeof config.rateLimitRpm !== 'number' || config.rateLimitRpm <= 0)) {
    throw new Error('Rate limit RPM must be a positive number');
  }

  return true;
}