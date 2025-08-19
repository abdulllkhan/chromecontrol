// Content script for the Agentic Chrome Extension
console.log('Agentic Chrome Extension content script loaded');

// Basic page analysis functionality (to be expanded in later tasks)
function analyzeCurrentPage() {
  return {
    url: window.location.href,
    title: document.title,
    domain: window.location.hostname
  };
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.type) {
    case 'GET_PAGE_INFO':
      sendResponse(analyzeCurrentPage());
      break;
    default:
      sendResponse({ error: 'Unknown request type' });
  }
  
  return true;
});