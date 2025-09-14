/**
 * AI Provider Service
 * 
 * Unified service that manages multiple AI providers (OpenAI, Claude)
 * and provides a single interface for AI operations.
 */

import {
  AIRequest,
  AIResponse
} from '../types/index.js';
import { AIService, AIServiceConfig } from './aiService.js';
import { ClaudeService, ClaudeServiceConfig } from './claudeService.js';
import { CacheService } from './cacheService.js';
import { PerformanceMonitor } from './performanceMonitor.js';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export type AIProvider = 'openai' | 'claude';

export interface AIProviderConfig {
  provider: AIProvider;
  openai?: AIServiceConfig;
  claude?: ClaudeServiceConfig;
}

export interface ProviderCapabilities {
  provider: AIProvider;
  models: string[];
  maxTokens: number;
  supportedFeatures: string[];
}

// ============================================================================
// AI PROVIDER SERVICE
// ============================================================================

export class AIProviderService {
  private openaiService?: AIService;
  private claudeService?: ClaudeService;
  private currentProvider: AIProvider = 'openai';
  private cacheService?: CacheService;
  private performanceMonitor?: PerformanceMonitor;

  constructor() {
    // Initialize with default provider
  }

  /**
   * Initialize AI provider services
   */
  async initialize(config: AIProviderConfig): Promise<void> {
    this.currentProvider = config.provider;

    // Initialize OpenAI service if configured
    if (config.openai?.apiKey) {
      this.openaiService = new AIService(config.openai);
      if (this.cacheService) this.openaiService.setCacheService(this.cacheService);
      if (this.performanceMonitor) this.openaiService.setPerformanceMonitor(this.performanceMonitor);
    }

    // Initialize Claude service if configured
    if (config.claude?.apiKey) {
      this.claudeService = new ClaudeService(config.claude);
      if (this.cacheService) this.claudeService.setCacheService(this.cacheService);
      if (this.performanceMonitor) this.claudeService.setPerformanceMonitor(this.performanceMonitor);
    }
  }

  /**
   * Set cache service for all providers
   */
  setCacheService(cacheService: CacheService): void {
    this.cacheService = cacheService;
    if (this.openaiService) this.openaiService.setCacheService(cacheService);
    if (this.claudeService) this.claudeService.setCacheService(cacheService);
  }

  /**
   * Set performance monitor for all providers
   */
  setPerformanceMonitor(performanceMonitor: PerformanceMonitor): void {
    this.performanceMonitor = performanceMonitor;
    if (this.openaiService) this.openaiService.setPerformanceMonitor(performanceMonitor);
    if (this.claudeService) this.claudeService.setPerformanceMonitor(performanceMonitor);
  }

  /**
   * Process AI request using the current provider
   */
  async processRequest(request: AIRequest): Promise<AIResponse> {
    const service = this.getCurrentService();
    
    if (!service) {
      throw new Error(`No ${this.currentProvider} service configured`);
    }

    return await service.processRequest(request);
  }

  /**
   * Switch to a different AI provider
   */
  switchProvider(provider: AIProvider): void {
    if (provider === 'openai' && !this.openaiService) {
      throw new Error('OpenAI service not configured');
    }
    if (provider === 'claude' && !this.claudeService) {
      throw new Error('Claude service not configured');
    }
    
    this.currentProvider = provider;
  }

  /**
   * Get current AI provider
   */
  getCurrentProvider(): AIProvider {
    return this.currentProvider;
  }

  /**
   * Get available providers
   */
  getAvailableProviders(): AIProvider[] {
    const providers: AIProvider[] = [];
    if (this.openaiService) providers.push('openai');
    if (this.claudeService) providers.push('claude');
    return providers;
  }

  /**
   * Get provider capabilities
   */
  getProviderCapabilities(provider: AIProvider): ProviderCapabilities {
    switch (provider) {
      case 'openai':
        return {
          provider: 'openai',
          models: ['gpt-5', 'gpt-5-mini', 'gpt-4o', 'gpt-4o-mini'],
          maxTokens: 200000,
          supportedFeatures: ['text-generation', 'analysis', 'automation', 'streaming']
        };
      case 'claude':
        return {
          provider: 'claude',
          models: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'],
          maxTokens: 200000,
          supportedFeatures: ['text-generation', 'analysis', 'automation', 'code-understanding']
        };
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  /**
   * Test connection for a provider
   */
  async testConnection(provider: AIProvider): Promise<boolean> {
    try {
      const service = provider === 'openai' ? this.openaiService : this.claudeService;
      if (!service) {
        throw new Error(`${provider} service not configured`);
      }

      // Use the dedicated testConnection method for each service
      if ('testConnection' in service) {
        return await service.testConnection();
      }

      // Fallback to old method if testConnection is not available
      console.warn(`${provider} service does not have testConnection method, using fallback`);
      return false;
    } catch (error) {
      console.error(`Connection test failed for ${provider}:`, error);
      return false;
    }
  }

  /**
   * Get rate limit status for current provider
   */
  getRateLimitStatus(): { remaining: number; resetTime: Date; queueLength: number } | null {
    const service = this.getCurrentService();
    if (!service || !('getRateLimitStatus' in service)) {
      return null;
    }
    return service.getRateLimitStatus();
  }

  /**
   * Update configuration for a specific provider
   */
  updateProviderConfig(provider: AIProvider, config: Partial<AIServiceConfig | ClaudeServiceConfig>): void {
    if (provider === 'openai' && this.openaiService) {
      this.openaiService.updateConfig(config as Partial<AIServiceConfig>);
    } else if (provider === 'claude' && this.claudeService) {
      this.claudeService.updateConfig(config as Partial<ClaudeServiceConfig>);
    } else {
      throw new Error(`Cannot update config for ${provider}: service not initialized`);
    }
  }

  /**
   * Get fallback provider if current fails
   */
  getFallbackProvider(): AIProvider | null {
    const available = this.getAvailableProviders();
    return available.find(p => p !== this.currentProvider) || null;
  }

  /**
   * Process request with automatic fallback
   */
  async processRequestWithFallback(request: AIRequest): Promise<AIResponse> {
    try {
      return await this.processRequest(request);
    } catch (error) {
      const fallback = this.getFallbackProvider();
      if (!fallback) {
        throw error; // No fallback available
      }

      console.warn(`Primary provider (${this.currentProvider}) failed, trying fallback (${fallback}):`, error);
      
      const originalProvider = this.currentProvider;
      try {
        this.switchProvider(fallback);
        const response = await this.processRequest(request);
        
        // Add metadata about fallback
        (response as any).usedFallback = true;
        (response as any).originalProvider = originalProvider;
        (response as any).fallbackProvider = fallback;
        
        return response;
      } finally {
        // Switch back to original provider
        this.switchProvider(originalProvider);
      }
    }
  }

  /**
   * Get current service instance
   */
  private getCurrentService(): AIService | ClaudeService | null {
    switch (this.currentProvider) {
      case 'openai':
        return this.openaiService || null;
      case 'claude':
        return this.claudeService || null;
      default:
        return null;
    }
  }

  /**
   * Get service health status
   */
  async getServiceHealth(): Promise<Record<AIProvider, { available: boolean; lastTest?: Date; error?: string }>> {
    const health: Record<AIProvider, { available: boolean; lastTest?: Date; error?: string }> = {} as any;

    // Check OpenAI
    if (this.openaiService) {
      try {
        const isHealthy = await this.testConnection('openai');
        health.openai = {
          available: isHealthy,
          lastTest: new Date()
        };
      } catch (error) {
        health.openai = {
          available: false,
          lastTest: new Date(),
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    } else {
      health.openai = { available: false, error: 'Service not configured' };
    }

    // Check Claude
    if (this.claudeService) {
      try {
        const isHealthy = await this.testConnection('claude');
        health.claude = {
          available: isHealthy,
          lastTest: new Date()
        };
      } catch (error) {
        health.claude = {
          available: false,
          lastTest: new Date(),
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    } else {
      health.claude = { available: false, error: 'Service not configured' };
    }

    return health;
  }
}

// ============================================================================
// FACTORY AND UTILITIES
// ============================================================================

/**
 * Global AI provider service instance
 */
let globalAIProviderService: AIProviderService | null = null;

/**
 * Get or create global AI provider service
 */
export function getAIProviderService(): AIProviderService {
  if (!globalAIProviderService) {
    globalAIProviderService = new AIProviderService();
  }
  return globalAIProviderService;
}

/**
 * Create a new AI provider service instance
 */
export function createAIProviderService(): AIProviderService {
  return new AIProviderService();
}

/**
 * Default provider configuration
 */
export const DEFAULT_PROVIDER_CONFIG: Omit<AIProviderConfig, 'openai' | 'claude'> = {
  provider: 'openai'
};