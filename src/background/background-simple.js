// Simple background service worker for Chrome Extension
console.log('chromeControl background service worker starting...');

// Keep service worker alive
chrome.runtime.onInstalled.addListener(() => {
  console.log('chromeControl extension installed/updated');

  // Initialize default storage
  chrome.storage.local.get(['customTasks', 'userPreferences'], (result) => {
    if (!result.customTasks) {
      chrome.storage.local.set({ customTasks: {} });
    }
    if (!result.userPreferences) {
      chrome.storage.local.set({
        userPreferences: {
          enabledCategories: [],
          customPatterns: [],
          privacySettings: {
            sharePageContent: true,
            shareFormData: false,
            allowAutomation: false,
            securityLevel: 'cautious',
            excludedDomains: []
          },
          automationPermissions: {},
          aiProvider: 'openai',
          theme: 'auto'
        }
      });
    }
  });
});

// Handle extension icon click to open side panel
chrome.action.onClicked.addListener(async (tab) => {
  try {
    await chrome.sidePanel.open({ tabId: tab.id });
    console.log('Side panel opened');
  } catch (error) {
    console.error('Failed to open side panel:', error);
  }
});

// Listen for messages from content scripts and sidebar
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message.type);

  if (message.type === 'PAGE_CONTENT_EXTRACTED') {
    // Store the extracted content
    chrome.storage.local.set({
      lastExtractedContent: message.content,
      lastExtractionTime: Date.now()
    });
    sendResponse({ success: true });
  } else if (message.type === 'GET_PAGE_CONTENT') {
    // Return stored content
    chrome.storage.local.get(['lastExtractedContent'], (result) => {
      sendResponse({ success: true, content: result.lastExtractedContent });
    });
    return true; // Keep channel open for async response
  } else if (message.type === 'PING') {
    sendResponse({ success: true, status: 'ready' });
  }

  return true;
});

// Keep service worker alive by setting up periodic alarm
chrome.alarms.create('keepAlive', { periodInMinutes: 0.25 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keepAlive') {
    console.log('Service worker keepalive ping');
  }
});

console.log('chromeControl background service worker ready');