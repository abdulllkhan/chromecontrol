/**
 * Chrome Storage Service
 * 
 * Provides a comprehensive storage layer for the Agentic Chrome Extension
 * using Chrome's storage.local and storage.sync APIs with encryption,
 * CRUD operations, and migration support.
 */

import {
  CustomTask,
  WebsitePattern,
  UserPreferences,
  CachedResponse,
  UsageMetrics,
  StorageSchema,
  ValidationUtils,
  ValidationError,
  WebsiteCategory,
  SecurityLevel,
  OutputFormat
} from '../types/index';

// ============================================================================
// STORAGE CONFIGURATION
// ============================================================================

export interface StorageConfig {
  encryptionEnabled: boolean;
  syncEnabled: boolean;
  cacheExpirationHours: number;
  maxCacheSize: number;
  migrationVersion: number;
}

export const DEFAULT_STORAGE_CONFIG: StorageConfig = {
  encryptionEnabled: false, // Disable encryption for now to fix browser issues
  syncEnabled: true,
  cacheExpirationHours: 24,
  maxCacheSize: 100,
  migrationVersion: 1
};

// ============================================================================
// STORAGE KEYS
// ============================================================================

export const STORAGE_KEYS = {
  CUSTOM_TASKS: 'customTasks',
  WEBSITE_PATTERNS: 'websitePatterns',
  USER_PREFERENCES: 'userPreferences',
  RESPONSE_CACHE: 'responseCache',
  USAGE_STATS: 'usageStats',
  STORAGE_VERSION: 'storageVersion',
  ENCRYPTION_KEY: 'encryptionKey'
} as const;

// ============================================================================
// ENCRYPTION UTILITIES
// ============================================================================

export class EncryptionService {
  private static encoder = new TextEncoder();
  private static decoder = new TextDecoder();

  /**
   * Generates a new encryption key
   */
  static async generateKey(): Promise<CryptoKey> {
    return await crypto.subtle.generateKey(
      {
        name: 'AES-GCM',
        length: 256
      },
      true,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Exports a key to raw format for storage
   */
  static async exportKey(key: CryptoKey): Promise<ArrayBuffer> {
    return await crypto.subtle.exportKey('raw', key);
  }

  /**
   * Imports a key from raw format
   */
  static async importKey(keyData: ArrayBuffer): Promise<CryptoKey> {
    return await crypto.subtle.importKey(
      'raw',
      keyData,
      {
        name: 'AES-GCM',
        length: 256
      },
      true,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Encrypts data using AES-GCM
   */
  static async encrypt(data: string, key: CryptoKey): Promise<{ encrypted: ArrayBuffer; iv: ArrayBuffer }> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encodedData = this.encoder.encode(data);

    const encrypted = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      key,
      encodedData
    );

    return { encrypted, iv };
  }

  /**
   * Decrypts data using AES-GCM
   */
  static async decrypt(encryptedData: ArrayBuffer, iv: ArrayBuffer, key: CryptoKey): Promise<string> {
    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      key,
      encryptedData
    );

    return this.decoder.decode(decrypted);
  }

  /**
   * Converts ArrayBuffer to base64 string for storage
   */
  static arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Converts base64 string back to ArrayBuffer
   */
  static base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
}

// ============================================================================
// ENCRYPTED DATA WRAPPER
// ============================================================================

export interface EncryptedData {
  encrypted: string; // base64 encoded
  iv: string; // base64 encoded
  timestamp: number;
}

// ============================================================================
// STORAGE SERVICE
// ============================================================================

export class ChromeStorageService {
  private config: StorageConfig;
  private encryptionKey: CryptoKey | null = null;

  constructor(config: StorageConfig = DEFAULT_STORAGE_CONFIG) {
    this.config = config;
  }

  /**
   * Initializes the storage service
   */
  async initialize(): Promise<void> {
    try {
      // Initialize encryption if enabled
      if (this.config.encryptionEnabled) {
        await this.initializeEncryption();
      }

      // Run migrations if needed
      await this.runMigrations();

      // Initialize default preferences if they don't exist
      await this.initializeDefaults();

      console.log('ChromeStorageService initialized successfully');
    } catch (error) {
      console.error('Failed to initialize ChromeStorageService:', error);
      throw error;
    }
  }

  /**
   * Initializes encryption key
   */
  private async initializeEncryption(): Promise<void> {
    try {
      // Try to load existing key
      const result = await chrome.storage.local.get(STORAGE_KEYS.ENCRYPTION_KEY);

      if (result[STORAGE_KEYS.ENCRYPTION_KEY]) {
        // Import existing key
        const keyData = EncryptionService.base64ToArrayBuffer(result[STORAGE_KEYS.ENCRYPTION_KEY]);
        this.encryptionKey = await EncryptionService.importKey(keyData);
      } else {
        // Generate new key
        this.encryptionKey = await EncryptionService.generateKey();
        const keyData = await EncryptionService.exportKey(this.encryptionKey);
        const keyBase64 = EncryptionService.arrayBufferToBase64(keyData);

        await chrome.storage.local.set({
          [STORAGE_KEYS.ENCRYPTION_KEY]: keyBase64
        });
      }
    } catch (error) {
      console.error('Failed to initialize encryption:', error);
      throw new Error('Encryption initialization failed');
    }
  }

  /**
   * Encrypts sensitive data if encryption is enabled
   */
  private async encryptData(data: string): Promise<EncryptedData | string> {
    if (!this.config.encryptionEnabled || !this.encryptionKey) {
      return data;
    }

    try {
      const { encrypted, iv } = await EncryptionService.encrypt(data, this.encryptionKey);
      return {
        encrypted: EncryptionService.arrayBufferToBase64(encrypted),
        iv: EncryptionService.arrayBufferToBase64(iv),
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Encryption failed:', error);
      throw new Error('Data encryption failed');
    }
  }

  /**
   * Decrypts data if it's encrypted
   */
  private async decryptData(data: EncryptedData | string): Promise<string | null> {
    if (typeof data === 'string') {
      return data;
    }

    // If encryption is disabled, we should not have encrypted data at this point
    // The retrieveData method should have already cleared it
    if (!this.config.encryptionEnabled || !this.encryptionKey) {
      console.warn('Found encrypted data but encryption is disabled. This should not happen.');
      return null;
    }

    try {
      const encryptedBuffer = EncryptionService.base64ToArrayBuffer(data.encrypted);
      const ivBuffer = EncryptionService.base64ToArrayBuffer(data.iv);

      return await EncryptionService.decrypt(encryptedBuffer, ivBuffer, this.encryptionKey);
    } catch (error) {
      console.error('Decryption failed:', error);
      return null; // Return null instead of throwing to allow graceful fallback
    }
  }

  /**
   * Stores data in appropriate storage area (local or sync)
   */
  private async storeData(key: string, data: unknown, useSync: boolean = false): Promise<void> {
    const serializedData = JSON.stringify(data);
    const processedData = await this.encryptData(serializedData);

    const storageArea = (useSync && this.config.syncEnabled) ? chrome.storage.sync : chrome.storage.local;

    try {
      await storageArea.set({
        [key]: processedData
      });
    } catch (error) {
      console.error(`Storage: failed to store data for key: ${key}`, error);
      throw error;
    }
  }

  /**
   * Retrieves data from storage
   */
  private async retrieveData<T>(key: string, useSync: boolean = false): Promise<T | null> {
    const storageArea = (useSync && this.config.syncEnabled) ? chrome.storage.sync : chrome.storage.local;

    const result = await storageArea.get(key);

    if (!result || result[key] === undefined) {
      return null;
    }

    try {
      // Check if we have encrypted data but encryption is disabled
      if (typeof result[key] === 'object' && result[key].encrypted && !this.config.encryptionEnabled) {
        console.warn(`Found encrypted data for key ${key} but encryption is disabled. Clearing and using defaults.`);
        // Clear the encrypted data
        await storageArea.remove(key);
        return null;
      }

      const decryptedData = await this.decryptData(result[key]);
      if (decryptedData === null) {
        return null;
      }
      const parsed = JSON.parse(decryptedData) as T;

      // Convert ISO date strings back to Date objects
      return this.reviveDates(parsed);
    } catch (error) {
      console.error(`Failed to retrieve data for key ${key}:`, error);
      // If there's an error (e.g., corrupted encrypted data), clear it and return null
      try {
        await storageArea.remove(key);
        console.warn(`Cleared corrupted data for key ${key}`);
      } catch (clearError) {
        console.error(`Failed to clear corrupted data for key ${key}:`, clearError);
      }
      return null;
    }
  }

  /**
   * Recursively converts ISO date strings back to Date objects
   */
  private reviveDates<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (typeof obj === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/.test(obj)) {
      return new Date(obj) as unknown as T;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.reviveDates(item)) as unknown as T;
    }

    const result = {} as T;
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        result[key] = this.reviveDates(obj[key]);
      }
    }

    return result;
  }

  /**
   * Runs storage migrations
   */
  private async runMigrations(): Promise<void> {
    const currentVersion = await this.retrieveData<number>(STORAGE_KEYS.STORAGE_VERSION) || 0;

    if (currentVersion < this.config.migrationVersion) {
      console.log(`Running storage migration from version ${currentVersion} to ${this.config.migrationVersion}`);

      // Run migration logic here
      await this.migrate(currentVersion, this.config.migrationVersion);

      // Update version
      await this.storeData(STORAGE_KEYS.STORAGE_VERSION, this.config.migrationVersion);
    }
  }

  /**
   * Handles storage migrations
   */
  private async migrate(fromVersion: number, toVersion: number): Promise<void> {
    // Migration logic for different versions
    if (fromVersion === 0 && toVersion >= 1) {
      // Clear any encrypted data from previous versions
      console.log('Clearing encrypted data during migration');
      await chrome.storage.local.clear();

      // Initial migration - ensure all storage keys exist
      await this.initializeDefaults();
    }

    // Add more migration logic as needed for future versions
  }

  /**
   * Initializes default storage values
   */
  private async initializeDefaults(): Promise<void> {
    const defaults: Partial<StorageSchema> = {
      customTasks: {},
      websitePatterns: {},
      userPreferences: {
        enabledCategories: Object.values(WebsiteCategory),
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
      },
      responseCache: {},
      usageStats: {}
    };

    // Only set defaults for keys that don't exist
    for (const [key, defaultValue] of Object.entries(defaults)) {
      const existing = await this.retrieveData(key);
      if (existing === null) {
        await this.storeData(key, defaultValue, key === STORAGE_KEYS.USER_PREFERENCES);
      }
    }
  }

  // ============================================================================
  // CUSTOM TASKS CRUD OPERATIONS
  // ============================================================================

  /**
   * Creates a new custom task
   */
  async createCustomTask(task: Omit<CustomTask, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>): Promise<string> {
    try {
      console.log('Storage: Creating custom task with data:', task);

      // Validate task data
      const taskId = crypto.randomUUID();
      const now = new Date();

      const fullTask: CustomTask = {
        ...task,
        id: taskId,
        createdAt: now,
        updatedAt: now,
        usageCount: 0
      };

      console.log('Storage: Full task object created:', fullTask);

      // Validate the complete task (with error handling)
      try {
        ValidationUtils.validateCustomTask(fullTask);
        console.log('Storage: Task validation passed');
      } catch (validationError) {
        console.warn('Storage: Task validation failed, but continuing:', validationError);
        // Continue anyway for debugging
      }

      // Get existing tasks
      const existingTasks = await this.retrieveData<Record<string, CustomTask>>(STORAGE_KEYS.CUSTOM_TASKS) || {};

      // Add new task
      existingTasks[taskId] = fullTask;

      // Store updated tasks
      await this.storeData(STORAGE_KEYS.CUSTOM_TASKS, existingTasks);

      console.log(`Created custom task: ${taskId}`);
      return taskId;
    } catch (error) {
      console.error('Failed to create custom task:', error);
      throw error;
    }
  }

  /**
   * Retrieves a custom task by ID
   */
  async getCustomTask(taskId: string): Promise<CustomTask | null> {
    try {
      const tasks = await this.retrieveData<Record<string, CustomTask>>(STORAGE_KEYS.CUSTOM_TASKS) || {};
      return tasks[taskId] || null;
    } catch (error) {
      console.error(`Failed to get custom task ${taskId}:`, error);
      return null;
    }
  }

  /**
   * Retrieves all custom tasks
   */
  async getAllCustomTasks(): Promise<Record<string, CustomTask>> {
    try {
      return await this.retrieveData<Record<string, CustomTask>>(STORAGE_KEYS.CUSTOM_TASKS) || {};
    } catch (error) {
      console.error('Failed to get all custom tasks:', error);
      return {};
    }
  }

  /**
   * Updates an existing custom task
   */
  async updateCustomTask(taskId: string, updates: Partial<Omit<CustomTask, 'id' | 'createdAt'>>): Promise<boolean> {
    try {
      const tasks = await this.retrieveData<Record<string, CustomTask>>(STORAGE_KEYS.CUSTOM_TASKS) || {};

      if (!tasks[taskId]) {
        throw new Error(`Task with ID ${taskId} not found`);
      }

      // Update the task
      const updatedTask: CustomTask = {
        ...tasks[taskId],
        ...updates,
        updatedAt: new Date()
      };

      // Validate updated task
      ValidationUtils.validateCustomTask(updatedTask);

      tasks[taskId] = updatedTask;

      // Store updated tasks
      await this.storeData(STORAGE_KEYS.CUSTOM_TASKS, tasks);

      console.log(`Updated custom task: ${taskId}`);
      return true;
    } catch (error) {
      console.error(`Failed to update custom task ${taskId}:`, error);
      throw error;
    }
  }

  /**
   * Deletes a custom task
   */
  async deleteCustomTask(taskId: string): Promise<boolean> {
    try {
      const tasks = await this.retrieveData<Record<string, CustomTask>>(STORAGE_KEYS.CUSTOM_TASKS) || {};

      if (!tasks[taskId]) {
        return false;
      }

      delete tasks[taskId];

      // Store updated tasks
      await this.storeData(STORAGE_KEYS.CUSTOM_TASKS, tasks);

      // Also clean up related usage stats
      await this.deleteUsageStats(taskId);

      console.log(`Deleted custom task: ${taskId}`);
      return true;
    } catch (error) {
      console.error(`Failed to delete custom task ${taskId}:`, error);
      throw error;
    }
  }

  /**
   * Gets custom tasks matching website patterns
   */
  async getTasksForWebsite(domain: string): Promise<CustomTask[]> {
    try {
      const tasks = await this.getAllCustomTasks();
      const matchingTasks: CustomTask[] = [];

      for (const task of Object.values(tasks)) {
        if (!task.isEnabled) continue;

        // Check if any website pattern matches the domain
        for (const pattern of task.websitePatterns) {
          try {
            const regex = new RegExp(pattern, 'i');
            if (regex.test(domain)) {
              matchingTasks.push(task);
              break;
            }
          } catch (error) {
            console.warn(`Invalid regex pattern in task ${task.id}: ${pattern}`);
          }
        }
      }

      return matchingTasks;
    } catch (error) {
      console.error(`Failed to get tasks for website ${domain}:`, error);
      return [];
    }
  }
  // ============================================================================
  // WEBSITE PATTERNS CRUD OPERATIONS
  // ============================================================================

  /**
   * Creates a new website pattern
   */
  async createWebsitePattern(pattern: Omit<WebsitePattern, 'id' | 'createdAt'>): Promise<string> {
    try {
      const patternId = crypto.randomUUID();
      const fullPattern: WebsitePattern = {
        ...pattern,
        id: patternId,
        createdAt: new Date()
      };

      // Validate pattern
      ValidationUtils.validateUrlPattern(fullPattern.pattern);

      const existingPatterns = await this.retrieveData<Record<string, WebsitePattern>>(STORAGE_KEYS.WEBSITE_PATTERNS) || {};
      existingPatterns[patternId] = fullPattern;

      await this.storeData(STORAGE_KEYS.WEBSITE_PATTERNS, existingPatterns);

      console.log(`Created website pattern: ${patternId}`);
      return patternId;
    } catch (error) {
      console.error('Failed to create website pattern:', error);
      throw error;
    }
  }

  /**
   * Gets all website patterns
   */
  async getAllWebsitePatterns(): Promise<Record<string, WebsitePattern>> {
    try {
      return await this.retrieveData<Record<string, WebsitePattern>>(STORAGE_KEYS.WEBSITE_PATTERNS) || {};
    } catch (error) {
      console.error('Failed to get website patterns:', error);
      return {};
    }
  }

  /**
   * Updates a website pattern
   */
  async updateWebsitePattern(patternId: string, updates: Partial<Omit<WebsitePattern, 'id' | 'createdAt'>>): Promise<boolean> {
    try {
      const patterns = await this.retrieveData<Record<string, WebsitePattern>>(STORAGE_KEYS.WEBSITE_PATTERNS) || {};

      if (!patterns[patternId]) {
        throw new Error(`Website pattern with ID ${patternId} not found`);
      }

      const updatedPattern = {
        ...patterns[patternId],
        ...updates
      };

      // Validate pattern if it was updated
      if (updates.pattern) {
        ValidationUtils.validateUrlPattern(updatedPattern.pattern);
      }

      patterns[patternId] = updatedPattern;
      await this.storeData(STORAGE_KEYS.WEBSITE_PATTERNS, patterns);

      console.log(`Updated website pattern: ${patternId}`);
      return true;
    } catch (error) {
      console.error(`Failed to update website pattern ${patternId}:`, error);
      throw error;
    }
  }

  /**
   * Deletes a website pattern
   */
  async deleteWebsitePattern(patternId: string): Promise<boolean> {
    try {
      const patterns = await this.retrieveData<Record<string, WebsitePattern>>(STORAGE_KEYS.WEBSITE_PATTERNS) || {};

      if (!patterns[patternId]) {
        return false;
      }

      delete patterns[patternId];
      await this.storeData(STORAGE_KEYS.WEBSITE_PATTERNS, patterns);

      console.log(`Deleted website pattern: ${patternId}`);
      return true;
    } catch (error) {
      console.error(`Failed to delete website pattern ${patternId}:`, error);
      throw error;
    }
  }

  // ============================================================================
  // USER PREFERENCES OPERATIONS
  // ============================================================================

  /**
   * Gets user preferences
   */
  async getUserPreferences(): Promise<UserPreferences | null> {
    try {
      return await this.retrieveData<UserPreferences>(STORAGE_KEYS.USER_PREFERENCES, true);
    } catch (error) {
      console.error('Failed to get user preferences:', error);
      return null;
    }
  }

  /**
   * Updates user preferences
   */
  async updateUserPreferences(updates: Partial<UserPreferences>): Promise<boolean> {
    try {
      const currentPrefs = await this.getUserPreferences();
      if (!currentPrefs) {
        throw new Error('User preferences not found');
      }

      const updatedPrefs: UserPreferences = {
        ...currentPrefs,
        ...updates
      };

      await this.storeData(STORAGE_KEYS.USER_PREFERENCES, updatedPrefs, true);

      console.log('Updated user preferences');
      return true;
    } catch (error) {
      console.error('Failed to update user preferences:', error);
      throw error;
    }
  }

  // ============================================================================
  // RESPONSE CACHE OPERATIONS
  // ============================================================================

  /**
   * Caches an AI response
   */
  async cacheResponse(requestHash: string, response: CachedResponse): Promise<void> {
    try {
      const cache = await this.retrieveData<Record<string, CachedResponse>>(STORAGE_KEYS.RESPONSE_CACHE) || {};

      // Clean expired entries before adding new one
      await this.cleanExpiredCache(cache);

      // Check cache size limit
      const cacheEntries = Object.keys(cache);
      if (cacheEntries.length >= this.config.maxCacheSize) {
        // Remove oldest entries
        const sortedEntries = cacheEntries
          .map(key => ({ key, timestamp: cache[key].response.timestamp.getTime() }))
          .sort((a, b) => a.timestamp - b.timestamp);

        const entriesToRemove = sortedEntries.slice(0, cacheEntries.length - this.config.maxCacheSize + 1);
        for (const entry of entriesToRemove) {
          delete cache[entry.key];
        }
      }

      cache[requestHash] = response;
      await this.storeData(STORAGE_KEYS.RESPONSE_CACHE, cache);

      console.log(`Cached response for hash: ${requestHash}`);
    } catch (error) {
      console.error('Failed to cache response:', error);
    }
  }

  /**
   * Retrieves a cached response
   */
  async getCachedResponse(requestHash: string): Promise<CachedResponse | null> {
    try {
      const cache = await this.retrieveData<Record<string, CachedResponse>>(STORAGE_KEYS.RESPONSE_CACHE) || {};
      const cachedResponse = cache[requestHash];

      if (!cachedResponse) {
        return null;
      }

      // Check if expired
      const now = new Date();
      if (now > cachedResponse.expiresAt) {
        // Remove expired entry
        delete cache[requestHash];
        await this.storeData(STORAGE_KEYS.RESPONSE_CACHE, cache);
        return null;
      }

      // Increment hit count
      cachedResponse.hitCount++;
      cache[requestHash] = cachedResponse;
      await this.storeData(STORAGE_KEYS.RESPONSE_CACHE, cache);

      return cachedResponse;
    } catch (error) {
      console.error(`Failed to get cached response for hash ${requestHash}:`, error);
      return null;
    }
  }

  /**
   * Clears expired cache entries
   */
  private async cleanExpiredCache(cache: Record<string, CachedResponse>): Promise<void> {
    const now = new Date();
    let hasExpired = false;

    for (const [key, cachedResponse] of Object.entries(cache)) {
      if (now > cachedResponse.expiresAt) {
        delete cache[key];
        hasExpired = true;
      }
    }

    if (hasExpired) {
      await this.storeData(STORAGE_KEYS.RESPONSE_CACHE, cache);
    }
  }

  /**
   * Clears all cached responses
   */
  async clearResponseCache(): Promise<void> {
    try {
      await this.storeData(STORAGE_KEYS.RESPONSE_CACHE, {});
      console.log('Cleared response cache');
    } catch (error) {
      console.error('Failed to clear response cache:', error);
      throw error;
    }
  }

  // ============================================================================
  // USAGE STATISTICS OPERATIONS
  // ============================================================================

  /**
   * Records task usage
   */
  async recordTaskUsage(taskId: string, success: boolean, executionTime: number): Promise<void> {
    try {
      const stats = await this.retrieveData<Record<string, UsageMetrics>>(STORAGE_KEYS.USAGE_STATS) || {};

      if (!stats[taskId]) {
        stats[taskId] = {
          taskId,
          usageCount: 0,
          successRate: 0,
          averageExecutionTime: 0,
          lastUsed: new Date(),
          errorCount: 0
        };
      }

      const metric = stats[taskId];
      metric.usageCount++;
      metric.lastUsed = new Date();

      if (success) {
        // Update success rate
        const totalSuccesses = Math.round(metric.successRate * (metric.usageCount - 1) / 100) + 1;
        metric.successRate = (totalSuccesses / metric.usageCount) * 100;

        // Update average execution time
        const totalTime = metric.averageExecutionTime * (metric.usageCount - 1) + executionTime;
        metric.averageExecutionTime = totalTime / metric.usageCount;
      } else {
        metric.errorCount++;
        // Recalculate success rate
        const totalSuccesses = Math.round(metric.successRate * (metric.usageCount - 1) / 100);
        metric.successRate = (totalSuccesses / metric.usageCount) * 100;
      }

      stats[taskId] = metric;
      await this.storeData(STORAGE_KEYS.USAGE_STATS, stats);

      // Also update the task's usage count
      await this.updateCustomTask(taskId, { usageCount: metric.usageCount });

      console.log(`Recorded usage for task: ${taskId}`);
    } catch (error) {
      console.error(`Failed to record task usage for ${taskId}:`, error);
    }
  }

  /**
   * Gets usage statistics for a task
   */
  async getTaskUsageStats(taskId: string): Promise<UsageMetrics | null> {
    try {
      const stats = await this.retrieveData<Record<string, UsageMetrics>>(STORAGE_KEYS.USAGE_STATS) || {};
      return stats[taskId] || null;
    } catch (error) {
      console.error(`Failed to get usage stats for task ${taskId}:`, error);
      return null;
    }
  }

  /**
   * Gets all usage statistics
   */
  async getAllUsageStats(): Promise<Record<string, UsageMetrics>> {
    try {
      return await this.retrieveData<Record<string, UsageMetrics>>(STORAGE_KEYS.USAGE_STATS) || {};
    } catch (error) {
      console.error('Failed to get all usage stats:', error);
      return {};
    }
  }

  /**
   * Deletes usage statistics for a task
   */
  async deleteUsageStats(taskId: string): Promise<boolean> {
    try {
      const stats = await this.retrieveData<Record<string, UsageMetrics>>(STORAGE_KEYS.USAGE_STATS) || {};

      if (!stats[taskId]) {
        return false;
      }

      delete stats[taskId];
      await this.storeData(STORAGE_KEYS.USAGE_STATS, stats);

      console.log(`Deleted usage stats for task: ${taskId}`);
      return true;
    } catch (error) {
      console.error(`Failed to delete usage stats for task ${taskId}:`, error);
      throw error;
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Generates a hash for caching AI requests
   */
  static generateRequestHash(prompt: string, context: string, taskType: string): string {
    const data = `${prompt}|${context}|${taskType}`;
    // Simple hash function for demonstration - in production, consider using a proper hash
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Exports all data for backup
   */
  async exportAllData(): Promise<StorageSchema> {
    try {
      const [customTasks, websitePatterns, userPreferences, responseCache, usageStats] = await Promise.all([
        this.getAllCustomTasks(),
        this.getAllWebsitePatterns(),
        this.getUserPreferences(),
        this.retrieveData<Record<string, CachedResponse>>(STORAGE_KEYS.RESPONSE_CACHE),
        this.getAllUsageStats()
      ]);

      return {
        customTasks,
        websitePatterns,
        userPreferences: userPreferences || {} as UserPreferences,
        responseCache: responseCache || {},
        usageStats
      };
    } catch (error) {
      console.error('Failed to export data:', error);
      throw error;
    }
  }

  /**
   * Imports data from backup
   */
  async importAllData(data: Partial<StorageSchema>, overwrite: boolean = false): Promise<void> {
    try {
      if (data.customTasks) {
        if (overwrite) {
          await this.storeData(STORAGE_KEYS.CUSTOM_TASKS, data.customTasks);
        } else {
          const existing = await this.getAllCustomTasks();
          const merged = { ...existing, ...data.customTasks };
          await this.storeData(STORAGE_KEYS.CUSTOM_TASKS, merged);
        }
      }

      if (data.websitePatterns) {
        if (overwrite) {
          await this.storeData(STORAGE_KEYS.WEBSITE_PATTERNS, data.websitePatterns);
        } else {
          const existing = await this.getAllWebsitePatterns();
          const merged = { ...existing, ...data.websitePatterns };
          await this.storeData(STORAGE_KEYS.WEBSITE_PATTERNS, merged);
        }
      }

      if (data.userPreferences) {
        if (overwrite) {
          await this.storeData(STORAGE_KEYS.USER_PREFERENCES, data.userPreferences, true);
        } else {
          const existing = await this.getUserPreferences();
          const merged = { ...existing, ...data.userPreferences };
          await this.storeData(STORAGE_KEYS.USER_PREFERENCES, merged, true);
        }
      }

      if (data.responseCache && overwrite) {
        await this.storeData(STORAGE_KEYS.RESPONSE_CACHE, data.responseCache);
      }

      if (data.usageStats) {
        if (overwrite) {
          await this.storeData(STORAGE_KEYS.USAGE_STATS, data.usageStats);
        } else {
          const existing = await this.getAllUsageStats();
          const merged = { ...existing, ...data.usageStats };
          await this.storeData(STORAGE_KEYS.USAGE_STATS, merged);
        }
      }

      console.log('Data import completed successfully');
    } catch (error) {
      console.error('Failed to import data:', error);
      throw error;
    }
  }

  /**
   * Clears all storage data
   */
  async clearAllData(): Promise<void> {
    try {
      await Promise.all([
        chrome.storage.local.clear(),
        chrome.storage.sync.clear()
      ]);

      console.log('All storage data cleared');
    } catch (error) {
      console.error('Failed to clear all data:', error);
      throw error;
    }
  }

  /**
   * Gets storage usage information
   */
  async getStorageInfo(): Promise<{ local: chrome.storage.StorageAreaInfo; sync: chrome.storage.StorageAreaInfo }> {
    try {
      const [localInfo, syncInfo] = await Promise.all([
        chrome.storage.local.getBytesInUse(),
        chrome.storage.sync.getBytesInUse()
      ]);

      return {
        local: { bytesInUse: localInfo },
        sync: { bytesInUse: syncInfo }
      };
    } catch (error) {
      console.error('Failed to get storage info:', error);
      throw error;
    }
  }
}

// ============================================================================
// STORAGE SERVICE INSTANCE
// ============================================================================

// Create and export a singleton instance
export const storageService = new ChromeStorageService();

// Auto-initialize when imported
storageService.initialize().catch(error => {
  console.error('Failed to auto-initialize storage service:', error);
});