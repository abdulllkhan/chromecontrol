/**
 * Tests for Migration Service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MigrationService, MIGRATIONS } from '../migrations';

describe('MigrationService', () => {
  let migrationService: MigrationService;

  beforeEach(() => {
    migrationService = new MigrationService();
  });

  describe('Migration Execution', () => {
    it('should run migrations from version 0 to 1', async () => {
      const initialData = {};
      
      const result = await migrationService.migrate(initialData, 0, 1);
      
      expect(result.success).toBe(true);
      expect(result.fromVersion).toBe(0);
      expect(result.toVersion).toBe(1);
      expect(result.migrationsRun).toEqual([1]);
      expect(result.errors).toHaveLength(0);
      
      // Check that migration 1 added required fields
      expect(result.data).toHaveProperty('customTasks');
      expect(result.data).toHaveProperty('websitePatterns');
      expect(result.data).toHaveProperty('userPreferences');
      expect(result.data).toHaveProperty('responseCache');
      expect(result.data).toHaveProperty('usageStats');
    });

    it('should run migrations from version 1 to 2', async () => {
      const initialData = {
        customTasks: {
          'task-1': {
            id: 'task-1',
            name: 'Test Task',
            description: 'Test',
            websitePatterns: ['example.com'],
            promptTemplate: 'Test',
            outputFormat: 'plain_text',
            createdAt: new Date().toISOString(),
            usageCount: 0
          }
        },
        websitePatterns: {},
        userPreferences: {},
        responseCache: {},
        usageStats: {}
      };
      
      const result = await migrationService.migrate(initialData, 1, 2);
      
      expect(result.success).toBe(true);
      expect(result.migrationsRun).toEqual([2]);
      
      // Check that migration 2 added tags and other fields
      const task = result.data.customTasks['task-1'];
      expect(task).toHaveProperty('tags');
      expect(task.tags).toEqual([]);
      expect(task).toHaveProperty('isEnabled');
      expect(task.isEnabled).toBe(true);
      expect(task).toHaveProperty('updatedAt');
    });

    it('should run migrations from version 2 to 3', async () => {
      const initialData = {
        customTasks: {},
        websitePatterns: {},
        userPreferences: {
          privacySettings: {
            sharePageContent: true,
            shareFormData: false,
            allowAutomation: true
          }
        },
        responseCache: {
          'hash-1': {
            response: {
              content: 'test',
              format: 'plain_text',
              confidence: 0.9,
              timestamp: new Date(),
              requestId: 'req-1'
            }
          }
        },
        usageStats: {}
      };
      
      const result = await migrationService.migrate(initialData, 2, 3);
      
      expect(result.success).toBe(true);
      expect(result.migrationsRun).toEqual([3]);
      
      // Check that migration 3 added security level to privacy settings
      expect(result.data.userPreferences.privacySettings).toHaveProperty('securityLevel');
      expect(result.data.userPreferences.privacySettings.securityLevel).toBe('cautious');
      expect(result.data.userPreferences.privacySettings).toHaveProperty('excludedDomains');
      expect(result.data.userPreferences.privacySettings.excludedDomains).toEqual([]);
      
      // Check that cached responses got security level
      const cachedResponse = result.data.responseCache['hash-1'];
      expect(cachedResponse.response).toHaveProperty('securityLevel');
      expect(cachedResponse.response.securityLevel).toBe('public');
    });

    it('should run multiple migrations in sequence', async () => {
      const initialData = {};
      
      const result = await migrationService.migrate(initialData, 0, 3);
      
      expect(result.success).toBe(true);
      expect(result.fromVersion).toBe(0);
      expect(result.toVersion).toBe(3);
      expect(result.migrationsRun).toEqual([1, 2, 3]);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle migration errors gracefully', async () => {
      // Create a migration service with a failing migration
      const failingMigrations = [
        {
          version: 1,
          description: 'Failing migration',
          up: async () => {
            throw new Error('Migration failed');
          }
        }
      ];
      
      const failingService = new MigrationService(failingMigrations);
      const result = await failingService.migrate({}, 0, 1);
      
      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Migration 1 failed');
    });

    it('should skip migrations when already at target version', async () => {
      const result = await migrationService.migrate({}, 3, 3);
      
      expect(result.success).toBe(true);
      expect(result.migrationsRun).toHaveLength(0);
    });
  });

  describe('Migration Rollback', () => {
    it('should rollback migrations', async () => {
      const dataWithTags = {
        customTasks: {
          'task-1': {
            id: 'task-1',
            name: 'Test Task',
            tags: ['test', 'example'],
            isEnabled: true,
            updatedAt: new Date().toISOString()
          }
        }
      };
      
      const result = await migrationService.rollback(dataWithTags, 2, 1);
      
      expect(result.success).toBe(true);
      expect(result.migrationsRun).toEqual([2]);
      
      // Check that tags were removed
      const task = result.data.customTasks['task-1'];
      expect(task).not.toHaveProperty('tags');
    });

    it('should handle rollback for migrations without down function', async () => {
      // Migration 1 doesn't have a down function
      const result = await migrationService.rollback({}, 1, 0);
      
      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('does not support rollback');
    });
  });

  describe('Data Validation', () => {
    it('should validate migrated data structure', async () => {
      const validData = {
        customTasks: {
          'task-1': {
            id: 'task-1',
            name: 'Test Task',
            description: 'Test description',
            websitePatterns: ['example.com'],
            promptTemplate: 'Test prompt',
            outputFormat: 'plain_text',
            createdAt: new Date().toISOString(),
            usageCount: 0,
            isEnabled: true,
            tags: ['test']
          }
        },
        websitePatterns: {},
        userPreferences: {
          enabledCategories: ['social_media'],
          customPatterns: [],
          privacySettings: {
            sharePageContent: true,
            shareFormData: false,
            allowAutomation: true,
            securityLevel: 'cautious',
            excludedDomains: []
          },
          automationPermissions: {},
          aiProvider: 'openai',
          theme: 'auto'
        },
        responseCache: {},
        usageStats: {}
      };
      
      const validation = await migrationService.validateMigratedData(validData, 3);
      
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect invalid data structure', async () => {
      const invalidData = {
        customTasks: {
          'task-1': {
            // Missing required fields
            name: 'Test Task'
          }
        }
      };
      
      const validation = await migrationService.validateMigratedData(invalidData, 2);
      
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it('should validate version-specific requirements', async () => {
      const dataWithoutTags = {
        customTasks: {
          'task-1': {
            id: 'task-1',
            name: 'Test Task',
            description: 'Test description',
            websitePatterns: ['example.com'],
            promptTemplate: 'Test prompt',
            outputFormat: 'plain_text',
            createdAt: new Date().toISOString(),
            usageCount: 0,
            isEnabled: true
            // Missing tags field required in version 2+
          }
        },
        websitePatterns: {},
        userPreferences: {
          enabledCategories: ['social_media'],
          customPatterns: [],
          privacySettings: {
            sharePageContent: true,
            shareFormData: false,
            allowAutomation: true
          },
          automationPermissions: {},
          aiProvider: 'openai',
          theme: 'auto'
        },
        responseCache: {},
        usageStats: {}
      };
      
      const validation = await migrationService.validateMigratedData(dataWithoutTags, 2);
      
      expect(validation.valid).toBe(false);
      expect(validation.errors.some(error => error.includes('tags field'))).toBe(true);
    });
  });

  describe('Backup and Restore', () => {
    it('should create backup', async () => {
      const testData = { test: 'data' };
      const { backup, timestamp } = await migrationService.createBackup(testData, 1);
      
      expect(backup).toHaveProperty('version', 1);
      expect(backup).toHaveProperty('timestamp');
      expect(backup).toHaveProperty('data');
      expect(backup.data).toEqual(testData);
      expect(timestamp).toBe(backup.timestamp);
    });

    it('should restore from backup', async () => {
      const originalData = { test: 'data' };
      const backup = {
        version: 1,
        timestamp: new Date().toISOString(),
        data: originalData
      };
      
      const restored = await migrationService.restoreFromBackup(backup);
      
      expect(restored).toEqual(originalData);
    });

    it('should handle invalid backup format', async () => {
      const invalidBackup = { invalid: 'backup' };
      
      await expect(migrationService.restoreFromBackup(invalidBackup))
        .rejects.toThrow('Invalid backup format');
    });
  });

  describe('Utility Methods', () => {
    it('should get latest version', () => {
      const latestVersion = migrationService.getLatestVersion();
      
      expect(latestVersion).toBe(Math.max(...MIGRATIONS.map(m => m.version)));
    });

    it('should handle empty migrations array', () => {
      const emptyService = new MigrationService([]);
      const latestVersion = emptyService.getLatestVersion();
      
      expect(latestVersion).toBe(0);
    });
  });
});