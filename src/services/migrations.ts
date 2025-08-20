/**
 * Storage Migration System
 * 
 * Handles data migrations between different versions of the extension
 * to ensure backward compatibility and smooth updates.
 */

import { StorageSchema, CustomTask, WebsitePattern, UserPreferences } from '../types/index';

// ============================================================================
// MIGRATION TYPES
// ============================================================================

export interface Migration {
  version: number;
  description: string;
  up: (data: any) => Promise<any>;
  down?: (data: any) => Promise<any>;
}

export interface MigrationResult {
  success: boolean;
  fromVersion: number;
  toVersion: number;
  migrationsRun: number[];
  errors: string[];
}

// ============================================================================
// MIGRATION DEFINITIONS
// ============================================================================

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    description: 'Initial schema setup',
    up: async (data: any) => {
      // Ensure all required storage keys exist with proper defaults
      const migrated = {
        customTasks: data.customTasks || {},
        websitePatterns: data.websitePatterns || {},
        userPreferences: data.userPreferences || {
          enabledCategories: ['social_media', 'ecommerce', 'professional', 'news_content', 'productivity'],
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
        responseCache: data.responseCache || {},
        usageStats: data.usageStats || {}
      };

      return migrated;
    },
    // No down function - rollback not supported for initial migration
  },
  
  {
    version: 2,
    description: 'Add task tags and improved validation',
    up: async (data: any) => {
      // Add tags field to existing custom tasks
      const customTasks = data.customTasks || {};
      
      for (const taskId in customTasks) {
        const task = customTasks[taskId];
        if (!task.tags) {
          task.tags = [];
        }
        
        // Ensure all required fields exist
        if (!task.isEnabled) {
          task.isEnabled = true;
        }
        
        if (!task.updatedAt) {
          task.updatedAt = task.createdAt || new Date().toISOString();
        }
      }

      return {
        ...data,
        customTasks
      };
    },
    down: async (data: any) => {
      // Remove tags field from custom tasks
      const customTasks = data.customTasks || {};
      
      for (const taskId in customTasks) {
        const task = customTasks[taskId];
        delete task.tags;
      }

      return {
        ...data,
        customTasks
      };
    }
  },

  {
    version: 3,
    description: 'Add security level to website context and improve privacy settings',
    up: async (data: any) => {
      // Update user preferences with enhanced privacy settings
      const userPreferences = data.userPreferences || {};
      
      if (userPreferences.privacySettings) {
        // Add new privacy settings if they don't exist
        if (!userPreferences.privacySettings.securityLevel) {
          userPreferences.privacySettings.securityLevel = 'cautious';
        }
        
        if (!userPreferences.privacySettings.excludedDomains) {
          userPreferences.privacySettings.excludedDomains = [];
        }
      }

      // Update cached responses to include security context
      const responseCache = data.responseCache || {};
      for (const hash in responseCache) {
        const cached = responseCache[hash];
        if (cached.response && !cached.response.securityLevel) {
          cached.response.securityLevel = 'public';
        }
      }

      return {
        ...data,
        userPreferences,
        responseCache
      };
    },
    down: async (data: any) => {
      // Remove security level from cached responses
      const responseCache = data.responseCache || {};
      for (const hash in responseCache) {
        const cached = responseCache[hash];
        if (cached.response) {
          delete cached.response.securityLevel;
        }
      }

      return {
        ...data,
        responseCache
      };
    }
  }
];

// ============================================================================
// MIGRATION SERVICE
// ============================================================================

export class MigrationService {
  private migrations: Migration[];

  constructor(migrations: Migration[] = MIGRATIONS) {
    this.migrations = migrations.sort((a, b) => a.version - b.version);
  }

  /**
   * Runs migrations from current version to target version
   */
  async migrate(data: any, fromVersion: number, toVersion: number): Promise<MigrationResult> {
    const result: MigrationResult = {
      success: true,
      fromVersion,
      toVersion,
      migrationsRun: [],
      errors: []
    };

    try {
      let currentData = { ...data };
      
      // Find migrations to run
      const migrationsToRun = this.migrations.filter(
        migration => migration.version > fromVersion && migration.version <= toVersion
      );

      console.log(`Running ${migrationsToRun.length} migrations from version ${fromVersion} to ${toVersion}`);

      // Run migrations in order
      for (const migration of migrationsToRun) {
        try {
          console.log(`Running migration ${migration.version}: ${migration.description}`);
          currentData = await migration.up(currentData);
          result.migrationsRun.push(migration.version);
        } catch (error) {
          const errorMessage = `Migration ${migration.version} failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
          console.error(errorMessage);
          result.errors.push(errorMessage);
          result.success = false;
          break;
        }
      }

      // Return migrated data
      return {
        ...result,
        data: currentData
      };

    } catch (error) {
      const errorMessage = `Migration process failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(errorMessage);
      result.errors.push(errorMessage);
      result.success = false;
      return result;
    }
  }

  /**
   * Runs a downgrade migration (rollback)
   */
  async rollback(data: any, fromVersion: number, toVersion: number): Promise<MigrationResult> {
    const result: MigrationResult = {
      success: true,
      fromVersion,
      toVersion,
      migrationsRun: [],
      errors: []
    };

    try {
      let currentData = { ...data };
      
      // Find migrations to rollback (in reverse order)
      const migrationsToRollback = this.migrations
        .filter(migration => migration.version > toVersion && migration.version <= fromVersion)
        .reverse();

      console.log(`Rolling back ${migrationsToRollback.length} migrations from version ${fromVersion} to ${toVersion}`);

      // Run rollbacks in reverse order
      for (const migration of migrationsToRollback) {
        if (!migration.down) {
          const errorMessage = `Migration ${migration.version} does not support rollback`;
          console.error(errorMessage);
          result.errors.push(errorMessage);
          result.success = false;
          break;
        }

        try {
          console.log(`Rolling back migration ${migration.version}: ${migration.description}`);
          currentData = await migration.down(currentData);
          result.migrationsRun.push(migration.version);
        } catch (error) {
          const errorMessage = `Rollback ${migration.version} failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
          console.error(errorMessage);
          result.errors.push(errorMessage);
          result.success = false;
          break;
        }
      }

      return {
        ...result,
        data: currentData
      };

    } catch (error) {
      const errorMessage = `Rollback process failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(errorMessage);
      result.errors.push(errorMessage);
      result.success = false;
      return result;
    }
  }

  /**
   * Gets the latest migration version
   */
  getLatestVersion(): number {
    return this.migrations.length > 0 ? Math.max(...this.migrations.map(m => m.version)) : 0;
  }

  /**
   * Validates that data structure matches expected schema after migration
   */
  async validateMigratedData(data: any, version: number): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      // Basic structure validation
      if (!data || typeof data !== 'object') {
        errors.push('Data must be an object');
        return { valid: false, errors };
      }

      // Check required top-level keys
      const requiredKeys = ['customTasks', 'websitePatterns', 'userPreferences', 'responseCache', 'usageStats'];
      for (const key of requiredKeys) {
        if (!(key in data)) {
          errors.push(`Missing required key: ${key}`);
        }
      }

      // Validate custom tasks structure
      if (data.customTasks && typeof data.customTasks === 'object') {
        for (const [taskId, task] of Object.entries(data.customTasks)) {
          if (!task || typeof task !== 'object') {
            errors.push(`Invalid task structure for ID: ${taskId}`);
            continue;
          }

          const taskObj = task as any;
          const requiredTaskFields = ['id', 'name', 'description', 'websitePatterns', 'promptTemplate', 'outputFormat', 'createdAt', 'usageCount', 'isEnabled'];
          
          for (const field of requiredTaskFields) {
            if (!(field in taskObj)) {
              errors.push(`Task ${taskId} missing required field: ${field}`);
            }
          }

          // Version-specific validations
          if (version >= 2 && !('tags' in taskObj)) {
            errors.push(`Task ${taskId} missing tags field (required in version 2+)`);
          }
        }
      }

      // Validate user preferences structure
      if (data.userPreferences && typeof data.userPreferences === 'object') {
        const prefs = data.userPreferences as any;
        const requiredPrefFields = ['enabledCategories', 'customPatterns', 'privacySettings', 'automationPermissions', 'aiProvider', 'theme'];
        
        for (const field of requiredPrefFields) {
          if (!(field in prefs)) {
            errors.push(`User preferences missing required field: ${field}`);
          }
        }

        // Validate privacy settings
        if (prefs.privacySettings && typeof prefs.privacySettings === 'object') {
          const privacyFields = ['sharePageContent', 'shareFormData', 'allowAutomation'];
          for (const field of privacyFields) {
            if (!(field in prefs.privacySettings)) {
              errors.push(`Privacy settings missing required field: ${field}`);
            }
          }

          // Version-specific privacy validations
          if (version >= 3) {
            if (!('securityLevel' in prefs.privacySettings)) {
              errors.push('Privacy settings missing securityLevel field (required in version 3+)');
            }
            if (!('excludedDomains' in prefs.privacySettings)) {
              errors.push('Privacy settings missing excludedDomains field (required in version 3+)');
            }
          }
        }
      }

      return { valid: errors.length === 0, errors };

    } catch (error) {
      const errorMessage = `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      errors.push(errorMessage);
      return { valid: false, errors };
    }
  }

  /**
   * Creates a backup of data before migration
   */
  async createBackup(data: any, version: number): Promise<{ backup: any; timestamp: string }> {
    const timestamp = new Date().toISOString();
    const backup = {
      version,
      timestamp,
      data: JSON.parse(JSON.stringify(data)) // Deep clone
    };

    return { backup, timestamp };
  }

  /**
   * Restores data from backup
   */
  async restoreFromBackup(backup: any): Promise<any> {
    if (!backup || !backup.data) {
      throw new Error('Invalid backup format');
    }

    console.log(`Restoring data from backup created at ${backup.timestamp} (version ${backup.version})`);
    return backup.data;
  }
}

// ============================================================================
// EXPORT SINGLETON
// ============================================================================

export const migrationService = new MigrationService();