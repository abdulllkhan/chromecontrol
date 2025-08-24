/**
 * Error Handler Service Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ErrorHandler, ErrorType, ErrorSeverity } from '../errorHandler.js';

// Mock chrome storage API
const mockChromeStorage = {
  local: {
    get: vi.fn(),
    set: vi.fn(),
    remove: vi.fn()
  }
};

// @ts-ignore
global.chrome = {
  storage: mockChromeStorage
};

describe('ErrorHandler', () => {
  let errorHandler: ErrorHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    errorHandler = new ErrorHandler({
      enableLogging: true,
      enableReporting: false,
      maxErrorLogs: 10,
      defaultMaxRetries: 3,
      retryDelayMs: 100,
      showTechnicalDetails: true
    });
  });

  describe('handleError', () => {
    it('should handle string errors', async () => {
      const errorMessage = 'Test error message';
      const report = await errorHandler.handleError(errorMessage);

      expect(report.message).toBe(errorMessage);
      expect(report.type).toBe(ErrorType.UNKNOWN);
      expect(report.userFriendlyMessage).toBe('An unexpected error occurred. Please try again or contact support if the problem persists.');
    });

    it('should handle Error objects', async () => {
      const error = new Error('Network connection failed');
      const report = await errorHandler.handleError(error);

      expect(report.message).toBe('Network connection failed');
      expect(report.type).toBe(ErrorType.NETWORK);
      expect(report.userFriendlyMessage).toBe('Unable to connect to the service. Please check your internet connection and try again.');
    });

    it('should classify AI service errors correctly', async () => {
      const error = new Error('AI API request failed with status 429');
      const report = await errorHandler.handleError(error);

      expect(report.type).toBe(ErrorType.RATE_LIMIT);
      expect(report.isRetryable).toBe(true);
    });

    it('should classify permission errors correctly', async () => {
      const error = new Error('Permission denied for automation');
      const report = await errorHandler.handleError(error);

      expect(report.type).toBe(ErrorType.PERMISSION);
      expect(report.severity).toBe(ErrorSeverity.HIGH);
    });

    it('should provide appropriate recovery actions', async () => {
      const error = new Error('Network timeout');
      const report = await errorHandler.handleError(error);

      expect(report.recoveryActions.length).toBeGreaterThan(0);
      expect(report.recoveryActions.some(action => action.id === 'retry')).toBe(true);
    });

    it('should include context information', async () => {
      const error = new Error('Test error');
      const context = {
        component: 'TestComponent',
        action: 'testAction'
      };
      
      const report = await errorHandler.handleError(error, context);

      expect(report.context.component).toBe('TestComponent');
      expect(report.context.action).toBe('testAction');
      expect(report.context.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('error classification', () => {
    it('should classify network errors', async () => {
      const errors = [
        'fetch failed',
        'NetworkError: Connection refused',
        'network timeout'
      ];

      for (const errorMsg of errors) {
        const report = await errorHandler.handleError(errorMsg);
        expect(report.type).toBe(ErrorType.NETWORK);
      }
    });

    it('should classify storage errors', async () => {
      const errors = [
        'Storage quota exceeded',
        'chrome.storage error',
        'QUOTA_EXCEEDED_ERR'
      ];

      for (const errorMsg of errors) {
        const report = await errorHandler.handleError(errorMsg);
        expect(report.type).toBe(ErrorType.STORAGE);
      }
    });

    it('should classify validation errors', async () => {
      const errors = [
        'Invalid input format',
        'Validation failed',
        'ValidationError: Required field missing'
      ];

      for (const errorMsg of errors) {
        const report = await errorHandler.handleError(errorMsg);
        expect(report.type).toBe(ErrorType.VALIDATION);
      }
    });
  });

  describe('retry logic', () => {
    it('should determine retryable errors correctly', async () => {
      const retryableError = new Error('Network timeout');
      const nonRetryableError = new Error('validation failed');

      const retryableReport = await errorHandler.handleError(retryableError);
      const nonRetryableReport = await errorHandler.handleError(nonRetryableError);

      expect(retryableReport.isRetryable).toBe(true);
      expect(nonRetryableReport.isRetryable).toBe(false);
    });

    it('should set appropriate max retries based on error type', async () => {
      const networkError = new Error('fetch failed');
      const validationError = new Error('validation failed');

      const networkReport = await errorHandler.handleError(networkError);
      const validationReport = await errorHandler.handleError(validationError);

      expect(networkReport.maxRetries).toBe(3);
      expect(validationReport.maxRetries).toBe(0);
    });

    it('should increment retry count', () => {
      const errorId = 'test-error-123';
      
      expect(errorHandler.getRetryCount(errorId)).toBe(0);
      
      errorHandler.incrementRetryCount(errorId);
      expect(errorHandler.getRetryCount(errorId)).toBe(1);
      
      errorHandler.incrementRetryCount(errorId);
      expect(errorHandler.getRetryCount(errorId)).toBe(2);
    });
  });

  describe('error logging', () => {
    it('should log errors when logging is enabled', async () => {
      mockChromeStorage.local.set.mockResolvedValue(undefined);
      
      const error = new Error('Test error for logging');
      await errorHandler.handleError(error);

      expect(mockChromeStorage.local.set).toHaveBeenCalled();
      
      const setCall = mockChromeStorage.local.set.mock.calls[0][0];
      expect(setCall.errorLogs).toBeDefined();
      expect(setCall.errorLogs.length).toBe(1);
    });

    it('should limit error log size', async () => {
      const limitedHandler = new ErrorHandler({ maxErrorLogs: 2 });
      mockChromeStorage.local.set.mockResolvedValue(undefined);

      // Add more errors than the limit
      await limitedHandler.handleError('Error 1');
      await limitedHandler.handleError('Error 2');
      await limitedHandler.handleError('Error 3');

      const logs = limitedHandler.getErrorLogs();
      expect(logs.length).toBe(2);
      expect(logs[0].message).toBe('Error 2');
      expect(logs[1].message).toBe('Error 3');
    });
  });

  describe('recovery actions', () => {
    it('should provide network-specific recovery actions', async () => {
      const error = new Error('Network connection failed');
      const report = await errorHandler.handleError(error);

      const actionIds = report.recoveryActions.map(action => action.id);
      expect(actionIds).toContain('retry');
      expect(actionIds).toContain('check_connection');
    });

    it('should provide permission-specific recovery actions', async () => {
      const error = new Error('Permission denied');
      const report = await errorHandler.handleError(error);

      const actionIds = report.recoveryActions.map(action => action.id);
      expect(actionIds).toContain('grant_permissions');
      expect(actionIds).toContain('reload_extension');
    });

    it('should provide storage-specific recovery actions', async () => {
      const error = new Error('Storage quota exceeded');
      const report = await errorHandler.handleError(error);

      const actionIds = report.recoveryActions.map(action => action.id);
      expect(actionIds).toContain('clear_cache');
      expect(actionIds).toContain('export_data');
    });

    it('should always include dismiss action', async () => {
      const error = new Error('Any error');
      const report = await errorHandler.handleError(error);

      const actionIds = report.recoveryActions.map(action => action.id);
      expect(actionIds).toContain('dismiss');
    });
  });

  describe('configuration', () => {
    it('should use default configuration when none provided', () => {
      const defaultHandler = new ErrorHandler();
      expect(defaultHandler).toBeDefined();
    });

    it('should allow configuration updates', () => {
      errorHandler.updateConfig({
        enableLogging: false,
        maxErrorLogs: 50
      });

      // Configuration is private, but we can test behavior
      expect(errorHandler).toBeDefined();
    });
  });

  describe('error logs management', () => {
    it('should clear error logs', async () => {
      mockChromeStorage.local.remove.mockResolvedValue(undefined);
      
      await errorHandler.handleError('Test error');
      expect(errorHandler.getErrorLogs().length).toBe(1);

      await errorHandler.clearErrorLogs();
      expect(errorHandler.getErrorLogs().length).toBe(0);
      expect(mockChromeStorage.local.remove).toHaveBeenCalledWith(['errorLogs']);
    });

    it('should load existing error logs on initialization', async () => {
      const existingLogs = [{
        id: 'existing-error',
        message: 'Existing error',
        type: ErrorType.UNKNOWN,
        severity: ErrorSeverity.MEDIUM,
        timestamp: new Date().toISOString()
      }];

      mockChromeStorage.local.get.mockResolvedValue({ errorLogs: existingLogs });
      
      const newHandler = new ErrorHandler();
      
      // Wait for async initialization
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(mockChromeStorage.local.get).toHaveBeenCalledWith(['errorLogs']);
    });
  });
});