// Background service worker for the Agentic Chrome Extension
console.log('Agentic Chrome Extension background script loaded');

// Initialize extension on install/startup
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Agentic Chrome Extension installed:', details.reason);
  
  // Initialize default storage if needed
  initializeDefaultStorage();
});

chrome.runtime.onStartup.addListener(() => {
  console.log('Agentic Chrome Extension startup');
});

// Initialize default storage structure
async function initializeDefaultStorage() {
  try {
    const result = await chrome.storage.local.get(['customTasks', 'userPreferences']);
    
    if (!result.customTasks) {
      await chrome.storage.local.set({ customTasks: {} });
    }
    
    if (!result.userPreferences) {
      await chrome.storage.local.set({
        userPreferences: {
          enabledCategories: ['social_media', 'ecommerce', 'professional', 'news_content'],
          customPatterns: [],
          privacySettings: {
            allowSensitiveDataProcessing: false,
            enableAutomation: false
          },
          automationPermissions: {}
        }
      });
    }
  } catch (error) {
    console.error('Failed to initialize storage:', error);
  }
}

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request);
  
  // Handle different message types
  switch (request.type) {
    case 'ANALYZE_PAGE':
      handlePageAnalysis(request, sender, sendResponse);
      break;
    case 'GET_SUGGESTIONS':
      handleGetSuggestions(request, sender, sendResponse);
      break;
    case 'EXECUTE_TASK':
      handleTaskExecution(request, sender, sendResponse);
      break;
    case 'MANAGE_STORAGE':
      handleStorageOperation(request, sender, sendResponse);
      break;
    default:
      sendResponse({ success: false, message: 'Unknown message type' });
  }
  
  return true; // Keep message channel open for async responses
});

// Placeholder handlers for different message types (to be implemented in later tasks)
async function handlePageAnalysis(request: any, sender: chrome.runtime.MessageSender, sendResponse: (response: any) => void) {
  // Will be implemented in task 5 (website pattern recognition)
  sendResponse({ success: true, message: 'Page analysis not yet implemented' });
}

async function handleGetSuggestions(request: any, sender: chrome.runtime.MessageSender, sendResponse: (response: any) => void) {
  // Will be implemented in task 10 (suggestion generation)
  sendResponse({ success: true, suggestions: [], message: 'Suggestion generation not yet implemented' });
}

async function handleTaskExecution(request: any, sender: chrome.runtime.MessageSender, sendResponse: (response: any) => void) {
  // Will be implemented in task 8 (task management system)
  sendResponse({ success: true, message: 'Task execution not yet implemented' });
}

async function handleStorageOperation(request: any, sender: chrome.runtime.MessageSender, sendResponse: (response: any) => void) {
  // Will be implemented in task 4 (storage layer)
  try {
    switch (request.operation) {
      case 'get':
        const data = await chrome.storage.local.get(request.keys);
        sendResponse({ success: true, data });
        break;
      case 'set':
        await chrome.storage.local.set(request.data);
        sendResponse({ success: true });
        break;
      default:
        sendResponse({ success: false, message: 'Unknown storage operation' });
    }
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

// Handle tab updates to trigger page analysis
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // Notify content script that page is ready for analysis
    chrome.tabs.sendMessage(tabId, { type: 'PAGE_READY' }).catch(() => {
      // Ignore errors if content script is not ready
    });
  }
});