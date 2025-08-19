// Content script for the Agentic Chrome Extension
console.log('Agentic Chrome Extension content script loaded on:', window.location.href);

// Basic page analysis functionality (to be expanded in later tasks)
function analyzeCurrentPage() {
  const pageData = {
    url: window.location.href,
    title: document.title,
    domain: window.location.hostname,
    pathname: window.location.pathname,
    timestamp: Date.now()
  };
  
  console.log('Page analysis:', pageData);
  return pageData;
}

// Extract basic page content (to be expanded in task 6)
function extractPageContent() {
  return {
    headings: Array.from(document.querySelectorAll('h1, h2, h3')).map(h => h.textContent?.trim()).filter(Boolean),
    links: Array.from(document.querySelectorAll('a[href]')).slice(0, 10).map(a => ({
      text: a.textContent?.trim(),
      href: a.getAttribute('href')
    })),
    forms: Array.from(document.querySelectorAll('form')).length,
    hasLoginForm: document.querySelector('input[type="password"]') !== null,
    metaDescription: document.querySelector('meta[name="description"]')?.getAttribute('content') || ''
  };
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Content script received message:', request.type);
  
  switch (request.type) {
    case 'GET_PAGE_INFO':
      sendResponse(analyzeCurrentPage());
      break;
    case 'GET_PAGE_CONTENT':
      sendResponse(extractPageContent());
      break;
    case 'PAGE_READY':
      // Page is ready for analysis - could trigger automatic analysis here
      console.log('Page ready for analysis');
      sendResponse({ success: true });
      break;
    case 'EXECUTE_AUTOMATION':
      // Placeholder for automation execution (task 11)
      sendResponse({ success: false, message: 'Automation not yet implemented' });
      break;
    default:
      sendResponse({ error: 'Unknown request type' });
  }
  
  return true;
});

// Notify background script that content script is ready
chrome.runtime.sendMessage({ type: 'CONTENT_SCRIPT_READY', url: window.location.href }).catch(() => {
  // Ignore errors if background script is not ready
});

// Monitor for page changes (for single-page applications)
let lastUrl = window.location.href;
const observer = new MutationObserver(() => {
  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href;
    console.log('URL changed to:', lastUrl);
    
    // Notify background script of URL change
    chrome.runtime.sendMessage({ 
      type: 'URL_CHANGED', 
      url: lastUrl,
      pageData: analyzeCurrentPage()
    }).catch(() => {
      // Ignore errors if background script is not ready
    });
  }
});

observer.observe(document.body, { childList: true, subtree: true });