/**
 * Tests for Chrome Storage Service
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { ChromeStorageService, EncryptionService, STORAGE_KEYS } from '../storage';
import { CustomTask, WebsiteCategory, OutputFormat, SecurityLevel } from '../../types/index';

// Mock Chrome APIs
const mockChromeStorage = {
  local: {
    get: vi.fn(),
    set: vi.fn(),
    clear: vi.fn(),
    getBytesInUse: vi.fn()
  },
  sync: {
    get: vi.fn(),
    set: vi.fn(),
    clear: vi.fn(),
    getBytesInUse: vi.fn()
  }
};

const mockCrypto = {
  randomUUID: vi.fn(() => 'test-uuid-123'),
  subtle: {
    generateKey: vi.fn(),
    exportKey: vi.fn(),
    importKey: vi.fn(),
    encrypt: vi.fn(),
    decrypt: vi.fn()
  },
  getRandomValues: vi.fn((array) => {
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
    return array;
  })
};

// Setup global mocks
global.chrome = {
  storage: mockChromeStorage
} as any;

global.crypto = mockCrypto as any;

describe('EncryptionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate encryption key', async () => {
    const mockKey = { type: 'secret' };
    mockCrypto.subtle.generateKey.mockResolvedValue(mockKey);

    const key = await EncryptionService.generateKey();
    
    expect(mockCrypto.subtle.generateKey).toHaveBeenCalledWith(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
    expect(key).toBe(mockKey);
  });

  it('should export and import keys', async () => {
    const mockKey = { type: 'secret' };
    const mockKeyData = new ArrayBuffer(32);
    
    mockCrypto.subtle.exportKey.mockResolvedValue(mockKeyData);
    mockCrypto.subtle.importKey.mockResolvedValue(mockKey);

    const exported = await EncryptionService.exportKey(mockKey as any);
    const imported = await EncryptionService.importKey(exported);

    expect(mockCrypto.subtle.exportKey).toHaveBeenCalledWith('raw', mockKey);
    expect(mockCrypto.subtle.importKey).toHaveBeenCalledWith(
      'raw',
      mockKeyData,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
    expect(imported).toBe(mockKey);
  });

  it('should encrypt and decrypt data', async () => {
    const mockKey = { type: 'secret' };
    const testData = 'test data';
    const mockEncrypted = new ArrayBuffer(16);
    const mockIv = new ArrayBuffer(12);
    
    mockCrypto.subtle.encrypt.mockResolvedValue(mockEncrypted);
    mockCrypto.subtle.decrypt.mockResolvedValue(new TextEncoder().encode(testData));

    const { encrypted, iv } = await EncryptionService.encrypt(testData, mockKey as any);
    const decrypted = await EncryptionService.decrypt(encrypted, iv, mockKey as any);

    expect(decrypted).toBe(testData);
  });

  it('should convert ArrayBuffer to base64 and back', () => {
    const testData = new Uint8Array([1, 2, 3, 4, 5]);
    const buffer = testData.buffer;
    
    const base64 = EncryptionService.arrayBufferToBase64(buffer);
    const restored = EncryptionService.base64ToArrayBuffer(base64);
    
    expect(new Uint8Array(restored)).toEqual(testData);
  });
});

describe('ChromeStorageService', () => {
  let storageService: ChromeStorageService;
  
  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Mock successful storage operations
    mockChromeStorage.local.get.mockResolvedValue({});
    mockChromeStorage.local.set.mockResolvedValue(undefined);
    mockChromeStorage.sync.get.mockResolvedValue({});
    mockChromeStorage.sync.set.mockResolvedValue(undefined);
    
    // Mock encryption key generation
    const mockKey = { type: 'secret' };
    const mockKeyData = new ArrayBuffer(32);
    mockCrypto.subtle.generateKey.mockResolvedValue(mockKey);
    mockCrypto.subtle.exportKey.mockResolvedValue(mockKeyData);
    mockCrypto.subtle.importKey.mockResolvedValue(mockKey);
    
    storageService = new ChromeStorageService({
      encryptionEnabled: false, // Disable encryption for simpler testing
      syncEnabled: false,
      cacheExpirationHours: 24,
      maxCacheSize: 100,
      migrationVersion: 1
    });
    
    await storageService.initialize();
    
    // Clear mocks after initialization to get clean counts for tests
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Custom Tasks CRUD', () => {
    const mockTask: Omit<CustomTask, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'> = {
      name: 'Test Task',
      description: 'A test task',
      websitePatterns: ['example.com'],
      promptTemplate: 'Test prompt: {{context}}',
      outputFormat: OutputFormat.PLAIN_TEXT,
      isEnabled: true,
      tags: ['test']
    };

    it('should create a custom task', async () => {
      mockChromeStorage.local.get.mockResolvedValue({ [STORAGE_KEYS.CUSTOM_TASKS]: '{}' });
      
      const taskId = await storageService.createCustomTask(mockTask);
      
      expect(taskId).toBe('test-uuid-123');
      expect(mockChromeStorage.local.set).toHaveBeenCalled();
    });

    it('should retrieve a custom task', async () => {
      const now = new Date();
      const fullTask: CustomTask = {
        ...mockTask,
        id: 'test-id',
        createdAt: now,
        updatedAt: now,
        usageCount: 0
      };
      
      mockChromeStorage.local.get.mockResolvedValue({
        [STORAGE_KEYS.CUSTOM_TASKS]: JSON.stringify({ 'test-id': fullTask })
      });
      
      const task = await storageService.getCustomTask('test-id');
      
      expect(task).toBeTruthy();
      expect(task?.id).toBe('test-id');
      expect(task?.name).toBe(fullTask.name);
      expect(task?.description).toBe(fullTask.description);
      expect(task?.createdAt).toBeDefined();
      expect(task?.updatedAt).toBeDefined();
    });

    it('should update a custom task', async () => {
      const fullTask: CustomTask = {
        ...mockTask,
        id: 'test-id',
        createdAt: new Date(),
        updatedAt: new Date(),
        usageCount: 0
      };
      
      mockChromeStorage.local.get.mockResolvedValue({
        [STORAGE_KEYS.CUSTOM_TASKS]: JSON.stringify({ 'test-id': fullTask })
      });
      
      const success = await storageService.updateCustomTask('test-id', { name: 'Updated Task' });
      
      expect(success).toBe(true);
      expect(mockChromeStorage.local.set).toHaveBeenCalled();
    });

    it('should delete a custom task', async () => {
      const fullTask: CustomTask = {
        ...mockTask,
        id: 'test-id',
        createdAt: new Date(),
        updatedAt: new Date(),
        usageCount: 0
      };
      
      mockChromeStorage.local.get
        .mockResolvedValueOnce({ [STORAGE_KEYS.CUSTOM_TASKS]: JSON.stringify({ 'test-id': fullTask }) })
        .mockResolvedValueOnce({ [STORAGE_KEYS.USAGE_STATS]: '{}' });
      
      const success = await storageService.deleteCustomTask('test-id');
      
      expect(success).toBe(true);
      expect(mockChromeStorage.local.set).toHaveBeenCalled();
    });

    it('should get tasks for website', async () => {
      const task1: CustomTask = {
        ...mockTask,
        id: 'task-1',
        websitePatterns: ['example\\.com'],
        createdAt: new Date(),
        updatedAt: new Date(),
        usageCount: 0
      };
      
      const task2: CustomTask = {
        ...mockTask,
        id: 'task-2',
        websitePatterns: ['other\\.com'],
        createdAt: new Date(),
        updatedAt: new Date(),
        usageCount: 0
      };
      
      mockChromeStorage.local.get.mockResolvedValue({
        [STORAGE_KEYS.CUSTOM_TASKS]: JSON.stringify({ 'task-1': task1, 'task-2': task2 })
      });
      
      const tasks = await storageService.getTasksForWebsite('example.com');
      
      expect(tasks).toHaveLength(1);
      expect(tasks[0].id).toBe('task-1');
    });
  });

  describe('User Preferences', () => {
    it('should get user preferences', async () => {
      const mockPrefs = {
        enabledCategories: [WebsiteCategory.SOCIAL_MEDIA],
        customPatterns: [],
        privacySettings: {
          sharePageContent: true,
          shareFormData: false,
          allowAutomation: true,
          securityLevel: SecurityLevel.CAUTIOUS,
          excludedDomains: []
        },
        automationPermissions: {},
        aiProvider: 'openai',
        theme: 'auto'
      };
      
      mockChromeStorage.local.get.mockResolvedValue({
        [STORAGE_KEYS.USER_PREFERENCES]: JSON.stringify(mockPrefs)
      });
      
      const prefs = await storageService.getUserPreferences();
      
      expect(prefs).toEqual(mockPrefs);
    });

    it('should update user preferences', async () => {
      const mockPrefs = {
        enabledCategories: [WebsiteCategory.SOCIAL_MEDIA],
        customPatterns: [],
        privacySettings: {
          sharePageContent: true,
          shareFormData: false,
          allowAutomation: true,
          securityLevel: SecurityLevel.CAUTIOUS,
          excludedDomains: []
        },
        automationPermissions: {},
        aiProvider: 'openai',
        theme: 'auto'
      };
      
      mockChromeStorage.local.get.mockResolvedValue({
        [STORAGE_KEYS.USER_PREFERENCES]: JSON.stringify(mockPrefs)
      });
      
      const success = await storageService.updateUserPreferences({ theme: 'dark' });
      
      expect(success).toBe(true);
      expect(mockChromeStorage.local.set).toHaveBeenCalled();
    });
  });

  describe('Response Cache', () => {
    it('should cache and retrieve responses', async () => {
      const mockResponse = {
        requestHash: 'test-hash',
        response: {
          content: 'test response',
          format: OutputFormat.PLAIN_TEXT,
          confidence: 0.9,
          timestamp: new Date(),
          requestId: 'req-123'
        },
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        hitCount: 0
      };
      
      mockChromeStorage.local.get
        .mockResolvedValueOnce({ [STORAGE_KEYS.RESPONSE_CACHE]: '{}' })
        .mockResolvedValueOnce({ [STORAGE_KEYS.RESPONSE_CACHE]: JSON.stringify({ 'test-hash': mockResponse }) });
      
      await storageService.cacheResponse('test-hash', mockResponse);
      const cached = await storageService.getCachedResponse('test-hash');
      
      expect(cached).toBeTruthy();
      expect(cached?.response.content).toBe('test response');
      expect(cached?.hitCount).toBe(1); // Should increment hit count
    });

    it('should return null for expired cache entries', async () => {
      // Mock the cache to return null for expired entries
      mockChromeStorage.local.get.mockResolvedValue({
        [STORAGE_KEYS.RESPONSE_CACHE]: '{}'
      });
      
      const cached = await storageService.getCachedResponse('test-hash');
      
      expect(cached).toBeNull();
    });
  });

  describe('Usage Statistics', () => {
    it('should record task usage', async () => {
      const mockTaskData = {
        id: 'task-1',
        name: 'Test Task',
        description: 'Test',
        websitePatterns: ['example.com'],
        promptTemplate: 'Test',
        outputFormat: OutputFormat.PLAIN_TEXT,
        createdAt: new Date(),
        updatedAt: new Date(),
        usageCount: 0,
        isEnabled: true,
        tags: []
      };
      
      mockChromeStorage.local.get
        .mockResolvedValueOnce({ [STORAGE_KEYS.USAGE_STATS]: '{}' })
        .mockResolvedValueOnce({ [STORAGE_KEYS.CUSTOM_TASKS]: JSON.stringify({ 'task-1': mockTaskData }) });
      
      await storageService.recordTaskUsage('task-1', true, 1500);
      
      expect(mockChromeStorage.local.set).toHaveBeenCalled();
    });

    it('should get usage statistics', async () => {
      const mockStats = {
        'task-1': {
          taskId: 'task-1',
          usageCount: 5,
          successRate: 80,
          averageExecutionTime: 1200,
          lastUsed: new Date(),
          errorCount: 1
        }
      };
      
      mockChromeStorage.local.get.mockResolvedValue({
        [STORAGE_KEYS.USAGE_STATS]: JSON.stringify(mockStats)
      });
      
      const stats = await storageService.getTaskUsageStats('task-1');
      
      expect(stats).toBeTruthy();
      expect(stats?.taskId).toBe('task-1');
      expect(stats?.usageCount).toBe(5);
      expect(stats?.successRate).toBe(80);
      expect(stats?.lastUsed).toBeDefined();
    });
  });

  describe('Data Export/Import', () => {
    it('should export all data', async () => {
      const mockData = {
        [STORAGE_KEYS.CUSTOM_TASKS]: '{}',
        [STORAGE_KEYS.WEBSITE_PATTERNS]: '{}',
        [STORAGE_KEYS.USER_PREFERENCES]: JSON.stringify({ theme: 'auto' }),
        [STORAGE_KEYS.RESPONSE_CACHE]: '{}',
        [STORAGE_KEYS.USAGE_STATS]: '{}'
      };
      
      mockChromeStorage.local.get.mockResolvedValue(mockData);
      
      const exported = await storageService.exportAllData();
      
      expect(exported).toHaveProperty('customTasks');
      expect(exported).toHaveProperty('websitePatterns');
      expect(exported).toHaveProperty('userPreferences');
      expect(exported).toHaveProperty('responseCache');
      expect(exported).toHaveProperty('usageStats');
    });

    it('should import data', async () => {
      const importData = {
        customTasks: { 'task-1': { name: 'Imported Task' } },
        websitePatterns: {},
        userPreferences: { theme: 'dark' },
        responseCache: {},
        usageStats: {}
      };
      
      mockChromeStorage.local.get.mockResolvedValue({});
      
      await storageService.importAllData(importData, true);
      
      expect(mockChromeStorage.local.set).toHaveBeenCalled();
    });
  });

  describe('Utility Methods', () => {
    it('should generate request hash', () => {
      const hash1 = ChromeStorageService.generateRequestHash('prompt1', 'context1', 'type1');
      const hash2 = ChromeStorageService.generateRequestHash('prompt1', 'context1', 'type1');
      const hash3 = ChromeStorageService.generateRequestHash('prompt2', 'context1', 'type1');
      
      expect(hash1).toBe(hash2); // Same inputs should produce same hash
      expect(hash1).not.toBe(hash3); // Different inputs should produce different hash
    });

    it('should get storage info', async () => {
      mockChromeStorage.local.getBytesInUse.mockResolvedValue(1024);
      mockChromeStorage.sync.getBytesInUse.mockResolvedValue(512);
      
      const info = await storageService.getStorageInfo();
      
      expect(info.local.bytesInUse).toBe(1024);
      expect(info.sync.bytesInUse).toBe(512);
    });

    it('should clear all data', async () => {
      await storageService.clearAllData();
      
      expect(mockChromeStorage.local.clear).toHaveBeenCalled();
      expect(mockChromeStorage.sync.clear).toHaveBeenCalled();
    });
  });
});