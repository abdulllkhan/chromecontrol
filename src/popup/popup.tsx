import React from 'react';
import { createRoot } from 'react-dom/client';
import ErrorBoundary from '../components/ErrorBoundary';

export const PopupApp: React.FC = () => {
  return (
    <ErrorBoundary>
      <div style={{ padding: '16px' }}>
        <h2>ChromeControl</h2>
        <p>Chrome extension is ready! UI components will be implemented in later tasks.</p>
      </div>
    </ErrorBoundary>
  );
};

// Initialize React app
const container = document.getElementById('popup-root');
if (container) {
  const root = createRoot(container);
  root.render(<PopupApp />);
}