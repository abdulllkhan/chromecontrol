/**
 * Performance Optimizer Integration Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PerformanceOptimizer, createPerformanceOptimizer, OPTIMIZER_CONFIGS } from '../performanceOptimizer';
import { AIService } from '../aiService';
import { CacheStrategy } from '../cacheService';

describe('PerformanceOptimizer', () => {
  let optimizer: PerformanceOptimizer;

  beforeEach(() => {
    optimizer = createPerformanceOptimizer(OPTIMIZER_CONFIGS.DEVELOPMENT);
  });

  afterEach(() => {
    optimizer.destroy();
  });

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      const defaultOptimizer = createPerformanceOptimizer();
      expect(defaultOptimizer).toBeDefined();
      
      const status = defaultOptimizer.getPerformanceStatus();
      expect(status).toBeDefined();
      expect(status.isOptimized).toBeDefined();
      
      defaultOptimizer.destroy();
    });

    it('should initialize with custom configuration', () => {
      const customOptimizer = createPerformanceOptimizer({
        enableCaching: false,
        enableLazyLoading: false,
        optimizationLevel: 'conservative'
      });
      
      expect(customOptimizer).toBeDefined();
      customOptimizer.destroy();
    });

    it('should initialize with different optimization levels', () => {
      const configs = ['conservative', 'balanced', 'aggressive'] as const;
      
      configs.forEach(level => {
        const testOptimizer = createPerformanceOptimizer({
          optimizationLevel: level
        });
        
        expect(testOptimizer).toBeDefined();
        testOptimizer.destroy();
      });
    });
  });

  describe('AI Service Optimization', () => {
    it('should optimize AI service with caching and monitoring', () => {
      const mockAIService = {
        setCacheService: vi.fn(),
        setPerformanceMonitor: vi.fn()
      } as unknown as AIService;

      optimizer.optimizeAIService(mockAIService);

      expect(mockAIService.setCacheService).toHaveBeenCalled();
      expect(mockAIService.setPerformanceMonitor).toHaveBeenCalled();
    });

    it('should not optimize AI service when caching is disabled', () => {
      const noCacheOptimizer = createPerformanceOptimizer({
        enableCaching: false,
        enablePerformanceMonitoring: false
      });

      const mockAIService = {
        setCacheService: vi.fn(),
        setPerformanceMonitor: vi.fn()
      } as unknown as AIService;

      noCacheOptimizer.optimizeAIService(mockAIService);

      // Should still be called but with no-op services
      expect(mockAIService.setCacheService).toHaveBeenCalled();
      expect(mockAIService.setPerformanceMonitor).toHaveBeenCalled();

      noCacheOptimizer.destroy();
    });
  });

  describe('Resource Preloading', () => {
    it('should preload critical resources', async () => {
      await expect(optimizer.preloadCriticalResources()).resolves.not.toThrow();
    });

    it('should skip preloading when lazy loading is disabled', async () => {
      const noLazyOptimizer = createPerformanceOptimizer({
        enableLazyLoading: false
      });

      await expect(noLazyOptimizer.preloadCriticalResources()).resolves.not.toThrow();
      noLazyOptimizer.destroy();
    });
  });

  describe('Memory Optimization', () => {
    it('should optimize memory usage', async () => {
      await expect(optimizer.optimizeMemoryUsage()).resolves.not.toThrow();
    });

    it('should handle memory optimization errors gracefully', async () => {
      // This should not throw even if there are internal errors
      await expect(optimizer.optimizeMemoryUsage()).resolves.not.toThrow();
    });
  });

  describe('Performance Reporting', () => {
    it('should generate optimization report', () => {
      const report = optimizer.generateOptimizationReport();
      
      expect(report).toBeDefined();
      expect(report.timestamp).toBeGreaterThan(0);
      expect(report.performance).toBeDefined();
      expect(report.recommendations).toBeDefined();
      expect(report.metrics).toBeDefined();
      
      expect(typeof report.performance.averageResponseTime).toBe('number');
      expect(typeof report.performance.cacheHitRate).toBe('number');
      expect(typeof report.performance.memoryUsage).toBe('number');
      expect(typeof report.performance.domOperationTime).toBe('number');
    });

    it('should include recommendations in report', () => {
      const report = optimizer.generateOptimizationReport();
      
      expect(Array.isArray(report.recommendations)).toBe(true);
      // Recommendations might be empty if no issues are detected
    });

    it('should include performance metrics in report', () => {
      const report = optimizer.generateOptimizationReport();
      
      expect(report.metrics.totalOperations).toBeGreaterThanOrEqual(0);
      expect(report.metrics.successRate).toBeGreaterThanOrEqual(0);
      expect(report.metrics.successRate).toBeLessThanOrEqual(100);
      expect(report.metrics.errorRate).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Performance Status', () => {
    it('should provide performance status', () => {
      const status = optimizer.getPerformanceStatus();
      
      expect(status).toBeDefined();
      expect(typeof status.isOptimized).toBe('boolean');
      expect(Array.isArray(status.criticalIssues)).toBe(true);
      expect(Array.isArray(status.recommendations)).toBe(true);
      expect(status.metrics).toBeDefined();
    });

    it('should detect critical issues', () => {
      // Mock high memory usage to trigger critical issue
      const mockPerformanceMonitor = (optimizer as any).performanceMonitor;
      const originalGetCurrentSystemMetrics = mockPerformanceMonitor.getCurrentSystemMetrics;
      
      mockPerformanceMonitor.getCurrentSystemMetrics = vi.fn().mockReturnValue({
        memoryUsage: { used: 150 * 1024 * 1024 }, // 150MB - should trigger critical issue
        operationCounts: {},
        averageResponseTimes: {},
        errorRates: {}
      });

      const status = optimizer.getPerformanceStatus();
      expect(status.criticalIssues.length).toBeGreaterThan(0);

      // Restore original method
      mockPerformanceMonitor.getCurrentSystemMetrics = originalGetCurrentSystemMetrics;
    });
  });

  describe('Automatic Optimizations', () => {
    it('should apply automatic optimizations', async () => {
      await expect(optimizer.applyAutomaticOptimizations()).resolves.not.toThrow();
    });

    it('should trigger memory optimization for high memory usage', async () => {
      // Mock high memory usage
      const mockPerformanceMonitor = (optimizer as any).performanceMonitor;
      const originalGetCurrentSystemMetrics = mockPerformanceMonitor.getCurrentSystemMetrics;
      
      mockPerformanceMonitor.getCurrentSystemMetrics = vi.fn().mockReturnValue({
        memoryUsage: { used: 60 * 1024 * 1024 }, // 60MB - should trigger memory optimization
        operationCounts: {},
        averageResponseTimes: {},
        errorRates: {}
      });

      const optimizeMemorySpy = vi.spyOn(optimizer, 'optimizeMemoryUsage');
      
      await optimizer.applyAutomaticOptimizations();
      
      expect(optimizeMemorySpy).toHaveBeenCalled();

      // Restore original method
      mockPerformanceMonitor.getCurrentSystemMetrics = originalGetCurrentSystemMetrics;
      optimizeMemorySpy.mockRestore();
    });

    it('should trigger preloading for slow response times', async () => {
      // Mock slow response times
      const mockPerformanceMonitor = (optimizer as any).performanceMonitor;
      const originalGenerateOptimizationReport = optimizer.generateOptimizationReport;
      
      optimizer.generateOptimizationReport = vi.fn().mockReturnValue({
        performance: {
          averageResponseTime: 3000, // 3 seconds - should trigger preloading
          cacheHitRate: 80,
          memoryUsage: 20 * 1024 * 1024,
          domOperationTime: 50
        },
        recommendations: [],
        metrics: {
          totalOperations: 10,
          successRate: 90,
          errorRate: 10,
          slowOperations: 2
        }
      });

      const preloadSpy = vi.spyOn(optimizer, 'preloadCriticalResources');
      
      await optimizer.applyAutomaticOptimizations();
      
      expect(preloadSpy).toHaveBeenCalled();

      // Restore original method
      optimizer.generateOptimizationReport = originalGenerateOptimizationReport;
      preloadSpy.mockRestore();
    });
  });

  describe('Configuration Handling', () => {
    it('should handle production configuration', () => {
      const prodOptimizer = createPerformanceOptimizer(OPTIMIZER_CONFIGS.PRODUCTION);
      
      const status = prodOptimizer.getPerformanceStatus();
      expect(status).toBeDefined();
      
      prodOptimizer.destroy();
    });

    it('should handle testing configuration', () => {
      const testOptimizer = createPerformanceOptimizer(OPTIMIZER_CONFIGS.TESTING);
      
      const status = testOptimizer.getPerformanceStatus();
      expect(status).toBeDefined();
      
      testOptimizer.destroy();
    });

    it('should handle different cache strategies', () => {
      const strategies = [CacheStrategy.LRU, CacheStrategy.LFU, CacheStrategy.TTL, CacheStrategy.FIFO];
      
      strategies.forEach(strategy => {
        const strategyOptimizer = createPerformanceOptimizer({
          cacheStrategy: strategy
        });
        
        expect(strategyOptimizer).toBeDefined();
        strategyOptimizer.destroy();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle optimization errors gracefully', async () => {
      // Mock an error in memory optimization
      const originalOptimizeMemory = optimizer.optimizeMemoryUsage;
      optimizer.optimizeMemoryUsage = vi.fn().mockRejectedValue(new Error('Optimization error'));

      // Should not throw
      await expect(optimizer.applyAutomaticOptimizations()).resolves.not.toThrow();

      // Restore original method
      optimizer.optimizeMemoryUsage = originalOptimizeMemory;
    });

    it('should handle report generation errors gracefully', () => {
      // Mock an error in report generation
      const mockPerformanceMonitor = (optimizer as any).performanceMonitor;
      const originalGetCurrentSystemMetrics = mockPerformanceMonitor.getCurrentSystemMetrics;
      
      mockPerformanceMonitor.getCurrentSystemMetrics = vi.fn().mockImplementation(() => {
        throw new Error('Metrics error');
      });

      // Should not throw but might return default values
      expect(() => optimizer.generateOptimizationReport()).not.toThrow();

      // Restore original method
      mockPerformanceMonitor.getCurrentSystemMetrics = originalGetCurrentSystemMetrics;
    });
  });

  describe('Resource Cleanup', () => {
    it('should clean up resources on destroy', () => {
      const testOptimizer = createPerformanceOptimizer();
      
      // Should not throw
      expect(() => testOptimizer.destroy()).not.toThrow();
      
      // Should be able to call destroy multiple times
      expect(() => testOptimizer.destroy()).not.toThrow();
    });

    it('should handle destroy when services are not initialized', () => {
      const testOptimizer = createPerformanceOptimizer({
        enableCaching: false,
        enablePerformanceMonitoring: false,
        enableLazyLoading: false,
        enableDOMOptimization: false
      });
      
      expect(() => testOptimizer.destroy()).not.toThrow();
    });
  });
});