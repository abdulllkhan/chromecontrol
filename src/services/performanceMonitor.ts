/**
 * Performance Monitoring Service
 * 
 * Provides comprehensive performance monitoring, metrics collection,
 * and optimization recommendations for the Chrome extension.
 */

import { CacheService } from './cacheService.js';

// ============================================================================
// PERFORMANCE INTERFACES
// ============================================================================

export interface PerformanceConfig {
  enableMetrics: boolean;
  enableProfiling: boolean;
  maxMetricsHistory: number;
  reportingInterval: number;
  thresholds: {
    slowOperation: number;
    memoryWarning: number;
    cacheHitRateWarning: number;
  };
}

export interface OperationMetric {
  id: string;
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  success: boolean;
  error?: string;
  metadata?: Record<string, any>;
  memoryUsage?: {
    before: number;
    after: number;
    delta: number;
  };
}

export interface SystemMetrics {
  timestamp: number;
  memoryUsage: {
    used: number;
    total: number;
    percentage: number;
  };
  cacheMetrics: {
    hitRate: number;
    size: number;
    entryCount: number;
  };
  operationCounts: Record<string, number>;
  averageResponseTimes: Record<string, number>;
  errorRates: Record<string, number>;
}

export interface PerformanceReport {
  period: {
    start: number;
    end: number;
    duration: number;
  };
  summary: {
    totalOperations: number;
    successRate: number;
    averageResponseTime: number;
    slowestOperations: OperationMetric[];
    mostFrequentErrors: Array<{ error: string; count: number }>;
  };
  recommendations: string[];
  systemMetrics: SystemMetrics[];
}

export interface OptimizationSuggestion {
  type: 'cache' | 'dom' | 'memory' | 'network' | 'algorithm';
  priority: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  impact: string;
  implementation: string;
  estimatedImprovement: string;
}

// ============================================================================
// PERFORMANCE MONITOR
// ============================================================================

export class PerformanceMonitor {
  private config: PerformanceConfig;
  private operations = new Map<string, OperationMetric>();
  private completedOperations: OperationMetric[] = [];
  private systemMetricsHistory: SystemMetrics[] = [];
  private cacheService?: CacheService;
  private reportingTimer?: NodeJS.Timeout;
  private memoryObserver?: PerformanceObserver;

  constructor(config: Partial<PerformanceConfig> = {}) {
    this.config = {
      enableMetrics: true,
      enableProfiling: false,
      maxMetricsHistory: 1000,
      reportingInterval: 60000, // 1 minute
      thresholds: {
        slowOperation: 1000, // 1 second
        memoryWarning: 50 * 1024 * 1024, // 50MB
        cacheHitRateWarning: 70 // 70%
      },
      ...config
    };

    if (this.config.enableMetrics) {
      this.initializeMonitoring();
    }
  }

  /**
   * Initialize performance monitoring
   */
  private initializeMonitoring(): void {
    // Start system metrics collection
    this.startSystemMetricsCollection();

    // Initialize performance observer for memory monitoring
    if (this.config.enableProfiling && 'PerformanceObserver' in window) {
      try {
        this.memoryObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          for (const entry of entries) {
            if (entry.entryType === 'measure') {
              this.recordCustomMetric(entry.name, entry.duration);
            }
          }
        });

        this.memoryObserver.observe({ entryTypes: ['measure'] });
      } catch (error) {
        console.warn('Performance observer not supported:', error);
      }
    }

    console.log('Performance monitoring initialized');
  }

  /**
   * Sets the cache service for monitoring
   */
  setCacheService(cacheService: CacheService): void {
    this.cacheService = cacheService;
  }

  /**
   * Starts monitoring an operation
   */
  startOperation(name: string, metadata?: Record<string, any>): string {
    if (!this.config.enableMetrics) return '';

    const id = this.generateOperationId();
    const startTime = performance.now();

    const operation: OperationMetric = {
      id,
      name,
      startTime,
      success: false,
      metadata
    };

    // Record memory usage if profiling is enabled
    if (this.config.enableProfiling) {
      operation.memoryUsage = {
        before: this.getMemoryUsage(),
        after: 0,
        delta: 0
      };
    }

    this.operations.set(id, operation);

    // Mark performance timeline if supported
    if (this.config.enableProfiling && performance.mark) {
      try {
        performance.mark(`${name}-start-${id}`);
      } catch (error) {
        // Ignore marking errors
      }
    }

    return id;
  }

  /**
   * Ends monitoring an operation
   */
  endOperation(id: string, success: boolean = true, error?: string): void {
    if (!this.config.enableMetrics || !id) return;

    const operation = this.operations.get(id);
    if (!operation) return;

    const endTime = performance.now();
    operation.endTime = endTime;
    operation.duration = endTime - operation.startTime;
    operation.success = success;
    operation.error = error;

    // Record memory usage if profiling is enabled
    if (this.config.enableProfiling && operation.memoryUsage) {
      operation.memoryUsage.after = this.getMemoryUsage();
      operation.memoryUsage.delta = operation.memoryUsage.after - operation.memoryUsage.before;
    }

    // Mark performance timeline if supported
    if (this.config.enableProfiling && performance.mark && performance.measure) {
      try {
        performance.mark(`${operation.name}-end-${id}`);
        performance.measure(
          `${operation.name}-${id}`,
          `${operation.name}-start-${id}`,
          `${operation.name}-end-${id}`
        );
      } catch (error) {
        // Ignore marking errors
      }
    }

    // Move to completed operations
    this.operations.delete(id);
    this.completedOperations.push(operation);

    // Maintain history limit
    if (this.completedOperations.length > this.config.maxMetricsHistory) {
      this.completedOperations = this.completedOperations.slice(-this.config.maxMetricsHistory);
    }

    // Check for performance issues
    this.checkPerformanceThresholds(operation);
  }

  /**
   * Records a custom metric
   */
  recordCustomMetric(name: string, value: number, metadata?: Record<string, any>): void {
    if (!this.config.enableMetrics) return;

    const operation: OperationMetric = {
      id: this.generateOperationId(),
      name,
      startTime: performance.now(),
      endTime: performance.now(),
      duration: value,
      success: true,
      metadata
    };

    this.completedOperations.push(operation);

    // Maintain history limit
    if (this.completedOperations.length > this.config.maxMetricsHistory) {
      this.completedOperations = this.completedOperations.slice(-this.config.maxMetricsHistory);
    }
  }

  /**
   * Measures the execution time of a function
   */
  async measureAsync<T>(
    name: string,
    fn: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    const id = this.startOperation(name, metadata);

    try {
      const result = await fn();
      this.endOperation(id, true);
      return result;
    } catch (error) {
      this.endOperation(id, false, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * Measures the execution time of a synchronous function
   */
  measure<T>(
    name: string,
    fn: () => T,
    metadata?: Record<string, any>
  ): T {
    const id = this.startOperation(name, metadata);

    try {
      const result = fn();
      this.endOperation(id, true);
      return result;
    } catch (error) {
      this.endOperation(id, false, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * Gets current system metrics
   */
  getCurrentSystemMetrics(): SystemMetrics {
    const now = Date.now();
    const memoryUsage = this.getMemoryUsage();
    const totalMemory = this.getTotalMemory();

    // Calculate operation statistics
    const recentOps = this.completedOperations.filter(
      op => op.endTime && (now - op.endTime) < 60000 // Last minute
    );

    const operationCounts: Record<string, number> = {};
    const responseTimes: Record<string, number[]> = {};
    const errorCounts: Record<string, number> = {};

    for (const op of recentOps) {
      operationCounts[op.name] = (operationCounts[op.name] || 0) + 1;

      if (op.duration !== undefined) {
        if (!responseTimes[op.name]) responseTimes[op.name] = [];
        responseTimes[op.name].push(op.duration);
      }

      if (!op.success) {
        errorCounts[op.name] = (errorCounts[op.name] || 0) + 1;
      }
    }

    const averageResponseTimes: Record<string, number> = {};
    const errorRates: Record<string, number> = {};

    for (const [name, times] of Object.entries(responseTimes)) {
      averageResponseTimes[name] = times.reduce((sum, time) => sum + time, 0) / times.length;
    }

    for (const [name, errors] of Object.entries(errorCounts)) {
      const total = operationCounts[name] || 0;
      errorRates[name] = total > 0 ? (errors / total) * 100 : 0;
    }

    // Get cache metrics
    const cacheMetrics = this.cacheService ? this.cacheService.getMetrics() : {
      hitRate: 0,
      totalSize: 0,
      entryCount: 0
    };

    return {
      timestamp: now,
      memoryUsage: {
        used: memoryUsage,
        total: totalMemory,
        percentage: totalMemory > 0 ? (memoryUsage / totalMemory) * 100 : 0
      },
      cacheMetrics: {
        hitRate: cacheMetrics.hitRate,
        size: cacheMetrics.totalSize,
        entryCount: cacheMetrics.entryCount
      },
      operationCounts,
      averageResponseTimes,
      errorRates
    };
  }

  /**
   * Generates a performance report
   */
  generateReport(periodMinutes: number = 60): PerformanceReport {
    const now = Date.now();
    const periodStart = now - (periodMinutes * 60 * 1000);

    const periodOperations = this.completedOperations.filter(
      op => op.endTime && op.endTime >= periodStart
    );

    const totalOperations = periodOperations.length;
    const successfulOperations = periodOperations.filter(op => op.success).length;
    const successRate = totalOperations > 0 ? (successfulOperations / totalOperations) * 100 : 0;

    const durations = periodOperations
      .filter(op => op.duration !== undefined)
      .map(op => op.duration!);
    const averageResponseTime = durations.length > 0 
      ? durations.reduce((sum, d) => sum + d, 0) / durations.length 
      : 0;

    // Find slowest operations
    const slowestOperations = periodOperations
      .filter(op => op.duration !== undefined)
      .sort((a, b) => (b.duration || 0) - (a.duration || 0))
      .slice(0, 10);

    // Count errors
    const errorCounts = new Map<string, number>();
    for (const op of periodOperations.filter(op => !op.success && op.error)) {
      const error = op.error!;
      errorCounts.set(error, (errorCounts.get(error) || 0) + 1);
    }

    const mostFrequentErrors = Array.from(errorCounts.entries())
      .map(([error, count]) => ({ error, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Get system metrics for the period
    const periodSystemMetrics = this.systemMetricsHistory.filter(
      metrics => metrics.timestamp >= periodStart
    );

    // Generate recommendations
    const recommendations = this.generateRecommendations(periodOperations, periodSystemMetrics);

    return {
      period: {
        start: periodStart,
        end: now,
        duration: now - periodStart
      },
      summary: {
        totalOperations,
        successRate,
        averageResponseTime,
        slowestOperations,
        mostFrequentErrors
      },
      recommendations,
      systemMetrics: periodSystemMetrics
    };
  }

  /**
   * Gets optimization suggestions
   */
  getOptimizationSuggestions(): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];
    const currentMetrics = this.getCurrentSystemMetrics();

    // Cache optimization suggestions
    if (this.cacheService) {
      const cacheMetrics = this.cacheService.getMetrics();
      
      if (cacheMetrics.hitRate < this.config.thresholds.cacheHitRateWarning) {
        suggestions.push({
          type: 'cache',
          priority: 'high',
          description: `Cache hit rate is low (${cacheMetrics.hitRate.toFixed(1)}%)`,
          impact: 'Increased response times and API usage',
          implementation: 'Review cache key generation and TTL settings',
          estimatedImprovement: '20-40% faster response times'
        });
      }

      if (cacheMetrics.totalSize > 40 * 1024 * 1024) { // 40MB
        suggestions.push({
          type: 'cache',
          priority: 'medium',
          description: 'Cache size is large, consider more aggressive eviction',
          impact: 'High memory usage',
          implementation: 'Reduce cache size limits or implement better eviction strategy',
          estimatedImprovement: '10-20MB memory reduction'
        });
      }
    }

    // Memory optimization suggestions
    if (currentMetrics.memoryUsage.used > this.config.thresholds.memoryWarning) {
      suggestions.push({
        type: 'memory',
        priority: 'high',
        description: `High memory usage (${(currentMetrics.memoryUsage.used / 1024 / 1024).toFixed(1)}MB)`,
        impact: 'Potential performance degradation and crashes',
        implementation: 'Implement memory cleanup and reduce data retention',
        estimatedImprovement: '30-50% memory reduction'
      });
    }

    // DOM optimization suggestions
    const domOperations = this.completedOperations.filter(
      op => op.name.includes('DOM') || op.name.includes('extract') || op.name.includes('query')
    );

    if (domOperations.length > 0) {
      const avgDomTime = domOperations.reduce((sum, op) => sum + (op.duration || 0), 0) / domOperations.length;
      
      if (avgDomTime > 100) { // 100ms
        suggestions.push({
          type: 'dom',
          priority: 'medium',
          description: `DOM operations are slow (avg ${avgDomTime.toFixed(1)}ms)`,
          impact: 'Delayed content extraction and user interactions',
          implementation: 'Optimize selectors, use document fragments, batch DOM operations',
          estimatedImprovement: '50-70% faster DOM operations'
        });
      }
    }

    // Network optimization suggestions
    const networkOperations = this.completedOperations.filter(
      op => op.name.includes('AI') || op.name.includes('request') || op.name.includes('fetch')
    );

    if (networkOperations.length > 0) {
      const failedNetworkOps = networkOperations.filter(op => !op.success);
      const networkFailureRate = (failedNetworkOps.length / networkOperations.length) * 100;

      if (networkFailureRate > 10) {
        suggestions.push({
          type: 'network',
          priority: 'high',
          description: `High network failure rate (${networkFailureRate.toFixed(1)}%)`,
          impact: 'Poor user experience and reduced functionality',
          implementation: 'Implement better retry logic, fallback mechanisms, and error handling',
          estimatedImprovement: '80-90% reduction in failed requests'
        });
      }
    }

    return suggestions.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * Starts system metrics collection
   */
  private startSystemMetricsCollection(): void {
    const collectMetrics = () => {
      const metrics = this.getCurrentSystemMetrics();
      this.systemMetricsHistory.push(metrics);

      // Maintain history limit
      if (this.systemMetricsHistory.length > this.config.maxMetricsHistory) {
        this.systemMetricsHistory = this.systemMetricsHistory.slice(-this.config.maxMetricsHistory);
      }
    };

    // Collect initial metrics
    collectMetrics();

    // Set up periodic collection
    this.reportingTimer = setInterval(collectMetrics, this.config.reportingInterval);
  }

  /**
   * Checks performance thresholds and logs warnings
   */
  private checkPerformanceThresholds(operation: OperationMetric): void {
    if (operation.duration && operation.duration > this.config.thresholds.slowOperation) {
      console.warn(`Slow operation detected: ${operation.name} took ${operation.duration.toFixed(2)}ms`);
    }

    if (operation.memoryUsage && operation.memoryUsage.delta > 10 * 1024 * 1024) { // 10MB
      console.warn(`High memory usage: ${operation.name} used ${(operation.memoryUsage.delta / 1024 / 1024).toFixed(2)}MB`);
    }
  }

  /**
   * Generates performance recommendations
   */
  private generateRecommendations(
    operations: OperationMetric[],
    systemMetrics: SystemMetrics[]
  ): string[] {
    const recommendations: string[] = [];

    // Analyze slow operations
    const slowOps = operations.filter(op => 
      op.duration && op.duration > this.config.thresholds.slowOperation
    );

    if (slowOps.length > operations.length * 0.1) { // More than 10% slow
      recommendations.push('Consider optimizing frequently slow operations or implementing caching');
    }

    // Analyze memory usage
    const avgMemoryUsage = systemMetrics.length > 0
      ? systemMetrics.reduce((sum, m) => sum + m.memoryUsage.used, 0) / systemMetrics.length
      : 0;

    if (avgMemoryUsage > this.config.thresholds.memoryWarning) {
      recommendations.push('Memory usage is high, consider implementing cleanup routines');
    }

    // Analyze cache performance
    if (this.cacheService) {
      const cacheMetrics = this.cacheService.getMetrics();
      if (cacheMetrics.hitRate < this.config.thresholds.cacheHitRateWarning) {
        recommendations.push('Cache hit rate is low, review caching strategy and key generation');
      }
    }

    // Analyze error rates
    const errorRate = operations.length > 0 
      ? (operations.filter(op => !op.success).length / operations.length) * 100 
      : 0;

    if (errorRate > 5) {
      recommendations.push('Error rate is high, implement better error handling and retry mechanisms');
    }

    return recommendations;
  }

  /**
   * Gets current memory usage
   */
  private getMemoryUsage(): number {
    if ('memory' in performance && (performance as any).memory) {
      return (performance as any).memory.usedJSHeapSize || 0;
    }
    return 0;
  }

  /**
   * Gets total available memory
   */
  private getTotalMemory(): number {
    if ('memory' in performance && (performance as any).memory) {
      return (performance as any).memory.totalJSHeapSize || 0;
    }
    return 0;
  }

  /**
   * Generates a unique operation ID
   */
  private generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clears all metrics
   */
  clearMetrics(): void {
    this.operations.clear();
    this.completedOperations = [];
    this.systemMetricsHistory = [];
    console.log('Performance metrics cleared');
  }

  /**
   * Destroys the performance monitor
   */
  destroy(): void {
    if (this.reportingTimer) {
      clearInterval(this.reportingTimer);
      this.reportingTimer = undefined;
    }

    if (this.memoryObserver) {
      this.memoryObserver.disconnect();
      this.memoryObserver = undefined;
    }

    this.clearMetrics();
  }
}

// ============================================================================
// PERFORMANCE UTILITIES
// ============================================================================

/**
 * Creates a performance monitor instance
 */
export function createPerformanceMonitor(config?: Partial<PerformanceConfig>): PerformanceMonitor {
  return new PerformanceMonitor(config);
}

/**
 * Default performance configurations
 */
export const PERFORMANCE_CONFIGS = {
  DEVELOPMENT: {
    enableMetrics: true,
    enableProfiling: true,
    maxMetricsHistory: 500,
    reportingInterval: 30000, // 30 seconds
    thresholds: {
      slowOperation: 500, // 500ms
      memoryWarning: 30 * 1024 * 1024, // 30MB
      cacheHitRateWarning: 60 // 60%
    }
  },
  PRODUCTION: {
    enableMetrics: true,
    enableProfiling: false,
    maxMetricsHistory: 1000,
    reportingInterval: 60000, // 1 minute
    thresholds: {
      slowOperation: 1000, // 1 second
      memoryWarning: 50 * 1024 * 1024, // 50MB
      cacheHitRateWarning: 70 // 70%
    }
  }
} as const;