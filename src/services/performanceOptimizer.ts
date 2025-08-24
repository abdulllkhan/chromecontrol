/**
 * Performance Optimization Integration Service
 * 
 * Integrates all performance optimization services and provides
 * a unified interface for managing caching, lazy loading, and monitoring.
 */

import { CacheService, createCacheService, CACHE_CONFIGS, CacheStrategy } from './cacheService.js';
import { PerformanceMonitor, createPerformanceMonitor, PERFORMANCE_CONFIGS } from './performanceMonitor.js';
import { SuggestionCategoryLoader, createSuggestionCategoryLoader, LAZY_LOAD_CONFIGS } from './lazyLoader.js';
import { OptimizedDOMService, createOptimizedDOMService, DOM_CONFIGS } from './optimizedDOMService.js';
import { AIService } from './aiService.js';
import { SuggestionEngine } from './suggestionEngine.js';
import { WebsiteCategory } from '../types/index.js';

// ============================================================================
// PERFORMANCE OPTIMIZER INTERFACES
// ============================================================================

export interface PerformanceOptimizerConfig {
  enableCaching: boolean;
  enableLazyLoading: boolean;
  enablePerformanceMonitoring: boolean;
  enableDOMOptimization: boolean;
  cacheStrategy: CacheStrategy;
  environment: 'development' | 'production';
  optimizationLevel: 'conservative' | 'balanced' | 'aggressive';
}

export interface OptimizationReport {
  timestamp: number;
  performance: {
    averageResponseTime: number;
    cacheHitRate: number;
    memoryUsage: number;
    domOperationTime: number;
  };
  recommendations: Array<{
    type: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    implementation: string;
  }>;
  metrics: {
    totalOperations: number;
    successRate: number;
    errorRate: number;
    slowOperations: number;
  };
}

// ============================================================================
// PERFORMANCE OPTIMIZER
// ============================================================================

export class PerformanceOptimizer {
  private config: PerformanceOptimizerConfig;
  private cacheService: CacheService;
  private performanceMonitor: PerformanceMonitor;
  private lazyLoader: SuggestionCategoryLoader;
  private domService: OptimizedDOMService;
  private isInitialized = false;

  constructor(config: Partial<PerformanceOptimizerConfig> = {}) {
    this.config = {
      enableCaching: true,
      enableLazyLoading: true,
      enablePerformanceMonitoring: true,
      enableDOMOptimization: true,
      cacheStrategy: CacheStrategy.LRU,
      environment: 'production',
      optimizationLevel: 'balanced',
      ...config
    };

    // Initialize services based on configuration
    this.initializeServices();
  }

  /**
   * Initialize all performance services
   */
  private initializeServices(): void {
    // Initialize cache service
    if (this.config.enableCaching) {
      const cacheConfig = this.getCacheConfig();
      this.cacheService = createCacheService(cacheConfig, this.config.cacheStrategy);
    } else {
      // Create a no-op cache service
      this.cacheService = createCacheService({ maxSize: 0, defaultTTL: 0 });
    }

    // Initialize performance monitor
    if (this.config.enablePerformanceMonitoring) {
      const perfConfig = this.config.environment === 'development' 
        ? PERFORMANCE_CONFIGS.DEVELOPMENT 
        : PERFORMANCE_CONFIGS.PRODUCTION;
      this.performanceMonitor = createPerformanceMonitor(perfConfig);
    } else {
      // Create a no-op performance monitor
      this.performanceMonitor = createPerformanceMonitor({ enableMetrics: false });
    }

    // Initialize lazy loader
    if (this.config.enableLazyLoading) {
      const lazyConfig = this.getLazyLoadConfig();
      this.lazyLoader = createSuggestionCategoryLoader(lazyConfig);
      this.lazyLoader.setCacheService(this.cacheService);
      this.lazyLoader.setPerformanceMonitor(this.performanceMonitor);
    } else {
      // Create a no-op lazy loader
      this.lazyLoader = createSuggestionCategoryLoader({ enablePreloading: false });
    }

    // Initialize DOM service
    if (this.config.enableDOMOptimization) {
      const domConfig = this.getDOMConfig();
      this.domService = createOptimizedDOMService(domConfig);
      this.domService.setCacheService(this.cacheService);
      this.domService.setPerformanceMonitor(this.performanceMonitor);
    } else {
      // Create a basic DOM service
      this.domService = createOptimizedDOMService({ enableOptimizations: false });
    }

    // Connect performance monitor to cache service
    this.performanceMonitor.setCacheService(this.cacheService);

    this.isInitialized = true;
    console.log('Performance optimizer initialized with configuration:', this.config);
  }

  /**
   * Optimizes an AI service instance
   */
  optimizeAIService(aiService: AIService): void {
    if (!this.isInitialized) {
      console.warn('Performance optimizer not initialized');
      return;
    }

    if (this.config.enableCaching) {
      aiService.setCacheService(this.cacheService);
    }

    if (this.config.enablePerformanceMonitoring) {
      aiService.setPerformanceMonitor(this.performanceMonitor);
    }

    console.log('AI service optimized');
  }

  /**
   * Optimizes a suggestion engine instance
   */
  optimizeSuggestionEngine(suggestionEngine: SuggestionEngine): void {
    if (!this.isInitialized) {
      console.warn('Performance optimizer not initialized');
      return;
    }

    // The suggestion engine would need to be modified to accept these services
    // This is a placeholder for the integration
    console.log('Suggestion engine optimization would be implemented here');
  }

  /**
   * Preloads critical resources
   */
  async preloadCriticalResources(): Promise<void> {
    if (!this.config.enableLazyLoading) return;

    const operationId = this.performanceMonitor.startOperation('preload-critical-resources');

    try {
      // Preload priority suggestion categories
      await this.lazyLoader.preloadPriorityCategories();

      // Preload common cache entries
      const commonCacheEntries = [
        {
          key: 'common-suggestions-social',
          data: [], // Would be populated with actual data
          ttl: 1000 * 60 * 30 // 30 minutes
        },
        {
          key: 'common-suggestions-productivity',
          data: [],
          ttl: 1000 * 60 * 30
        }
      ];

      await this.cacheService.preloadCache(commonCacheEntries);

      this.performanceMonitor.endOperation(operationId, true);
      console.log('Critical resources preloaded successfully');

    } catch (error) {
      this.performanceMonitor.endOperation(operationId, false, 
        error instanceof Error ? error.message : 'Unknown error');
      console.error('Failed to preload critical resources:', error);
    }
  }

  /**
   * Optimizes memory usage
   */
  async optimizeMemoryUsage(): Promise<void> {
    const operationId = this.performanceMonitor.startOperation('optimize-memory');

    try {
      // Clear old cache entries
      const cacheMetrics = this.cacheService.getMetrics();
      if (cacheMetrics.totalSize > 40 * 1024 * 1024) { // 40MB
        console.log('Cache size is large, clearing old entries');
        // The cache service handles this automatically, but we could trigger it manually
      }

      // Clear DOM service caches
      this.domService.clearCaches();

      // Clear loaded lazy-loaded data that hasn't been used recently
      this.lazyLoader.clearLoadedData();

      // Force garbage collection if available
      if ('gc' in window && typeof (window as any).gc === 'function') {
        (window as any).gc();
      }

      this.performanceMonitor.endOperation(operationId, true);
      console.log('Memory optimization completed');

    } catch (error) {
      this.performanceMonitor.endOperation(operationId, false,
        error instanceof Error ? error.message : 'Unknown error');
      console.error('Memory optimization failed:', error);
    }
  }

  /**
   * Generates a comprehensive optimization report
   */
  generateOptimizationReport(): OptimizationReport {
    const performanceMetrics = this.performanceMonitor.getCurrentSystemMetrics();
    const cacheMetrics = this.cacheService.getMetrics();
    const domStats = this.domService.getPerformanceStats();
    const optimizationSuggestions = this.performanceMonitor.getOptimizationSuggestions();

    // Calculate performance metrics
    const performance = {
      averageResponseTime: performanceMetrics.averageResponseTimes['ai-request'] || 0,
      cacheHitRate: cacheMetrics.hitRate,
      memoryUsage: performanceMetrics.memoryUsage.used,
      domOperationTime: domStats.selectorStats.size > 0 
        ? Array.from(domStats.selectorStats.values()).reduce((sum, stat) => sum + stat.avgTime, 0) / domStats.selectorStats.size
        : 0
    };

    // Calculate operation metrics
    const totalOps = Object.values(performanceMetrics.operationCounts).reduce((sum, count) => sum + count, 0);
    const errorRates = Object.values(performanceMetrics.errorRates);
    const avgErrorRate = errorRates.length > 0 ? errorRates.reduce((sum, rate) => sum + rate, 0) / errorRates.length : 0;

    const metrics = {
      totalOperations: totalOps,
      successRate: totalOps > 0 ? ((totalOps - (totalOps * avgErrorRate / 100)) / totalOps) * 100 : 100,
      errorRate: avgErrorRate,
      slowOperations: 0 // Would need to track this separately
    };

    // Convert optimization suggestions to report format
    const recommendations = optimizationSuggestions.map(suggestion => ({
      type: suggestion.type,
      priority: suggestion.priority,
      description: suggestion.description,
      implementation: suggestion.implementation
    }));

    return {
      timestamp: Date.now(),
      performance,
      recommendations,
      metrics
    };
  }

  /**
   * Applies automatic optimizations based on current performance
   */
  async applyAutomaticOptimizations(): Promise<void> {
    const report = this.generateOptimizationReport();
    const operationId = this.performanceMonitor.startOperation('apply-auto-optimizations');

    try {
      // Apply memory optimizations if memory usage is high
      if (report.performance.memoryUsage > 50 * 1024 * 1024) { // 50MB
        await this.optimizeMemoryUsage();
      }

      // Adjust cache settings based on hit rate
      if (report.performance.cacheHitRate < 70) {
        console.log('Low cache hit rate detected, consider reviewing cache strategy');
        // Could automatically adjust cache TTL or size here
      }

      // Preload resources if response times are slow
      if (report.performance.averageResponseTime > 2000) { // 2 seconds
        await this.preloadCriticalResources();
      }

      this.performanceMonitor.endOperation(operationId, true);
      console.log('Automatic optimizations applied');

    } catch (error) {
      this.performanceMonitor.endOperation(operationId, false,
        error instanceof Error ? error.message : 'Unknown error');
      console.error('Failed to apply automatic optimizations:', error);
    }
  }

  /**
   * Gets the current performance status
   */
  getPerformanceStatus(): {
    isOptimized: boolean;
    criticalIssues: string[];
    recommendations: string[];
    metrics: any;
  } {
    const report = this.generateOptimizationReport();
    
    const criticalIssues: string[] = [];
    const recommendations: string[] = [];

    // Check for critical issues
    if (report.performance.memoryUsage > 100 * 1024 * 1024) { // 100MB
      criticalIssues.push('Very high memory usage detected');
    }

    if (report.performance.cacheHitRate < 50) {
      criticalIssues.push('Very low cache hit rate');
    }

    if (report.metrics.errorRate > 20) {
      criticalIssues.push('High error rate detected');
    }

    // Generate recommendations
    if (report.performance.averageResponseTime > 1000) {
      recommendations.push('Consider enabling more aggressive caching');
    }

    if (report.performance.domOperationTime > 100) {
      recommendations.push('DOM operations are slow, consider optimization');
    }

    return {
      isOptimized: criticalIssues.length === 0 && report.performance.cacheHitRate > 70,
      criticalIssues,
      recommendations,
      metrics: report
    };
  }

  /**
   * Gets cache configuration based on optimization level
   */
  private getCacheConfig() {
    switch (this.config.optimizationLevel) {
      case 'aggressive':
        return {
          ...CACHE_CONFIGS.AI_RESPONSES,
          maxSize: 100 * 1024 * 1024, // 100MB
          defaultTTL: 1000 * 60 * 60, // 1 hour
        };
      case 'conservative':
        return {
          ...CACHE_CONFIGS.AI_RESPONSES,
          maxSize: 10 * 1024 * 1024, // 10MB
          defaultTTL: 1000 * 60 * 10, // 10 minutes
        };
      default:
        return CACHE_CONFIGS.AI_RESPONSES;
    }
  }

  /**
   * Gets lazy loading configuration based on optimization level
   */
  private getLazyLoadConfig() {
    switch (this.config.optimizationLevel) {
      case 'aggressive':
        return LAZY_LOAD_CONFIGS.AGGRESSIVE;
      case 'conservative':
        return LAZY_LOAD_CONFIGS.CONSERVATIVE;
      default:
        return LAZY_LOAD_CONFIGS.BALANCED;
    }
  }

  /**
   * Gets DOM configuration based on optimization level
   */
  private getDOMConfig() {
    switch (this.config.optimizationLevel) {
      case 'aggressive':
        return DOM_CONFIGS.HIGH_PERFORMANCE;
      case 'conservative':
        return DOM_CONFIGS.MEMORY_EFFICIENT;
      default:
        return DOM_CONFIGS.BALANCED;
    }
  }

  /**
   * Destroys the performance optimizer and cleans up resources
   */
  destroy(): void {
    if (this.cacheService) {
      this.cacheService.destroy();
    }

    if (this.performanceMonitor) {
      this.performanceMonitor.destroy();
    }

    if (this.lazyLoader) {
      this.lazyLoader.destroy();
    }

    if (this.domService) {
      this.domService.destroy();
    }

    this.isInitialized = false;
    console.log('Performance optimizer destroyed');
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Creates a performance optimizer instance
 */
export function createPerformanceOptimizer(
  config?: Partial<PerformanceOptimizerConfig>
): PerformanceOptimizer {
  return new PerformanceOptimizer(config);
}

/**
 * Default performance optimizer configurations
 */
export const OPTIMIZER_CONFIGS = {
  DEVELOPMENT: {
    enableCaching: true,
    enableLazyLoading: true,
    enablePerformanceMonitoring: true,
    enableDOMOptimization: true,
    cacheStrategy: CacheStrategy.LRU,
    environment: 'development' as const,
    optimizationLevel: 'balanced' as const
  },
  PRODUCTION: {
    enableCaching: true,
    enableLazyLoading: true,
    enablePerformanceMonitoring: true,
    enableDOMOptimization: true,
    cacheStrategy: CacheStrategy.LRU,
    environment: 'production' as const,
    optimizationLevel: 'aggressive' as const
  },
  TESTING: {
    enableCaching: false,
    enableLazyLoading: false,
    enablePerformanceMonitoring: false,
    enableDOMOptimization: false,
    cacheStrategy: CacheStrategy.LRU,
    environment: 'development' as const,
    optimizationLevel: 'conservative' as const
  }
} as const;