// Background service worker for the Agentic Chrome Extension
console.log('Agentic Chrome Extension background script loaded');

// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
  console.log('Agentic Chrome Extension installed');
});

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request);
  
  // Handle different message types
  switch (request.type) {
    case 'ANALYZE_PAGE':
      // Will be implemented in later tasks
      sendResponse({ success: true, message: 'Page analysis not yet implemented' });
      break;
    default:
      sendResponse({ success: false, message: 'Unknown message type' });
  }
  
  return true; // Keep message channel open for async responses
});