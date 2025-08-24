import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  showDetails?: boolean;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  retryCount: number;
}

class ErrorBoundary extends Component<Props, State> {
  private maxRetries = 3;

  public state: State = {
    hasError: false,
    retryCount: 0
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({ errorInfo });
    
    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log error details for debugging
    this.logError(error, errorInfo);
  }

  private logError(error: Error, errorInfo: ErrorInfo) {
    const errorDetails = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    };

    // Store error in chrome storage for debugging
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get(['errorLogs'], (result) => {
        const errorLogs = result.errorLogs || [];
        errorLogs.push(errorDetails);
        
        // Keep only last 50 errors
        if (errorLogs.length > 50) {
          errorLogs.splice(0, errorLogs.length - 50);
        }
        
        chrome.storage.local.set({ errorLogs });
      });
    }
  }

  private handleRetry = () => {
    if (this.state.retryCount < this.maxRetries) {
      this.setState(prevState => ({
        hasError: false,
        error: undefined,
        errorInfo: undefined,
        retryCount: prevState.retryCount + 1
      }));
    }
  };

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: undefined,
      errorInfo: undefined,
      retryCount: 0
    });
  };

  private getErrorMessage(error?: Error): string {
    if (!error) return 'An unknown error occurred';

    // Provide user-friendly messages for common errors
    if (error.message.includes('Network')) {
      return 'Network connection error. Please check your internet connection.';
    }
    
    if (error.message.includes('Permission')) {
      return 'Permission denied. Please check extension permissions.';
    }
    
    if (error.message.includes('Storage')) {
      return 'Storage error. Please try clearing extension data.';
    }
    
    if (error.message.includes('AI') || error.message.includes('API')) {
      return 'AI service temporarily unavailable. Please try again later.';
    }

    return 'Something went wrong. Please try again.';
  }

  private getRecoveryActions(): Array<{ label: string; action: () => void; primary?: boolean }> {
    const actions = [];

    // Retry action (if retries available)
    if (this.state.retryCount < this.maxRetries) {
      actions.push({
        label: `Try Again (${this.maxRetries - this.state.retryCount} attempts left)`,
        action: this.handleRetry,
        primary: true
      });
    }

    // Reset action
    actions.push({
      label: 'Reset Extension',
      action: this.handleReset
    });

    // Reload page action
    actions.push({
      label: 'Reload Page',
      action: () => window.location.reload()
    });

    return actions;
  }

  public render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const errorMessage = this.getErrorMessage(this.state.error);
      const recoveryActions = this.getRecoveryActions();

      return (
        <div style={{ 
          padding: '20px', 
          textAlign: 'center',
          color: '#d32f2f',
          backgroundColor: '#ffebee',
          border: '1px solid #ffcdd2',
          borderRadius: '8px',
          margin: '8px',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>⚠️</div>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '600' }}>
            Oops! Something went wrong
          </h3>
          
          <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#666' }}>
            {errorMessage}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
            {recoveryActions.map((action, index) => (
              <button
                key={index}
                onClick={action.action}
                style={{
                  padding: '8px 16px',
                  backgroundColor: action.primary ? '#1976d2' : '#f5f5f5',
                  color: action.primary ? 'white' : '#333',
                  border: action.primary ? 'none' : '1px solid #ddd',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  minWidth: '120px',
                  transition: 'background-color 0.2s'
                }}
                onMouseOver={(e) => {
                  if (action.primary) {
                    e.currentTarget.style.backgroundColor = '#1565c0';
                  } else {
                    e.currentTarget.style.backgroundColor = '#e0e0e0';
                  }
                }}
                onMouseOut={(e) => {
                  if (action.primary) {
                    e.currentTarget.style.backgroundColor = '#1976d2';
                  } else {
                    e.currentTarget.style.backgroundColor = '#f5f5f5';
                  }
                }}
              >
                {action.label}
              </button>
            ))}
          </div>

          {this.props.showDetails && this.state.error && (
            <details style={{ marginTop: '16px', textAlign: 'left' }}>
              <summary style={{ cursor: 'pointer', fontSize: '12px', color: '#666' }}>
                Technical Details
              </summary>
              <pre style={{ 
                fontSize: '10px', 
                color: '#666', 
                backgroundColor: '#f5f5f5', 
                padding: '8px', 
                borderRadius: '4px',
                overflow: 'auto',
                maxHeight: '100px',
                marginTop: '8px'
              }}>
                {this.state.error.message}
                {this.state.error.stack && `\n\nStack:\n${this.state.error.stack}`}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;