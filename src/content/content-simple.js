// Simple content script without ES modules for Chrome extension compatibility
(function() {
  'use strict';
  
  console.log('chromeControl content script loaded on:', window.location.href);
  
  // Basic page content extraction without imports
  function extractPageContent() {
    return {
      url: window.location.href,
      title: document.title,
      headings: Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).map(h => h.textContent?.trim()).filter(Boolean),
      pageText: document.body?.textContent?.substring(0, 5000) || '',
      domain: window.location.hostname,
      timestamp: new Date().toISOString()
    };
  }
  
  // Send page content to background script
  function sendPageContent() {
    const content = extractPageContent();
    
    // Send to background script
    if (chrome?.runtime?.sendMessage) {
      chrome.runtime.sendMessage({
        type: 'PAGE_CONTENT_EXTRACTED',
        content: content
      }).catch(error => {
        console.log('Failed to send page content:', error);
      });
    }
  }
  
  // Initialize when page is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', sendPageContent);
  } else {
    sendPageContent();
  }
  
  // Listen for messages from popup/background
  if (chrome?.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'EXTRACT_CONTENT') {
        const content = extractPageContent();
        sendResponse({ success: true, content });
      }
      return true;
    });
  }
  
})();