import { useState, useCallback, useRef } from 'react';
import { errorHandler, ErrorReport, ErrorType } from '../services/errorHandler.js';

export interface UseErrorHandlerOptions {
  onError?: (error: ErrorReport) => void;
  showToast?: boolean;
  autoRetry?: boolean;
  maxRetries?: number;
}

export interface ErrorState {
  error: ErrorReport | null;
  isRetrying: boolean;
  retryCount: number;
}

export function useErrorHandler(options: UseErrorHandlerOptions = {}) {
  const [errorState, setErrorState] = useState<ErrorState>({
    error: null,
    isRetrying: false,
    retryCount: 0
  });

  const lastActionRef = useRef<(() => Promise<any>) | null>(null);

  const handleError = useCallback(async (
    error: Error | string,
    context?: any,
    action?: () => Promise<any>
  ) => {
    try {
      // Store the action for potential retry
      if (action) {
        lastActionRef.current = action;
      }

      // Generate error report
      const errorReport = await errorHandler.handleError(error, {
        component: context?.component,
        action: context?.action,
        timestamp: new Date()
      });

      // Update error state
      setErrorState(prev => ({
        error: errorReport,
        isRetrying: false,
        retryCount: prev.retryCount
      }));

      // Call custom error handler if provided
      if (options.onError) {
        options.onError(errorReport);
      }

      // Auto-retry if enabled and error is retryable
      if (options.autoRetry && 
          errorReport.isRetryable && 
          errorReport.retryCount < (options.maxRetries || 3) &&
          action) {
        setTimeout(() => {
          retry();
        }, 2000); // Wait 2 seconds before auto-retry
      }

      return errorReport;
    } catch (handlerError) {
      console.error('Error in error handler:', handlerError);
      
      // Fallback error state
      const fallbackError: ErrorReport = {
        id: 'fallback-error',
        type: ErrorType.UNKNOWN,
        severity: 'medium' as any,
        message: typeof error === 'string' ? error : error.message,
        originalError: error,
        context: { timestamp: new Date() },
        userFriendlyMessage: 'An unexpected error occurred',
        recoveryActions: [],
        isRetryable: false,
        retryCount: 0,
        maxRetries: 0,
        timestamp: new Date()
      };

      setErrorState({
        error: fallbackError,
        isRetrying: false,
        retryCount: 0
      });

      return fallbackError;
    }
  }, [options]);

  const retry = useCallback(async () => {
    if (!errorState.error || !lastActionRef.current) {
      return;
    }

    if (errorState.retryCount >= errorState.error.maxRetries) {
      return;
    }

    setErrorState(prev => ({
      ...prev,
      isRetrying: true,
      retryCount: prev.retryCount + 1
    }));

    try {
      // Increment retry count in error handler
      errorHandler.incrementRetryCount(errorState.error.id);

      // Execute the retry action
      await lastActionRef.current();

      // Clear error on successful retry
      clearError();
    } catch (retryError) {
      // Handle retry failure
      await handleError(retryError as Error, { action: 'retry' });
    } finally {
      setErrorState(prev => ({
        ...prev,
        isRetrying: false
      }));
    }
  }, [errorState.error, errorState.retryCount, handleError]);

  const clearError = useCallback(() => {
    setErrorState({
      error: null,
      isRetrying: false,
      retryCount: 0
    });
    lastActionRef.current = null;
  }, []);

  const executeWithErrorHandling = useCallback(async (
    action: () => Promise<any>,
    context?: any
  ): Promise<any> => {
    try {
      clearError(); // Clear any previous errors
      return await action();
    } catch (error) {
      await handleError(error as Error, context, action);
      return null;
    }
  }, [handleError, clearError]);

  return {
    error: errorState.error,
    isRetrying: errorState.isRetrying,
    retryCount: errorState.retryCount,
    handleError,
    retry,
    clearError,
    executeWithErrorHandling
  };
}

export default useErrorHandler;