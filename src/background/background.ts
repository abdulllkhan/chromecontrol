// Background service worker for the Agentic Chrome Extension
import { mcpService } from '../services/mcpService.js';
import { WebsiteContext, PageContent, UserPreferences, CustomTask, MCPContext } from '../types/index.js';

console.log('chromeControl background script loaded');

// Handle extension icon click to open side panel
chrome.action.onClicked.addListener(async (tab) => {
  try {
    // Open the side panel
    await chrome.sidePanel.open({ tabId: tab.id });
  } catch (error) {
    console.error('Failed to open side panel:', error);
  }
});

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
    case 'BUILD_MCP_CONTEXT':
      handleMCPContextBuilding(request, sender, sendResponse);
      break;
    case 'UPDATE_MCP_CONFIG':
      handleMCPConfigUpdate(request, sender, sendResponse);
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

// MCP Context building handler
async function handleMCPContextBuilding(request: any, sender: chrome.runtime.MessageSender, sendResponse: (response: any) => void) {
  try {
    const { websiteContext, pageContent, includeUserPreferences, includeCustomTasks } = request;
    
    let userPreferences: UserPreferences | undefined;
    let customTasks: CustomTask[] | undefined;
    
    // Load additional data if requested
    if (includeUserPreferences) {
      const result = await chrome.storage.local.get(['userPreferences']);
      userPreferences = result.userPreferences;
    }
    
    if (includeCustomTasks) {
      const result = await chrome.storage.local.get(['customTasks']);
      customTasks = result.customTasks ? Object.values(result.customTasks) : [];
    }
    
    // Build MCP context
    const mcpContext = await mcpService.buildMCPContext(
      websiteContext,
      pageContent,
      userPreferences,
      customTasks
    );
    
    sendResponse({ 
      success: true, 
      mcpContext,
      message: 'MCP context built successfully'
    });
  } catch (error) {
    console.error('Failed to build MCP context:', error);
    sendResponse({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Failed to build MCP context'
    });
  }
}

// MCP Configuration update handler
async function handleMCPConfigUpdate(request: any, sender: chrome.runtime.MessageSender, sendResponse: (response: any) => void) {
  try {
    const { config, serverConfig, operation } = request;
    
    if (config) {
      mcpService.updateConfig(config);
    }
    
    if (serverConfig && operation) {
      switch (operation) {
        case 'add':
          mcpService.addServerConfig(serverConfig);
          break;
        case 'remove':
          mcpService.removeServerConfig(serverConfig.name);
          break;
        default:
          throw new Error(`Unknown server config operation: ${operation}`);
      }
    }
    
    sendResponse({ 
      success: true, 
      config: mcpService.getConfig(),
      serverConfigs: mcpService.getServerConfigs(),
      message: 'MCP configuration updated successfully'
    });
  } catch (error) {
    console.error('Failed to update MCP configuration:', error);
    sendResponse({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Failed to update MCP configuration'
    });
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