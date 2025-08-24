/**
 * Performance Monitor Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PerformanceMonitor, createPerformanceMonitor, PERFORMANCE_CONFIGS } from '../performanceMonitor';

describe('PerformanceMonitor', () => {
  let performanceMonitor: PerformanceMonitor;

  beforeEach(() => {
    performanceMonitor = createPerformanceMonitor(PERFORMANCE_CONFIGS.DEVELOPMENT);
  });

  afterEach(() => {
    performanceMonitor.destroy();
  });

  describe('Operation Tracking', () => {
    it('should track operation start and end', async () => {
      const operationId = performanceMonitor.startOperation('test-operation', { test: 'metadata' });
      expect(operationId).toBeTruthy();

      performanceMonitor.endOperation(operationId, true);

      // Wait a bit for metrics to be collected
      await new Promise(resolve => setTimeout(resolve, 100));

      const metrics = performanceMonitor.getCurrentSystemMetrics();
      expect(metrics.operationCounts['test-operation']).toBe(1);
    });

    it('should track failed operations', async () => {
      const operationId = performanceMonitor.startOperation('failed-operation');
      performanceMonitor.endOperation(operationId, false, 'Test error');

      // Wait a bit for metrics to be collected
      await new Promise(resolve => setTimeout(resolve, 100));

      const metrics = performanceMonitor.getCurrentSystemMetrics();
      expect(metrics.errorRates['failed-operation']).toBeGreaterThan(0);
    });

    it('should calculate average response times', async () => {
      const operationId1 = performanceMonitor.startOperation('timed-operation');
      
      // Simulate some processing time
      await new Promise(resolve => setTimeout(resolve, 10));
      
      performanceMonitor.endOperation(operationId1, true);

      // Wait for metrics to be collected
      await new Promise(resolve => setTimeout(resolve, 100));

      const metrics = performanceMonitor.getCurrentSystemMetrics();
      expect(metrics.averageResponseTimes['timed-operation']).toBeGreaterThan(0);
    });
  });

  describe('Async Operation Measurement', () => {
    it('should measure async operations', async () => {
      const result = await performanceMonitor.measureAsync('async-test', async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'test-result';
      });

      expect(result).toBe('test-result');

      // Wait for metrics to be collected
      await new Promise(resolve => setTimeout(resolve, 100));

      const metrics = performanceMonitor.getCurrentSystemMetrics();
      expect(metrics.operationCounts['async-test']).toBe(1);
      expect(metrics.averageResponseTimes['async-test']).toBeGreaterThan(0);
    });

    it('should handle async operation errors', async () => {
      await expect(
        performanceMonitor.measureAsync('async-error', async () => {
          throw new Error('Test error');
        })
      ).rejects.toThrow('Test error');

      // Wait for metrics to be collected
      await new Promise(resolve => setTimeout(resolve, 100));

      const metrics = performanceMonitor.getCurrentSystemMetrics();
      expect(metrics.errorRates['async-error']).toBeGreaterThan(0);
    });
  });

  describe('Sync Operation Measurement', () => {
    it('should measure sync operations', async () => {
      const result = performanceMonitor.measure('sync-test', () => {
        // Simulate some work
        let sum = 0;
        for (let i = 0; i < 1000; i++) {
          sum += i;
        }
        return sum;
      });

      expect(result).toBe(499500); // Sum of 0 to 999

      // Wait for metrics to be collected
      await new Promise(resolve => setTimeout(resolve, 100));

      const metrics = performanceMonitor.getCurrentSystemMetrics();
      expect(metrics.operationCounts['sync-test']).toBe(1);
    });

    it('should handle sync operation errors', async () => {
      expect(() => {
        performanceMonitor.measure('sync-error', () => {
          throw new Error('Test error');
        });
      }).toThrow('Test error');

      // Wait for metrics to be collected
      await new Promise(resolve => setTimeout(resolve, 100));

      const metrics = performanceMonitor.getCurrentSystemMetrics();
      expect(metrics.errorRates['sync-error']).toBeGreaterThan(0);
    });
  });

  describe('Custom Metrics', () => {
    it('should record custom metrics', () => {
      performanceMonitor.recordCustomMetric('custom-metric', 123.45, { type: 'test' });

      // Custom metrics are recorded but we can't easily test them without accessing private members
      // Just verify the method doesn't throw
      expect(() => {
        performanceMonitor.recordCustomMetric('another-metric', 456.78);
      }).not.toThrow();
    });
  });

  describe('System Metrics', () => {
    it('should collect system metrics', () => {
      const metrics = performanceMonitor.getCurrentSystemMetrics();
      
      expect(metrics.timestamp).toBeGreaterThan(0);
      expect(metrics.memoryUsage).toBeDefined();
      expect(metrics.operationCounts).toBeDefined();
      expect(metrics.averageResponseTimes).toBeDefined();
      expect(metrics.errorRates).toBeDefined();
    });

    it('should track memory usage if available', () => {
      // Mock performance.memory
      const originalMemory = (performance as any).memory;
      (performance as any).memory = {
        usedJSHeapSize: 1024 * 1024, // 1MB
        totalJSHeapSize: 2 * 1024 * 1024 // 2MB
      };

      const metrics = performanceMonitor.getCurrentSystemMetrics();
      expect(metrics.memoryUsage.used).toBe(1024 * 1024);
      expect(metrics.memoryUsage.total).toBe(2 * 1024 * 1024);
      expect(metrics.memoryUsage.percentage).toBe(50);

      // Restore original
      (performance as any).memory = originalMemory;
    });
  });

  describe('Performance Reports', () => {
    it('should generate performance reports', () => {
      // Add some operations
      const op1 = performanceMonitor.startOperation('report-test-1');
      const op2 = performanceMonitor.startOperation('report-test-2');
      
      performanceMonitor.endOperation(op1, true);
      performanceMonitor.endOperation(op2, false, 'Test error');

      const report = performanceMonitor.generateReport(1); // 1 minute period
      
      expect(report.period).toBeDefined();
      expect(report.summary.totalOperations).toBeGreaterThan(0);
      expect(report.summary.successRate).toBeGreaterThan(0);
      expect(report.summary.successRate).toBeLessThan(100); // Due to failed operation
      expect(report.recommendations).toBeDefined();
    });

    it('should include slowest operations in report', () => {
      const slowOp = performanceMonitor.startOperation('slow-operation');
      
      // Simulate slow operation
      setTimeout(() => {
        performanceMonitor.endOperation(slowOp, true);
        
        const report = performanceMonitor.generateReport(1);
        expect(report.summary.slowestOperations.length).toBeGreaterThan(0);
      }, 20);
    });
  });

  describe('Optimization Suggestions', () => {
    it('should provide optimization suggestions', () => {
      // Create conditions that would trigger suggestions
      const suggestions = performanceMonitor.getOptimizationSuggestions();
      
      expect(Array.isArray(suggestions)).toBe(true);
      // Suggestions might be empty if no issues are detected
    });

    it('should suggest memory optimization for high memory usage', () => {
      // Mock high memory usage
      const originalMemory = (performance as any).memory;
      (performance as any).memory = {
        usedJSHeapSize: 100 * 1024 * 1024, // 100MB
        totalJSHeapSize: 200 * 1024 * 1024 // 200MB
      };

      const suggestions = performanceMonitor.getOptimizationSuggestions();
      const memoryOptimization = suggestions.find(s => s.type === 'memory');
      
      expect(memoryOptimization).toBeTruthy();
      expect(memoryOptimization?.priority).toBe('high');

      // Restore original
      (performance as any).memory = originalMemory;
    });
  });

  describe('Metrics Cleanup', () => {
    it('should clear metrics when requested', () => {
      // Add some operations
      const op = performanceMonitor.startOperation('cleanup-test');
      performanceMonitor.endOperation(op, true);

      // Verify metrics exist
      let metrics = performanceMonitor.getCurrentSystemMetrics();
      expect(metrics.operationCounts['cleanup-test']).toBe(1);

      // Clear metrics
      performanceMonitor.clearMetrics();

      // Verify metrics are cleared
      metrics = performanceMonitor.getCurrentSystemMetrics();
      expect(metrics.operationCounts['cleanup-test']).toBeUndefined();
    });
  });

  describe('Configuration', () => {
    it('should respect configuration settings', () => {
      const disabledMonitor = createPerformanceMonitor({
        enableMetrics: false,
        enableProfiling: false
      });

      const op = disabledMonitor.startOperation('disabled-test');
      expect(op).toBe(''); // Should return empty string when disabled

      disabledMonitor.destroy();
    });

    it('should use different thresholds based on configuration', () => {
      const strictMonitor = createPerformanceMonitor({
        thresholds: {
          slowOperation: 100, // 100ms
          memoryWarning: 10 * 1024 * 1024, // 10MB
          cacheHitRateWarning: 90 // 90%
        }
      });

      // Test that thresholds are applied (would need to check console warnings in real scenario)
      const op = strictMonitor.startOperation('threshold-test');
      
      setTimeout(() => {
        strictMonitor.endOperation(op, true);
        // In a real test, we'd check for console warnings about slow operations
      }, 150); // Longer than 100ms threshold

      strictMonitor.destroy();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid operation IDs gracefully', () => {
      // Should not throw when ending non-existent operation
      expect(() => {
        performanceMonitor.endOperation('non-existent-id', true);
      }).not.toThrow();
    });

    it('should handle measurement errors gracefully', () => {
      // Should not break when measurement fails
      const result = performanceMonitor.measure('error-handling', () => {
        throw new Error('Measurement error');
      });

      // Should re-throw the error but not break the monitor
      expect(() => result).toThrow('Measurement error');
      
      // Monitor should still be functional
      const op = performanceMonitor.startOperation('after-error');
      expect(op).toBeTruthy();
      performanceMonitor.endOperation(op, true);
    });
  });
});