/**
 * User Preferences Service
 * 
 * Provides high-level operations for managing user preferences,
 * website patterns, and customization settings.
 */

import {
  UserPreferences,
  CustomPattern,
  PrivacySettings,
  WebsiteCategory,
  SecurityLevel,
  ValidationUtils
} from '../types';
import { ChromeStorageService } from './storage';

// ============================================================================
// PREFERENCES SERVICE
// ============================================================================

export class PreferencesService {
  private storageService: ChromeStorageService;

  constructor(storageService: ChromeStorageService) {
    this.storageService = storageService;
  }

  /**
   * Gets current user preferences
   */
  async getPreferences(): Promise<UserPreferences> {
    const preferences = await this.storageService.getUserPreferences();
    
    if (!preferences) {
      // Return default preferences if none exist
      const defaultPreferences: UserPreferences = {
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
      };
      
      await this.updatePreferences(defaultPreferences);
      return defaultPreferences;
    }
    
    return preferences;
  }

  /**
   * Updates user preferences
   */
  async updatePreferences(updates: Partial<UserPreferences>): Promise<void> {
    await this.storageService.updateUserPreferences(updates);
  }

  /**
   * Checks if a category is enabled
   */
  async isCategoryEnabled(category: WebsiteCategory): Promise<boolean> {
    const preferences = await this.getPreferences();
    return preferences.enabledCategories.includes(category);
  }

  /**
   * Enables or disables a category
   */
  async setCategoryEnabled(category: WebsiteCategory, enabled: boolean): Promise<void> {
    const preferences = await this.getPreferences();
    let enabledCategories = [...preferences.enabledCategories];
    
    if (enabled && !enabledCategories.includes(category)) {
      enabledCategories.push(category);
    } else if (!enabled) {
      enabledCategories = enabledCategories.filter(c => c !== category);
    }
    
    await this.updatePreferences({ enabledCategories });
  }

  /**
   * Gets custom website patterns
   */
  async getCustomPatterns(): Promise<CustomPattern[]> {
    const preferences = await this.getPreferences();
    return preferences.customPatterns;
  }

  /**
   * Adds a new custom pattern
   */
  async addCustomPattern(pattern: Omit<CustomPattern, 'id'>): Promise<string> {
    // Validate pattern
    ValidationUtils.validateUrlPattern(pattern.urlPattern);
    
    const preferences = await this.getPreferences();
    const newPattern: CustomPattern = {
      ...pattern,
      id: `pattern_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
    
    const customPatterns = [...preferences.customPatterns, newPattern];
    await this.updatePreferences({ customPatterns });
    
    return newPattern.id;
  }

  /**
   * Updates an existing custom pattern
   */
  async updateCustomPattern(patternId: string, updates: Partial<Omit<CustomPattern, 'id'>>): Promise<void> {
    const preferences = await this.getPreferences();
    const patternIndex = preferences.customPatterns.findIndex(p => p.id === patternId);
    
    if (patternIndex === -1) {
      throw new Error(`Custom pattern with ID ${patternId} not found`);
    }
    
    // Validate URL pattern if it's being updated
    if (updates.urlPattern) {
      ValidationUtils.validateUrlPattern(updates.urlPattern);
    }
    
    const customPatterns = [...preferences.customPatterns];
    customPatterns[patternIndex] = {
      ...customPatterns[patternIndex],
      ...updates
    };
    
    await this.updatePreferences({ customPatterns });
  }

  /**
   * Removes a custom pattern
   */
  async removeCustomPattern(patternId: string): Promise<void> {
    const preferences = await this.getPreferences();
    const customPatterns = preferences.customPatterns.filter(p => p.id !== patternId);
    await this.updatePreferences({ customPatterns });
  }

  /**
   * Gets privacy settings
   */
  async getPrivacySettings(): Promise<PrivacySettings> {
    const preferences = await this.getPreferences();
    return preferences.privacySettings;
  }

  /**
   * Updates privacy settings
   */
  async updatePrivacySettings(updates: Partial<PrivacySettings>): Promise<void> {
    const preferences = await this.getPreferences();
    const updatedSettings = { ...preferences.privacySettings, ...updates };
    await this.updatePreferences({ privacySettings: updatedSettings });
  }

  /**
   * Checks if a domain is excluded from extension functionality
   */
  async isDomainExcluded(domain: string): Promise<boolean> {
    const privacySettings = await this.getPrivacySettings();
    return privacySettings.excludedDomains.some(excludedDomain => {
      try {
        const regex = new RegExp(excludedDomain, 'i');
        return regex.test(domain);
      } catch {
        // If regex is invalid, do exact match
        return excludedDomain.toLowerCase() === domain.toLowerCase();
      }
    });
  }

  /**
   * Adds a domain to the exclusion list
   */
  async addExcludedDomain(domain: string): Promise<void> {
    ValidationUtils.validateDomain(domain);
    
    const privacySettings = await this.getPrivacySettings();
    if (!privacySettings.excludedDomains.includes(domain)) {
      const excludedDomains = [...privacySettings.excludedDomains, domain];
      await this.updatePrivacySettings({ excludedDomains });
    }
  }

  /**
   * Removes a domain from the exclusion list
   */
  async removeExcludedDomain(domain: string): Promise<void> {
    const privacySettings = await this.getPrivacySettings();
    const updatedDomains = privacySettings.excludedDomains.filter(d => d !== domain);
    await this.updatePrivacySettings({ excludedDomains: updatedDomains });
  }

  /**
   * Gets automation permissions
   */
  async getAutomationPermissions(): Promise<Record<string, boolean>> {
    const preferences = await this.getPreferences();
    return preferences.automationPermissions;
  }

  /**
   * Sets automation permission for a domain
   */
  async setAutomationPermission(domain: string, allowed: boolean): Promise<void> {
    ValidationUtils.validateDomain(domain);
    
    const preferences = await this.getPreferences();
    const automationPermissions = { ...preferences.automationPermissions, [domain]: allowed };
    await this.updatePreferences({ automationPermissions });
  }

  /**
   * Removes automation permission for a domain
   */
  async removeAutomationPermission(domain: string): Promise<void> {
    const preferences = await this.getPreferences();
    const automationPermissions = { ...preferences.automationPermissions };
    delete automationPermissions[domain];
    await this.updatePreferences({ automationPermissions });
  }

  /**
   * Checks if automation is allowed for a domain
   */
  async isAutomationAllowed(domain: string): Promise<boolean> {
    const preferences = await this.getPreferences();
    
    // Check if automation is globally disabled
    if (!preferences.privacySettings.allowAutomation) {
      return false;
    }
    
    // Check domain-specific permissions
    const permissions = preferences.automationPermissions;
    
    // If there's a specific permission for this domain, use it
    if (permissions.hasOwnProperty(domain)) {
      return permissions[domain];
    }
    
    // Check for wildcard patterns
    for (const [pattern, allowed] of Object.entries(permissions)) {
      try {
        const regex = new RegExp(pattern, 'i');
        if (regex.test(domain)) {
          return allowed;
        }
      } catch {
        // If regex is invalid, skip
        continue;
      }
    }
    
    // Default to allowed if no specific rules
    return true;
  }

  /**
   * Gets the current AI provider
   */
  async getAIProvider(): Promise<string> {
    const preferences = await this.getPreferences();
    return preferences.aiProvider;
  }

  /**
   * Sets the AI provider
   */
  async setAIProvider(provider: string): Promise<void> {
    await this.updatePreferences({ aiProvider: provider });
  }

  /**
   * Gets the current theme
   */
  async getTheme(): Promise<'light' | 'dark' | 'auto'> {
    const preferences = await this.getPreferences();
    return preferences.theme;
  }

  /**
   * Sets the theme
   */
  async setTheme(theme: 'light' | 'dark' | 'auto'): Promise<void> {
    await this.updatePreferences({ theme });
  }

  /**
   * Exports all preferences for backup
   */
  async exportPreferences(): Promise<UserPreferences> {
    return await this.getPreferences();
  }

  /**
   * Imports preferences from backup
   */
  async importPreferences(preferences: UserPreferences, merge: boolean = true): Promise<void> {
    if (merge) {
      const currentPreferences = await this.getPreferences();
      const mergedPreferences: UserPreferences = {
        enabledCategories: preferences.enabledCategories || currentPreferences.enabledCategories,
        customPatterns: [...currentPreferences.customPatterns, ...preferences.customPatterns],
        privacySettings: { ...currentPreferences.privacySettings, ...preferences.privacySettings },
        automationPermissions: { ...currentPreferences.automationPermissions, ...preferences.automationPermissions },
        aiProvider: preferences.aiProvider || currentPreferences.aiProvider,
        theme: preferences.theme || currentPreferences.theme
      };
      await this.updatePreferences(mergedPreferences);
    } else {
      await this.updatePreferences(preferences);
    }
  }

  /**
   * Resets preferences to defaults
   */
  async resetToDefaults(): Promise<void> {
    const defaultPreferences: UserPreferences = {
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
    };
    
    await this.updatePreferences(defaultPreferences);
  }

  /**
   * Gets suggestions customization for a website
   */
  async getSuggestionsForWebsite(domain: string): Promise<string[]> {
    const customPatterns = await this.getCustomPatterns();
    const suggestions: string[] = [];
    
    for (const pattern of customPatterns) {
      try {
        const regex = new RegExp(pattern.urlPattern, 'i');
        if (regex.test(domain)) {
          suggestions.push(...pattern.suggestions);
        }
      } catch {
        // If regex is invalid, do exact match
        if (pattern.urlPattern.toLowerCase() === domain.toLowerCase()) {
          suggestions.push(...pattern.suggestions);
        }
      }
    }
    
    return [...new Set(suggestions)]; // Remove duplicates
  }

  /**
   * Validates preferences object
   */
  validatePreferences(preferences: unknown): preferences is UserPreferences {
    if (!preferences || typeof preferences !== 'object') {
      return false;
    }
    
    const prefs = preferences as Record<string, unknown>;
    
    // Check required fields
    if (!Array.isArray(prefs.enabledCategories)) return false;
    if (!Array.isArray(prefs.customPatterns)) return false;
    if (!prefs.privacySettings || typeof prefs.privacySettings !== 'object') return false;
    if (!prefs.automationPermissions || typeof prefs.automationPermissions !== 'object') return false;
    if (typeof prefs.aiProvider !== 'string') return false;
    if (typeof prefs.theme !== 'string') return false;
    
    // Validate enabled categories
    for (const category of prefs.enabledCategories) {
      if (!Object.values(WebsiteCategory).includes(category as WebsiteCategory)) {
        return false;
      }
    }
    
    // Validate theme
    if (!['light', 'dark', 'auto'].includes(prefs.theme as string)) {
      return false;
    }
    
    return true;
  }
}

export default PreferencesService;