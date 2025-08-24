import React from 'react';

export interface ErrorDisplayProps {
  error: Error | string;
  type?: 'network' | 'permission' | 'ai' | 'storage' | 'validation' | 'generic';
  onRetry?: () => void;
  onDismiss?: () => void;
  showDetails?: boolean;
  retryCount?: number;
  maxRetries?: number;
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  error,
  type = 'generic',
  onRetry,
  onDismiss,
  showDetails = false,
  retryCount = 0,
  maxRetries = 3
}) => {
  const errorMessage = typeof error === 'string' ? error : error.message;
  const canRetry = onRetry && retryCount < maxRetries;

  const getErrorConfig = () => {
    switch (type) {
      case 'network':
        return {
          icon: '🌐',
          title: 'Connection Error',
          message: 'Unable to connect to the service. Please check your internet connection.',
          color: '#ff9800',
          backgroundColor: '#fff3e0'
        };
      case 'permission':
        return {
          icon: '🔒',
          title: 'Permission Required',
          message: 'This action requires additional permissions. Please grant access and try again.',
          color: '#f44336',
          backgroundColor: '#ffebee'
        };
      case 'ai':
        return {
          icon: '🤖',
          title: 'AI Service Error',
          message: 'The AI service is temporarily unavailable. Please try again in a moment.',
          color: '#9c27b0',
          backgroundColor: '#f3e5f5'
        };
      case 'storage':
        return {
          icon: '💾',
          title: 'Storage Error',
          message: 'Unable to save or retrieve data. Please check available storage space.',
          color: '#607d8b',
          backgroundColor: '#eceff1'
        };
      case 'validation':
        return {
          icon: '⚠️',
          title: 'Invalid Input',
          message: 'Please check your input and try again.',
          color: '#ff5722',
          backgroundColor: '#fbe9e7'
        };
      default:
        return {
          icon: '❌',
          title: 'Error',
          message: 'An unexpected error occurred.',
          color: '#d32f2f',
          backgroundColor: '#ffebee'
        };
    }
  };

  const config = getErrorConfig();

  return (
    <div style={{
      padding: '16px',
      backgroundColor: config.backgroundColor,
      border: `1px solid ${config.color}20`,
      borderRadius: '8px',
      margin: '8px 0',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <div style={{ fontSize: '20px', flexShrink: 0 }}>
          {config.icon}
        </div>
        
        <div style={{ flex: 1 }}>
          <h4 style={{ 
            margin: '0 0 8px 0', 
            fontSize: '14px', 
            fontWeight: '600',
            color: config.color
          }}>
            {config.title}
          </h4>
          
          <p style={{ 
            margin: '0 0 12px 0', 
            fontSize: '13px', 
            color: '#666',
            lineHeight: '1.4'
          }}>
            {config.message}
          </p>

          {errorMessage !== config.message && (
            <p style={{ 
              margin: '0 0 12px 0', 
              fontSize: '12px', 
              color: '#888',
              fontStyle: 'italic'
            }}>
              {errorMessage}
            </p>
          )}

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {canRetry && (
              <button
                onClick={onRetry}
                style={{
                  padding: '6px 12px',
                  backgroundColor: config.color,
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: '500'
                }}
              >
                Retry {maxRetries - retryCount > 1 && `(${maxRetries - retryCount} left)`}
              </button>
            )}
            
            {onDismiss && (
              <button
                onClick={onDismiss}
                style={{
                  padding: '6px 12px',
                  backgroundColor: 'transparent',
                  color: config.color,
                  border: `1px solid ${config.color}`,
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                Dismiss
              </button>
            )}
          </div>

          {showDetails && typeof error === 'object' && error.stack && (
            <details style={{ marginTop: '12px' }}>
              <summary style={{ 
                cursor: 'pointer', 
                fontSize: '11px', 
                color: '#666',
                userSelect: 'none'
              }}>
                Technical Details
              </summary>
              <pre style={{
                fontSize: '10px',
                color: '#666',
                backgroundColor: '#f5f5f5',
                padding: '8px',
                borderRadius: '4px',
                overflow: 'auto',
                maxHeight: '80px',
                marginTop: '8px',
                whiteSpace: 'pre-wrap'
              }}>
                {error.stack}
              </pre>
            </details>
          )}
        </div>
      </div>
    </div>
  );
};

export default ErrorDisplay;