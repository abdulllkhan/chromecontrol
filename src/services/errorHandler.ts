/**
 * Centralized Error Handling Service
 * 
 * Provides comprehensive error handling, user-friendly error messages,
 * recovery strategies, and error reporting capabilities.
 */

import { AIError } from './aiService.js';

// ============================================================================
// ERROR TYPES AND INTERFACES
// ============================================================================

export enum ErrorType {
  NETWORK = 'network',
  PERMISSION = 'permission',
  AI_SERVICE = 'ai_service',
  STORAGE = 'storage',
  VALIDATION = 'validation',
  AUTOMATION = 'automation',
  SECURITY = 'security',
  RATE_LIMIT = 'rate_limit',
  TIMEOUT = 'timeout',
  UNKNOWN = 'unknown'
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface ErrorContext {
  component?: string;
  action?: string;
  userId?: string;
  sessionId?: string;
  url?: string;
  timestamp: Date;
  userAgent?: string;
  extensionVersion?: string;
}

export interface RecoveryAction {
  id: string;
  label: string;
  description?: string;
  action: () => Promise<void> | void;
  isPrimary?: boolean;
  requiresPermission?: boolean;
  estimatedTime?: number;
}

export interface ErrorReport {
  id: string;
  type: ErrorType;
  severity: ErrorSeverity;
  message: string;
  originalError: Error | string;
  context: ErrorContext;
  userFriendlyMessage: string;
  recoveryActions: RecoveryAction[];
  isRetryable: boolean;
  retryCount: number;
  maxRetries: number;
  timestamp: Date;
}

export interface ErrorHandlerConfig {
  enableLogging: boolean;
  enableReporting: boolean;
  maxErrorLogs: number;
  defaultMaxRetries: number;
  retryDelayMs: number;
  showTechnicalDetails: boolean;
}

// ============================================================================
// ERROR HANDLER IMPLEMENTATION
// ============================================================================

export class ErrorHandler {
  private config: ErrorHandlerConfig;
  private errorLogs: ErrorReport[] = [];
  private retryAttempts = new Map<string, number>();

  constructor(config: Partial<ErrorHandlerConfig> = {}) {
    this.config = {
      enableLogging: true,
      enableReporting: false,
      maxErrorLogs: 100,
      defaultMaxRetries: 3,
      retryDelayMs: 1000,
      showTechnicalDetails: false,
      ...config
    };

    this.loadErrorLogs();
  }

  /**
   * Handle an error and return a formatted error report
   */
  async handleError(
    error: Error | string,
    context: Partial<ErrorContext> = {}
  ): Promise<ErrorReport> {
    const errorId = this.generateErrorId();
    const errorType = this.classifyError(error);
    const severity = this.determineSeverity(errorType, error);
    
    const fullContext: ErrorContext = {
      timestamp: new Date(),
      url: window?.location?.href,
      userAgent: navigator?.userAgent,
      extensionVersion: this.getExtensionVersion(),
      ...context
    };

    const errorReport: ErrorReport = {
      id: errorId,
      type: errorType,
      severity,
      message: typeof error === 'string' ? error : error.message,
      originalError: error,
      context: fullContext,
      userFriendlyMessage: this.getUserFriendlyMessage(errorType, error),
      recoveryActions: this.getRecoveryActions(errorType, error, fullContext),
      isRetryable: this.isRetryable(errorType, error),
      retryCount: this.getRetryCount(errorId),
      maxRetries: this.getMaxRetries(errorType),
      timestamp: new Date()
    };

    // Log the error
    if (this.config.enableLogging) {
      this.logError(errorReport);
    }

    // Report the error if enabled
    if (this.config.enableReporting) {
      await this.reportError(errorReport);
    }

    return errorReport;
  }

  /**
   * Classify error into appropriate type
   */
  private classifyError(error: Error | string): ErrorType {
    const errorMessage = typeof error === 'string' ? error : error.message;
    const errorName = typeof error === 'object' ? error.name : '';

    // AI Service errors
    if (error instanceof AIError || errorMessage.includes('AI') || errorMessage.includes('API')) {
      if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
        return ErrorType.RATE_LIMIT;
      }
      if (errorMessage.includes('timeout') || errorMessage.includes('TIMEOUT')) {
        return ErrorType.TIMEOUT;
      }
      return ErrorType.AI_SERVICE;
    }

    // Network errors
    if (errorMessage.toLowerCase().includes('fetch') || 
        errorMessage.toLowerCase().includes('network') || 
        errorMessage.toLowerCase().includes('connection') ||
        errorMessage.includes('NetworkError') ||
        errorName === 'NetworkError') {
      return ErrorType.NETWORK;
    }

    // Permission errors
    if (errorMessage.toLowerCase().includes('permission') || 
        errorMessage.toLowerCase().includes('denied') ||
        errorMessage.toLowerCase().includes('unauthorized') ||
        errorMessage.toLowerCase().includes('api key')) {
      return ErrorType.PERMISSION;
    }

    // Storage errors
    if (errorMessage.includes('storage') || 
        errorMessage.includes('Storage') ||
        errorMessage.includes('quota') ||
        errorMessage.includes('QUOTA_EXCEEDED')) {
      return ErrorType.STORAGE;
    }

    // Validation errors
    if (errorMessage.toLowerCase().includes('validation') || 
        errorMessage.toLowerCase().includes('invalid') ||
        errorMessage.toLowerCase().includes('required') ||
        errorName === 'ValidationError') {
      return ErrorType.VALIDATION;
    }

    // Automation errors
    if (errorMessage.includes('automation') || 
        errorMessage.includes('DOM') ||
        errorMessage.includes('element not found') ||
        errorMessage.includes('selector')) {
      return ErrorType.AUTOMATION;
    }

    // Security errors
    if (errorMessage.includes('security') || 
        errorMessage.includes('Security') ||
        errorMessage.includes('CSP') ||
        errorMessage.includes('CORS')) {
      return ErrorType.SECURITY;
    }

    // Timeout errors
    if (errorMessage.includes('timeout') || 
        errorMessage.includes('Timeout') ||
        errorName === 'TimeoutError') {
      return ErrorType.TIMEOUT;
    }

    return ErrorType.UNKNOWN;
  }

  /**
   * Determine error severity
   */
  private determineSeverity(type: ErrorType, error: Error | string): ErrorSeverity {
    switch (type) {
      case ErrorType.SECURITY:
      case ErrorType.PERMISSION:
        return ErrorSeverity.HIGH;
      
      case ErrorType.STORAGE:
      case ErrorType.AI_SERVICE:
        return ErrorSeverity.MEDIUM;
      
      case ErrorType.NETWORK:
      case ErrorType.TIMEOUT:
      case ErrorType.RATE_LIMIT:
        return ErrorSeverity.MEDIUM;
      
      case ErrorType.VALIDATION:
      case ErrorType.AUTOMATION:
        return ErrorSeverity.LOW;
      
      default:
        return ErrorSeverity.MEDIUM;
    }
  }

  /**
   * Get user-friendly error message
   */
  private getUserFriendlyMessage(type: ErrorType, error: Error | string): string {
    const messages = {
      [ErrorType.NETWORK]: 'Unable to connect to the service. Please check your internet connection and try again.',
      [ErrorType.PERMISSION]: 'This action requires additional permissions. Please grant the necessary permissions in your browser settings.',
      [ErrorType.AI_SERVICE]: 'The AI service is temporarily unavailable. Please try again in a few moments.',
      [ErrorType.STORAGE]: 'Unable to save your data. Please check if you have enough storage space available.',
      [ErrorType.VALIDATION]: 'Please check your input and make sure all required fields are filled correctly.',
      [ErrorType.AUTOMATION]: 'Unable to interact with the page. The page structure may have changed or the element is not accessible.',
      [ErrorType.SECURITY]: 'This action was blocked for security reasons. Please check the page permissions.',
      [ErrorType.RATE_LIMIT]: 'Too many requests. Please wait a moment before trying again.',
      [ErrorType.TIMEOUT]: 'The request took too long to complete. Please try again.',
      [ErrorType.UNKNOWN]: 'An unexpected error occurred. Please try again or contact support if the problem persists.'
    };

    return messages[type] || messages[ErrorType.UNKNOWN];
  }

  /**
   * Get recovery actions for error type
   */
  private getRecoveryActions(
    type: ErrorType, 
    error: Error | string, 
    context: ErrorContext
  ): RecoveryAction[] {
    const actions: RecoveryAction[] = [];

    switch (type) {
      case ErrorType.NETWORK:
        actions.push(
          {
            id: 'retry',
            label: 'Retry',
            description: 'Try the action again',
            action: () => this.retryLastAction(context),
            isPrimary: true,
            estimatedTime: 5
          },
          {
            id: 'check_connection',
            label: 'Check Connection',
            description: 'Verify your internet connection',
            action: () => this.checkNetworkConnection()
          }
        );
        break;

      case ErrorType.PERMISSION:
        actions.push(
          {
            id: 'grant_permissions',
            label: 'Grant Permissions',
            description: 'Open extension permissions',
            action: () => this.openPermissionsPage(),
            isPrimary: true,
            requiresPermission: true
          },
          {
            id: 'reload_extension',
            label: 'Reload Extension',
            description: 'Reload the extension',
            action: () => this.reloadExtension()
          }
        );
        break;

      case ErrorType.AI_SERVICE:
        actions.push(
          {
            id: 'retry_ai',
            label: 'Try Again',
            description: 'Retry the AI request',
            action: () => this.retryLastAction(context),
            isPrimary: true,
            estimatedTime: 10
          },
          {
            id: 'use_fallback',
            label: 'Use Offline Mode',
            description: 'Switch to offline suggestions',
            action: () => this.enableOfflineMode()
          }
        );
        break;

      case ErrorType.STORAGE:
        actions.push(
          {
            id: 'clear_cache',
            label: 'Clear Cache',
            description: 'Free up storage space',
            action: () => this.clearCache(),
            isPrimary: true
          },
          {
            id: 'export_data',
            label: 'Export Data',
            description: 'Backup your data',
            action: () => this.exportUserData()
          }
        );
        break;

      case ErrorType.VALIDATION:
        actions.push(
          {
            id: 'fix_input',
            label: 'Review Input',
            description: 'Check and correct your input',
            action: () => this.highlightInvalidFields(),
            isPrimary: true
          }
        );
        break;

      case ErrorType.AUTOMATION:
        actions.push(
          {
            id: 'retry_automation',
            label: 'Retry',
            description: 'Try the automation again',
            action: () => this.retryLastAction(context),
            isPrimary: true
          },
          {
            id: 'manual_mode',
            label: 'Manual Mode',
            description: 'Get manual instructions instead',
            action: () => this.switchToManualMode()
          }
        );
        break;

      case ErrorType.RATE_LIMIT:
        actions.push(
          {
            id: 'wait_retry',
            label: 'Wait and Retry',
            description: 'Wait for rate limit to reset',
            action: () => this.waitAndRetry(context),
            isPrimary: true,
            estimatedTime: 60
          }
        );
        break;

      case ErrorType.TIMEOUT:
        actions.push(
          {
            id: 'retry',
            label: 'Try Again',
            description: 'Retry with longer timeout',
            action: () => this.retryWithLongerTimeout(context),
            isPrimary: true
          }
        );
        break;

      default:
        actions.push(
          {
            id: 'retry_generic',
            label: 'Try Again',
            description: 'Retry the action',
            action: () => this.retryLastAction(context),
            isPrimary: true
          },
          {
            id: 'reload_page',
            label: 'Reload Page',
            description: 'Refresh the current page',
            action: () => window.location.reload()
          }
        );
    }

    // Always add a dismiss action
    actions.push({
      id: 'dismiss',
      label: 'Dismiss',
      description: 'Close this error message',
      action: () => Promise.resolve()
    });

    return actions;
  }

  /**
   * Check if error is retryable
   */
  private isRetryable(type: ErrorType, error: Error | string): boolean {
    const retryableTypes = [
      ErrorType.NETWORK,
      ErrorType.AI_SERVICE,
      ErrorType.TIMEOUT,
      ErrorType.RATE_LIMIT,
      ErrorType.AUTOMATION
    ];

    return retryableTypes.includes(type);
  }

  /**
   * Get maximum retries for error type
   */
  private getMaxRetries(type: ErrorType): number {
    const maxRetries = {
      [ErrorType.NETWORK]: 3,
      [ErrorType.AI_SERVICE]: 2,
      [ErrorType.TIMEOUT]: 2,
      [ErrorType.RATE_LIMIT]: 1,
      [ErrorType.AUTOMATION]: 3,
      [ErrorType.STORAGE]: 1,
      [ErrorType.PERMISSION]: 0,
      [ErrorType.VALIDATION]: 0,
      [ErrorType.SECURITY]: 0,
      [ErrorType.UNKNOWN]: 1
    };

    return maxRetries[type] !== undefined ? maxRetries[type] : this.config.defaultMaxRetries;
  }

  /**
   * Get current retry count for error
   */
  private getRetryCount(errorId: string): number {
    return this.retryAttempts.get(errorId) || 0;
  }

  /**
   * Increment retry count
   */
  incrementRetryCount(errorId: string): void {
    const current = this.retryAttempts.get(errorId) || 0;
    this.retryAttempts.set(errorId, current + 1);
  }

  /**
   * Log error to storage
   */
  private async logError(errorReport: ErrorReport): Promise<void> {
    this.errorLogs.push(errorReport);

    // Keep only the most recent errors
    if (this.errorLogs.length > this.config.maxErrorLogs) {
      this.errorLogs = this.errorLogs.slice(-this.config.maxErrorLogs);
    }

    // Save to chrome storage
    if (typeof chrome !== 'undefined' && chrome.storage) {
      try {
        await chrome.storage.local.set({ 
          errorLogs: this.errorLogs.map(log => ({
            ...log,
            // Don't store the original error object
            originalError: typeof log.originalError === 'string' 
              ? log.originalError 
              : log.originalError.message
          }))
        });
      } catch (error) {
        console.error('Failed to save error logs:', error);
      }
    }
  }

  /**
   * Load error logs from storage
   */
  private async loadErrorLogs(): Promise<void> {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      try {
        const result = await chrome.storage.local.get(['errorLogs']);
        if (result.errorLogs) {
          this.errorLogs = result.errorLogs;
        }
      } catch (error) {
        console.error('Failed to load error logs:', error);
      }
    }
  }

  /**
   * Report error to external service (if configured)
   */
  private async reportError(errorReport: ErrorReport): Promise<void> {
    // This would integrate with an error reporting service
    // For now, just log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error Report:', errorReport);
    }
  }

  /**
   * Generate unique error ID
   */
  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get extension version
   */
  private getExtensionVersion(): string {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      return chrome.runtime.getManifest().version;
    }
    return 'unknown';
  }

  // ============================================================================
  // RECOVERY ACTION IMPLEMENTATIONS
  // ============================================================================

  private async retryLastAction(context: ErrorContext): Promise<void> {
    // This would be implemented to retry the last failed action
    console.log('Retrying last action for context:', context);
  }

  private async checkNetworkConnection(): Promise<void> {
    try {
      await fetch('https://www.google.com/favicon.ico', { mode: 'no-cors' });
      alert('Network connection appears to be working. Please try again.');
    } catch {
      alert('Network connection appears to be down. Please check your internet connection.');
    }
  }

  private async openPermissionsPage(): Promise<void> {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.create({ url: 'chrome://extensions/' });
    }
  }

  private async reloadExtension(): Promise<void> {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.reload();
    }
  }

  private async enableOfflineMode(): Promise<void> {
    // Switch to offline suggestions
    console.log('Switching to offline mode');
  }

  private async clearCache(): Promise<void> {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      await chrome.storage.local.clear();
      alert('Cache cleared successfully. Please reload the extension.');
    }
  }

  private async exportUserData(): Promise<void> {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      const data = await chrome.storage.local.get();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `extension-data-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      
      URL.revokeObjectURL(url);
    }
  }

  private async highlightInvalidFields(): Promise<void> {
    // This would highlight invalid form fields
    console.log('Highlighting invalid fields');
  }

  private async switchToManualMode(): Promise<void> {
    // Switch to manual instructions instead of automation
    console.log('Switching to manual mode');
  }

  private async waitAndRetry(context: ErrorContext): Promise<void> {
    // Wait for rate limit to reset then retry
    setTimeout(() => this.retryLastAction(context), 60000);
  }

  private async retryWithLongerTimeout(context: ErrorContext): Promise<void> {
    // Retry with increased timeout
    console.log('Retrying with longer timeout');
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /**
   * Get error logs for debugging
   */
  getErrorLogs(): ErrorReport[] {
    return [...this.errorLogs];
  }

  /**
   * Clear error logs
   */
  async clearErrorLogs(): Promise<void> {
    this.errorLogs = [];
    this.retryAttempts.clear();
    
    if (typeof chrome !== 'undefined' && chrome.storage) {
      await chrome.storage.local.remove(['errorLogs']);
    }
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ErrorHandlerConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const errorHandler = new ErrorHandler();

export default errorHandler;