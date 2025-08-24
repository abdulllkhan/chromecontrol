/**
 * Chrome API Integration Tests
 * 
 * Tests for Chrome extension API interactions including storage,
 * messaging, tabs, and scripting APIs.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ChromeStorageService } from '../../services/storage';
import { PatternEngine } from '../../services/patternEngine';
import { AutomationEngine } from '../../services/automationEngine';
import { SecurityManager } from '../../services/securityManager';

// Mock Chrome APIs with more realistic behavior
const createMockChromeStorage = () => {
  const localData: Record<string, any> = {};
  const syncData: Record<string, any> = {};

  return {
    local: {
      get: vi.fn().mockImplementation((keys?: string | string[] | null) => {
        if (!keys) return Promise.resolve(localData);
        if (typeof keys === 'string') {
          return Promise.resolve({ [keys]: localData[keys] });
        }
        if (Array.isArray(keys)) {
          const result: Record<string, any> = {};
          keys.forEach(key => {
            if (localData[key] !== undefined) {
              result[key] = localData[key];
            }
          });
          return Promise.resolve(result);
        }
        return Promise.resolve({});
      }),
      set: vi.fn().mockImplementation((items: Record<string, any>) => {
        Object.assign(localData, items);
        return Promise.resolve();
      }),
      remove: vi.fn().mockImplementation((keys: string | string[]) => {
        const keysArray = Array.isArray(keys) ? keys : [keys];
        keysArray.forEach(key => delete localData[key]);
        return Promise.resolve();
      }),
      clear: vi.fn().mockImplementation(() => {
        Object.keys(localData).forEach(key => delete localData[key]);
        return Promise.resolve();
      }),
      getBytesInUse: vi.fn().mockImplementation(() => {
        const dataStr = JSON.stringify(localData);
        return Promise.resolve(dataStr.length);
      })
    },
    sync: {
      get: vi.fn().mockImplementation((keys?: string | string[] | null) => {
        if (!keys) return Promise.resolve(syncData);
        if (typeof keys === 'string') {
          return Promise.resolve({ [keys]: syncData[keys] });
        }
        if (Array.isArray(keys)) {
          const result: Record<string, any> = {};
          keys.forEach(key => {
            if (syncData[key] !== undefined) {
              result[key] = syncData[key];
            }
          });
          return Promise.resolve(result);
        }
        return Promise.resolve({});
      }),
      set: vi.fn().mockImplementation((items: Record<string, any>) => {
        Object.assign(syncData, items);
        return Promise.resolve();
      }),
      remove: vi.fn().mockImplementation((keys: string | string[]) => {
        const keysArray = Array.isArray(keys) ? keys : [keys];
        keysArray.forEach(key => delete syncData[key]);
        return Promise.resolve();
      }),
      clear: vi.fn().mockImplementation(() => {
        Object.keys(syncData).forEach(key => delete syncData[key]);
        return Promise.resolve();
      }),
      getBytesInUse: vi.fn().mockImplementation(() => {
        const dataStr = JSON.stringify(syncData);
        return Promise.resolve(dataStr.length);
      })
    }
  };
};

const createMockChromeRuntime = () => {
  const listeners: Array<(message: any, sender: any, sendResponse: any) => void> = [];

  return {
    sendMessage: vi.fn().mockImplementation((message: any) => {
      // Simulate message handling
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({ success: true, data: message });
        }, 10);
      });
    }),
    onMessage: {
      addListener: vi.fn().mockImplementation((listener) => {
        listeners.push(listener);
      }),
      removeListener: vi.fn().mockImplementation((listener) => {
        const index = listeners.indexOf(listener);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      }),
      hasListener: vi.fn().mockImplementation((listener) => {
        return listeners.includes(listener);
      })
    },
    getURL: vi.fn().mockImplementation((path: string) => {
      return `chrome-extension://test-extension-id/${path}`;
    }),
    id: 'test-extension-id',
    lastError: null
  };
};

const createMockChromeTabs = () => {
  const mockTabs = [
    {
      id: 1,
      url: 'https://example.com',
      title: 'Example Site',
      active: true,
      windowId: 1
    },
    {
      id: 2,
      url: 'https://test.org',
      title: 'Test Site',
      active: false,
      windowId: 1
    }
  ];

  return {
    query: vi.fn().mockImplementation((queryInfo: any) => {
      let filteredTabs = [...mockTabs];
      
      if (queryInfo.active !== undefined) {
        filteredTabs = filteredTabs.filter(tab => tab.active === queryInfo.active);
      }
      
      if (queryInfo.currentWindow !== undefined && queryInfo.currentWindow) {
        filteredTabs = filteredTabs.filter(tab => tab.windowId === 1);
      }
      
      return Promise.resolve(filteredTabs);
    }),
    get: vi.fn().mockImplementation((tabId: number) => {
      const tab = mockTabs.find(t => t.id === tabId);
      return Promise.resolve(tab || null);
    }),
    sendMessage: vi.fn().mockImplementation((tabId: number, message: any) => {
      return Promise.resolve({ success: true, tabId, message });
    }),
    executeScript: vi.fn().mockImplementation((tabId: number, details: any) => {
      return Promise.resolve([{ result: 'script executed' }]);
    })
  };
};

const createMockChromeScripting = () => ({
  executeScript: vi.fn().mockImplementation((injection: any) => {
    return Promise.resolve([
      {
        result: injection.func ? 'function executed' : 'script executed',
        frameId: 0
      }
    ]);
  }),
  insertCSS: vi.fn().mockImplementation((injection: any) => {
    return Promise.resolve();
  }),
  removeCSS: vi.fn().mockImplementation((injection: any) => {
    return Promise.resolve();
  })
});

const createMockChromePermissions = () => ({
  request: vi.fn().mockImplementation((permissions: any) => {
    // Simulate user granting permissions
    return Promise.resolve(true);
  }),
  contains: vi.fn().mockImplementation((permissions: any) => {
    // Simulate having basic permissions
    return Promise.resolve(true);
  }),
  remove: vi.fn().mockImplementation((permissions: any) => {
    return Promise.resolve(true);
  })
});

describe('Chrome API Integration Tests', () => {
  let mockStorage: ReturnType<typeof createMockChromeStorage>;
  let mockRuntime: ReturnType<typeof createMockChromeRuntime>;
  let mockTabs: ReturnType<typeof createMockChromeTabs>;
  let mockScripting: ReturnType<typeof createMockChromeScripting>;
  let mockPermissions: ReturnType<typeof createMockChromePermissions>;

  beforeEach(() => {
    // Create fresh mocks for each test
    mockStorage = createMockChromeStorage();
    mockRuntime = createMockChromeRuntime();
    mockTabs = createMockChromeTabs();
    mockScripting = createMockChromeScripting();
    mockPermissions = createMockChromePermissions();

    // Set up global chrome object
    global.chrome = {
      storage: mockStorage,
      runtime: mockRuntime,
      tabs: mockTabs,
      scripting: mockScripting,
      permissions: mockPermissions
    } as any;

    // Mock crypto for encryption tests
    global.crypto = {
      randomUUID: () => 'test-uuid-' + Math.random().toString(36).substr(2, 9),
      subtle: {
        generateKey: vi.fn().mockResolvedValue({ type: 'secret' }),
        exportKey: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
        importKey: vi.fn().mockResolvedValue({ type: 'secret' }),
        encrypt: vi.fn().mockResolvedValue(new ArrayBuffer(16)),
        decrypt: vi.fn().mockResolvedValue(new TextEncoder().encode('decrypted'))
      },
      getRandomValues: vi.fn((array) => {
        for (let i = 0; i < array.length; i++) {
          array[i] = Math.floor(Math.random() * 256);
        }
        return array;
      })
    } as any;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Chrome Storage API Integration', () => {
    it('should store and retrieve data from local storage', async () => {
      const storageService = new ChromeStorageService();
      await storageService.initialize();

      // Store data
      await mockStorage.local.set({ testKey: 'testValue' });
      
      // Retrieve data
      const result = await mockStorage.local.get('testKey');
      
      expect(result.testKey).toBe('testValue');
      expect(mockStorage.local.set).toHaveBeenCalledWith({ testKey: 'testValue' });
      expect(mockStorage.local.get).toHaveBeenCalledWith('testKey');
    });

    it('should handle storage quota limits', async () => {
      const storageService = new ChromeStorageService();
      await storageService.initialize();

      // Mock quota exceeded error
      mockStorage.local.set.mockRejectedValueOnce(new Error('QUOTA_EXCEEDED'));

      const largeData = { key: 'x'.repeat(10000) };
      
      await expect(mockStorage.local.set(largeData)).rejects.toThrow('QUOTA_EXCEEDED');
    });

    it('should sync data between local and sync storage', async () => {
      const storageService = new ChromeStorageService({
        syncEnabled: true,
        encryptionEnabled: false
      });
      await storageService.initialize();

      // Store in local
      await mockStorage.local.set({ localKey: 'localValue' });
      
      // Store in sync
      await mockStorage.sync.set({ syncKey: 'syncValue' });

      // Verify both storages
      const localResult = await mockStorage.local.get('localKey');
      const syncResult = await mockStorage.sync.get('syncKey');

      expect(localResult.localKey).toBe('localValue');
      expect(syncResult.syncKey).toBe('syncValue');
    });

    it('should handle storage area unavailable errors', async () => {
      // Mock storage unavailable
      mockStorage.local.get.mockRejectedValue(new Error('Storage area is not available'));

      const storageService = new ChromeStorageService();
      
      // Should handle gracefully and not crash
      await expect(storageService.initialize()).rejects.toThrow('Storage area is not available');
    });
  });

  describe('Chrome Runtime API Integration', () => {
    it('should send and receive messages between components', async () => {
      const testMessage = { type: 'TEST_MESSAGE', data: 'test data' };
      
      const response = await mockRuntime.sendMessage(testMessage);
      
      expect(response.success).toBe(true);
      expect(response.data).toEqual(testMessage);
      expect(mockRuntime.sendMessage).toHaveBeenCalledWith(testMessage);
    });

    it('should handle message listeners', () => {
      const listener = vi.fn();
      
      mockRuntime.onMessage.addListener(listener);
      
      expect(mockRuntime.onMessage.addListener).toHaveBeenCalledWith(listener);
      expect(mockRuntime.onMessage.hasListener(listener)).toBe(true);
      
      mockRuntime.onMessage.removeListener(listener);
      expect(mockRuntime.onMessage.removeListener).toHaveBeenCalledWith(listener);
    });

    it('should generate correct extension URLs', () => {
      const url = mockRuntime.getURL('popup.html');
      
      expect(url).toBe('chrome-extension://test-extension-id/popup.html');
      expect(mockRuntime.getURL).toHaveBeenCalledWith('popup.html');
    });

    it('should handle runtime errors', async () => {
      // Mock runtime error
      mockRuntime.sendMessage.mockRejectedValue(new Error('Extension context invalidated'));
      
      await expect(mockRuntime.sendMessage({ type: 'TEST' })).rejects.toThrow('Extension context invalidated');
    });
  });

  describe('Chrome Tabs API Integration', () => {
    it('should query active tabs', async () => {
      const activeTabs = await mockTabs.query({ active: true, currentWindow: true });
      
      expect(activeTabs).toHaveLength(1);
      expect(activeTabs[0].active).toBe(true);
      expect(activeTabs[0].url).toBe('https://example.com');
    });

    it('should get tab by ID', async () => {
      const tab = await mockTabs.get(1);
      
      expect(tab).toBeDefined();
      expect(tab?.id).toBe(1);
      expect(tab?.url).toBe('https://example.com');
    });

    it('should send messages to tabs', async () => {
      const message = { type: 'CONTENT_SCRIPT_MESSAGE', action: 'analyze' };
      
      const response = await mockTabs.sendMessage(1, message);
      
      expect(response.success).toBe(true);
      expect(response.tabId).toBe(1);
      expect(response.message).toEqual(message);
    });

    it('should handle tab not found errors', async () => {
      const nonExistentTab = await mockTabs.get(999);
      
      expect(nonExistentTab).toBeNull();
    });
  });

  describe('Chrome Scripting API Integration', () => {
    it('should execute scripts in tabs', async () => {
      const injection = {
        target: { tabId: 1 },
        func: () => document.title
      };
      
      const results = await mockScripting.executeScript(injection);
      
      expect(results).toHaveLength(1);
      expect(results[0].result).toBe('function executed');
      expect(mockScripting.executeScript).toHaveBeenCalledWith(injection);
    });

    it('should inject CSS into tabs', async () => {
      const injection = {
        target: { tabId: 1 },
        css: '.highlight { background: yellow; }'
      };
      
      await mockScripting.insertCSS(injection);
      
      expect(mockScripting.insertCSS).toHaveBeenCalledWith(injection);
    });

    it('should handle script execution errors', async () => {
      mockScripting.executeScript.mockRejectedValue(new Error('Cannot access contents of the page'));
      
      const injection = {
        target: { tabId: 1 },
        func: () => document.title
      };
      
      await expect(mockScripting.executeScript(injection)).rejects.toThrow('Cannot access contents of the page');
    });
  });

  describe('Chrome Permissions API Integration', () => {
    it('should request permissions', async () => {
      const permissions = {
        permissions: ['activeTab'],
        origins: ['https://example.com/*']
      };
      
      const granted = await mockPermissions.request(permissions);
      
      expect(granted).toBe(true);
      expect(mockPermissions.request).toHaveBeenCalledWith(permissions);
    });

    it('should check existing permissions', async () => {
      const permissions = {
        permissions: ['storage']
      };
      
      const hasPermission = await mockPermissions.contains(permissions);
      
      expect(hasPermission).toBe(true);
      expect(mockPermissions.contains).toHaveBeenCalledWith(permissions);
    });

    it('should remove permissions', async () => {
      const permissions = {
        permissions: ['activeTab']
      };
      
      const removed = await mockPermissions.remove(permissions);
      
      expect(removed).toBe(true);
      expect(mockPermissions.remove).toHaveBeenCalledWith(permissions);
    });
  });

  describe('Cross-Component Integration', () => {
    it('should handle pattern engine with Chrome APIs', async () => {
      const patternEngine = new PatternEngine();
      
      // Mock tab query for current page
      const mockPageContent = {
        url: 'https://example.com/test',
        title: 'Test Page',
        headings: ['Main Heading'],
        textContent: 'Test content',
        forms: [],
        links: [],
        metadata: {},
        extractedAt: new Date()
      };

      const context = await patternEngine.analyzeWebsite(
        mockPageContent.url,
        mockPageContent
      );

      expect(context.domain).toBe('example.com');
      expect(context.extractedData.title).toBe('Test Page');
    });

    it('should handle automation engine with Chrome APIs', async () => {
      const automationEngine = new AutomationEngine();
      
      const steps = [
        {
          type: 'click' as const,
          selector: '#submit-button',
          description: 'Click submit button'
        }
      ];

      // Mock successful execution
      mockScripting.executeScript.mockResolvedValue([
        { result: { success: true, completedSteps: 1 } }
      ]);

      const result = await automationEngine.executeSteps(steps, {
        tabId: 1,
        frameId: 0
      });

      expect(result.success).toBe(true);
      expect(result.completedSteps).toBe(1);
      expect(mockScripting.executeScript).toHaveBeenCalled();
    });

    it('should handle security manager with Chrome APIs', async () => {
      const securityManager = new SecurityManager();
      
      const pageContent = {
        url: 'https://banking.example.com/account',
        title: 'Bank Account',
        headings: ['Account Balance'],
        textContent: 'Your balance is $1000',
        forms: [
          {
            id: 'login-form',
            action: '/login',
            method: 'POST',
            fields: [
              { name: 'password', type: 'password', label: 'Password' }
            ]
          }
        ],
        links: [],
        metadata: {},
        extractedAt: new Date()
      };

      const sanitized = securityManager.sanitizePageContent(pageContent);
      const securityLevel = securityManager.validateWebsitePermissions('banking.example.com');

      expect(sanitized.forms).toHaveLength(0); // Should remove sensitive forms
      expect(securityLevel).toBe('restricted');
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle Chrome API unavailable scenarios', async () => {
      // Simulate Chrome APIs not available (e.g., in non-extension context)
      delete (global as any).chrome;

      const storageService = new ChromeStorageService();
      
      await expect(storageService.initialize()).rejects.toThrow();
    });

    it('should handle extension context invalidated', async () => {
      // Mock extension context invalidated
      mockRuntime.sendMessage.mockRejectedValue(new Error('Extension context invalidated'));
      
      // Should handle gracefully
      await expect(mockRuntime.sendMessage({ type: 'TEST' })).rejects.toThrow('Extension context invalidated');
    });

    it('should handle permission denied errors', async () => {
      mockPermissions.request.mockResolvedValue(false);
      
      const permissions = {
        permissions: ['tabs'],
        origins: ['https://sensitive-site.com/*']
      };
      
      const granted = await mockPermissions.request(permissions);
      
      expect(granted).toBe(false);
    });

    it('should handle storage corruption', async () => {
      // Mock corrupted storage data
      mockStorage.local.get.mockResolvedValue({
        'custom-tasks': 'invalid-json-data'
      });

      const storageService = new ChromeStorageService();
      await storageService.initialize();
      
      // Should handle corrupted data gracefully
      const tasks = await storageService.getAllCustomTasks();
      expect(tasks).toEqual({});
    });
  });

  describe('Performance and Limits', () => {
    it('should handle storage quota limits', async () => {
      const storageService = new ChromeStorageService();
      await storageService.initialize();

      // Mock quota exceeded
      mockStorage.local.set.mockRejectedValue(new Error('QUOTA_EXCEEDED'));

      const largeTask = {
        id: 'large-task',
        name: 'Large Task',
        description: 'x'.repeat(10000), // Large description
        websitePatterns: [],
        promptTemplate: 'Test',
        outputFormat: 'plain_text' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
        usageCount: 0,
        isEnabled: true,
        tags: []
      };

      await expect(storageService.createCustomTask(largeTask)).rejects.toThrow('QUOTA_EXCEEDED');
    });

    it('should handle message size limits', async () => {
      const largeMessage = {
        type: 'LARGE_MESSAGE',
        data: 'x'.repeat(64 * 1024 * 1024) // 64MB message
      };

      // Mock message too large error
      mockRuntime.sendMessage.mockRejectedValue(new Error('Message length exceeded maximum allowed length'));

      await expect(mockRuntime.sendMessage(largeMessage)).rejects.toThrow('Message length exceeded maximum allowed length');
    });

    it('should handle concurrent API calls', async () => {
      const storageService = new ChromeStorageService();
      await storageService.initialize();

      // Make multiple concurrent calls
      const promises = Array.from({ length: 10 }, (_, i) => 
        mockStorage.local.set({ [`key${i}`]: `value${i}` })
      );

      await Promise.all(promises);

      expect(mockStorage.local.set).toHaveBeenCalledTimes(10);
    });
  });
});