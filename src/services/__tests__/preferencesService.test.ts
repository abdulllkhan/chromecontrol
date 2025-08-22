import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PreferencesService } from '../preferencesService';
import { ChromeStorageService } from '../storage';
import {
  UserPreferences,
  WebsiteCategory,
  SecurityLevel,
  CustomPattern
} from '../../types';

// Mock ChromeStorageService
vi.mock('../storage');

describe('PreferencesService', () => {
  let preferencesService: PreferencesService;
  let mockStorageService: vi.Mocked<ChromeStorageService>;

  const mockPreferences: UserPreferences = {
    enabledCategories: [WebsiteCategory.SOCIAL_MEDIA, WebsiteCategory.ECOMMERCE],
    customPatterns: [
      {
        id: 'pattern1',
        name: 'GitHub',
        urlPattern: 'github\\.com',
        category: WebsiteCategory.PRODUCTIVITY,
        suggestions: ['Generate README', 'Analyze code']
      }
    ],
    privacySettings: {
      sharePageContent: true,
      shareFormData: false,
      allowAutomation: true,
      securityLevel: SecurityLevel.CAUTIOUS,
      excludedDomains: ['bank.com']
    },
    automationPermissions: {
      'example.com': true,
      'blocked.com': false
    },
    aiProvider: 'openai',
    theme: 'auto'
  };

  beforeEach(() => {
    mockStorageService = {
      getUserPreferences: vi.fn(),
      updateUserPreferences: vi.fn(),
      initialize: vi.fn()
    } as any;

    preferencesService = new PreferencesService(mockStorageService);
    
    // Reset mock to return fresh copy of preferences each time
    mockStorageService.getUserPreferences.mockImplementation(() => 
      Promise.resolve(JSON.parse(JSON.stringify(mockPreferences)))
    );
  });

  describe('getPreferences', () => {
    it('should return existing preferences', async () => {
      mockStorageService.getUserPreferences.mockResolvedValue(mockPreferences);

      const result = await preferencesService.getPreferences();

      expect(result).toEqual(mockPreferences);
      expect(mockStorageService.getUserPreferences).toHaveBeenCalledOnce();
    });

    it('should return and save default preferences when none exist', async () => {
      mockStorageService.getUserPreferences.mockResolvedValue(null);
      mockStorageService.updateUserPreferences.mockResolvedValue(true);

      const result = await preferencesService.getPreferences();

      expect(result.enabledCategories).toEqual(Object.values(WebsiteCategory));
      expect(result.customPatterns).toEqual([]);
      expect(result.privacySettings.securityLevel).toBe(SecurityLevel.CAUTIOUS);
      expect(mockStorageService.updateUserPreferences).toHaveBeenCalledWith(result);
    });
  });

  describe('updatePreferences', () => {
    it('should update preferences', async () => {
      mockStorageService.updateUserPreferences.mockResolvedValue(true);

      const updates = { aiProvider: 'claude' };
      await preferencesService.updatePreferences(updates);

      expect(mockStorageService.updateUserPreferences).toHaveBeenCalledWith(updates);
    });
  });

  describe('category management', () => {
    beforeEach(() => {
      mockStorageService.getUserPreferences.mockResolvedValue(mockPreferences);
      mockStorageService.updateUserPreferences.mockResolvedValue(true);
    });

    it('should check if category is enabled', async () => {
      const isEnabled = await preferencesService.isCategoryEnabled(WebsiteCategory.SOCIAL_MEDIA);
      expect(isEnabled).toBe(true);

      const isDisabled = await preferencesService.isCategoryEnabled(WebsiteCategory.NEWS_CONTENT);
      expect(isDisabled).toBe(false);
    });

    it('should enable a category', async () => {
      await preferencesService.setCategoryEnabled(WebsiteCategory.NEWS_CONTENT, true);

      expect(mockStorageService.updateUserPreferences).toHaveBeenCalledWith({
        enabledCategories: [
          WebsiteCategory.SOCIAL_MEDIA,
          WebsiteCategory.ECOMMERCE,
          WebsiteCategory.NEWS_CONTENT
        ]
      });
    });

    it('should disable a category', async () => {
      await preferencesService.setCategoryEnabled(WebsiteCategory.SOCIAL_MEDIA, false);

      expect(mockStorageService.updateUserPreferences).toHaveBeenCalledWith({
        enabledCategories: [WebsiteCategory.ECOMMERCE]
      });
    });

    it('should not duplicate categories when enabling', async () => {
      await preferencesService.setCategoryEnabled(WebsiteCategory.SOCIAL_MEDIA, true);

      expect(mockStorageService.updateUserPreferences).toHaveBeenCalledWith({
        enabledCategories: [WebsiteCategory.SOCIAL_MEDIA, WebsiteCategory.ECOMMERCE]
      });
    });
  });

  describe('custom patterns', () => {
    beforeEach(() => {
      mockStorageService.getUserPreferences.mockResolvedValue(mockPreferences);
      mockStorageService.updateUserPreferences.mockResolvedValue(true);
    });

    it('should get custom patterns', async () => {
      const patterns = await preferencesService.getCustomPatterns();
      expect(patterns).toEqual(mockPreferences.customPatterns);
    });

    it('should add a custom pattern', async () => {
      const newPattern = {
        name: 'Reddit',
        urlPattern: 'reddit\\.com',
        category: WebsiteCategory.SOCIAL_MEDIA,
        suggestions: ['Generate comment', 'Summarize thread']
      };

      const patternId = await preferencesService.addCustomPattern(newPattern);

      expect(patternId).toMatch(/^pattern_\d+_[a-z0-9]+$/);
      expect(mockStorageService.updateUserPreferences).toHaveBeenCalledWith({
        customPatterns: [
          ...mockPreferences.customPatterns,
          { ...newPattern, id: patternId }
        ]
      });
    });

    it('should update a custom pattern', async () => {
      const updates = { name: 'GitHub Updated' };
      await preferencesService.updateCustomPattern('pattern1', updates);

      expect(mockStorageService.updateUserPreferences).toHaveBeenCalledWith({
        customPatterns: [
          { ...mockPreferences.customPatterns[0], ...updates }
        ]
      });
    });

    it('should throw error when updating non-existent pattern', async () => {
      await expect(
        preferencesService.updateCustomPattern('nonexistent', { name: 'Test' })
      ).rejects.toThrow('Custom pattern with ID nonexistent not found');
    });

    it('should remove a custom pattern', async () => {
      await preferencesService.removeCustomPattern('pattern1');

      expect(mockStorageService.updateUserPreferences).toHaveBeenCalledWith({
        customPatterns: []
      });
    });

    it('should validate URL pattern when adding', async () => {
      const invalidPattern = {
        name: 'Invalid',
        urlPattern: '[invalid regex',
        category: WebsiteCategory.CUSTOM,
        suggestions: ['test']
      };

      await expect(
        preferencesService.addCustomPattern(invalidPattern)
      ).rejects.toThrow();
    });
  });

  describe('privacy settings', () => {
    beforeEach(() => {
      mockStorageService.getUserPreferences.mockResolvedValue(mockPreferences);
      mockStorageService.updateUserPreferences.mockResolvedValue(true);
    });

    it('should get privacy settings', async () => {
      const settings = await preferencesService.getPrivacySettings();
      expect(settings).toEqual(mockPreferences.privacySettings);
    });

    it('should update privacy settings', async () => {
      const updates = { shareFormData: true };
      await preferencesService.updatePrivacySettings(updates);

      expect(mockStorageService.updateUserPreferences).toHaveBeenCalledWith({
        privacySettings: { ...mockPreferences.privacySettings, ...updates }
      });
    });

    it('should check if domain is excluded', async () => {
      const isExcluded = await preferencesService.isDomainExcluded('bank.com');
      expect(isExcluded).toBe(true);

      const isNotExcluded = await preferencesService.isDomainExcluded('example.com');
      expect(isNotExcluded).toBe(false);
    });

    it('should add excluded domain', async () => {
      await preferencesService.addExcludedDomain('secure.com');

      expect(mockStorageService.updateUserPreferences).toHaveBeenCalledWith({
        privacySettings: {
          ...mockPreferences.privacySettings,
          excludedDomains: ['bank.com', 'secure.com']
        }
      });
    });

    it('should not duplicate excluded domains', async () => {
      await preferencesService.addExcludedDomain('bank.com');

      // Should not call updateUserPreferences since domain already exists
      expect(mockStorageService.updateUserPreferences).not.toHaveBeenCalled();
    });

    it('should remove excluded domain', async () => {
      await preferencesService.removeExcludedDomain('bank.com');

      expect(mockStorageService.updateUserPreferences).toHaveBeenCalledWith({
        privacySettings: {
          ...mockPreferences.privacySettings,
          excludedDomains: []
        }
      });
    });
  });

  describe('automation permissions', () => {
    beforeEach(() => {
      mockStorageService.getUserPreferences.mockResolvedValue(mockPreferences);
      mockStorageService.updateUserPreferences.mockResolvedValue(true);
    });

    it('should get automation permissions', async () => {
      const permissions = await preferencesService.getAutomationPermissions();
      expect(permissions).toEqual(mockPreferences.automationPermissions);
    });

    it('should set automation permission', async () => {
      await preferencesService.setAutomationPermission('newsite.com', true);

      expect(mockStorageService.updateUserPreferences).toHaveBeenCalledWith({
        automationPermissions: {
          ...mockPreferences.automationPermissions,
          'newsite.com': true
        }
      });
    });

    it('should remove automation permission', async () => {
      await preferencesService.removeAutomationPermission('example.com');

      expect(mockStorageService.updateUserPreferences).toHaveBeenCalledWith({
        automationPermissions: { 'blocked.com': false }
      });
    });

    it('should check if automation is allowed', async () => {
      // Explicit permission
      const isAllowed = await preferencesService.isAutomationAllowed('example.com');
      expect(isAllowed).toBe(true);

      // Explicit block
      const isBlocked = await preferencesService.isAutomationAllowed('blocked.com');
      expect(isBlocked).toBe(false);

      // Default (no specific permission)
      const isDefault = await preferencesService.isAutomationAllowed('unknown.com');
      expect(isDefault).toBe(true);
    });

    it('should respect global automation setting', async () => {
      const disabledPrefs = {
        ...mockPreferences,
        privacySettings: {
          ...mockPreferences.privacySettings,
          allowAutomation: false
        }
      };
      mockStorageService.getUserPreferences.mockResolvedValue(disabledPrefs);

      const isAllowed = await preferencesService.isAutomationAllowed('example.com');
      expect(isAllowed).toBe(false);
    });
  });

  describe('AI provider and theme', () => {
    beforeEach(() => {
      mockStorageService.getUserPreferences.mockResolvedValue(mockPreferences);
      mockStorageService.updateUserPreferences.mockResolvedValue(true);
    });

    it('should get and set AI provider', async () => {
      const provider = await preferencesService.getAIProvider();
      expect(provider).toBe('openai');

      await preferencesService.setAIProvider('claude');
      expect(mockStorageService.updateUserPreferences).toHaveBeenCalledWith({
        aiProvider: 'claude'
      });
    });

    it('should get and set theme', async () => {
      const theme = await preferencesService.getTheme();
      expect(theme).toBe('auto');

      await preferencesService.setTheme('dark');
      expect(mockStorageService.updateUserPreferences).toHaveBeenCalledWith({
        theme: 'dark'
      });
    });
  });

  describe('import/export', () => {
    beforeEach(() => {
      mockStorageService.getUserPreferences.mockResolvedValue(mockPreferences);
      mockStorageService.updateUserPreferences.mockResolvedValue(true);
    });

    it('should export preferences', async () => {
      const exported = await preferencesService.exportPreferences();
      expect(exported).toEqual(mockPreferences);
    });

    it('should import preferences with merge', async () => {
      const importData: UserPreferences = {
        enabledCategories: [WebsiteCategory.NEWS_CONTENT],
        customPatterns: [
          {
            id: 'pattern2',
            name: 'Twitter',
            urlPattern: 'twitter\\.com',
            category: WebsiteCategory.SOCIAL_MEDIA,
            suggestions: ['Tweet']
          }
        ],
        privacySettings: {
          sharePageContent: false,
          shareFormData: false,
          allowAutomation: true,
          securityLevel: SecurityLevel.RESTRICTED,
          excludedDomains: []
        },
        automationPermissions: {},
        aiProvider: 'claude',
        theme: 'dark'
      };

      await preferencesService.importPreferences(importData, true);

      expect(mockStorageService.updateUserPreferences).toHaveBeenCalledWith({
        enabledCategories: [WebsiteCategory.NEWS_CONTENT],
        customPatterns: [...mockPreferences.customPatterns, ...importData.customPatterns],
        privacySettings: { ...mockPreferences.privacySettings, ...importData.privacySettings },
        automationPermissions: { ...mockPreferences.automationPermissions },
        aiProvider: 'claude',
        theme: 'dark'
      });
    });

    it('should import preferences without merge', async () => {
      const importData = { ...mockPreferences, aiProvider: 'claude' };
      await preferencesService.importPreferences(importData, false);

      expect(mockStorageService.updateUserPreferences).toHaveBeenCalledWith(importData);
    });
  });

  describe('reset to defaults', () => {
    beforeEach(() => {
      mockStorageService.updateUserPreferences.mockResolvedValue(true);
    });

    it('should reset preferences to defaults', async () => {
      await preferencesService.resetToDefaults();

      expect(mockStorageService.updateUserPreferences).toHaveBeenCalledWith({
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
      });
    });
  });

  describe('website suggestions', () => {
    beforeEach(() => {
      mockStorageService.getUserPreferences.mockResolvedValue(mockPreferences);
    });

    it('should get suggestions for matching website', async () => {
      const suggestions = await preferencesService.getSuggestionsForWebsite('github.com');
      expect(suggestions).toEqual(['Generate README', 'Analyze code']);
    });

    it('should return empty array for non-matching website', async () => {
      const suggestions = await preferencesService.getSuggestionsForWebsite('example.org');
      expect(suggestions).toEqual([]);
    });

    it('should handle regex patterns', async () => {
      const prefsWithRegex = {
        ...mockPreferences,
        customPatterns: [
          {
            id: 'pattern1',
            name: 'GitHub Repos',
            urlPattern: 'github\\.com\\/.*\\/.*',
            category: WebsiteCategory.PRODUCTIVITY,
            suggestions: ['Repo suggestion']
          }
        ]
      };
      mockStorageService.getUserPreferences.mockResolvedValue(prefsWithRegex);

      const suggestions = await preferencesService.getSuggestionsForWebsite('github.com/user/repo');
      expect(suggestions).toEqual(['Repo suggestion']);
    });

    it('should remove duplicate suggestions', async () => {
      const prefsWithDuplicates = {
        ...mockPreferences,
        customPatterns: [
          {
            id: 'pattern1',
            name: 'GitHub',
            urlPattern: 'github\\.com',
            category: WebsiteCategory.PRODUCTIVITY,
            suggestions: ['Generate README', 'Analyze code']
          },
          {
            id: 'pattern2',
            name: 'GitHub Alt',
            urlPattern: 'github\\.com',
            category: WebsiteCategory.PRODUCTIVITY,
            suggestions: ['Generate README', 'Create PR']
          }
        ]
      };
      mockStorageService.getUserPreferences.mockResolvedValue(prefsWithDuplicates);

      const suggestions = await preferencesService.getSuggestionsForWebsite('github.com');
      expect(suggestions).toEqual(['Generate README', 'Analyze code', 'Create PR']);
    });
  });

  describe('validation', () => {
    it('should validate valid preferences', () => {
      const isValid = preferencesService.validatePreferences(mockPreferences);
      expect(isValid).toBe(true);
    });

    it('should reject invalid preferences', () => {
      const invalidPrefs = {
        enabledCategories: 'not an array',
        customPatterns: [],
        privacySettings: {},
        automationPermissions: {},
        aiProvider: 'openai',
        theme: 'auto'
      };

      const isValid = preferencesService.validatePreferences(invalidPrefs);
      expect(isValid).toBe(false);
    });

    it('should reject preferences with invalid categories', () => {
      const invalidPrefs = {
        ...mockPreferences,
        enabledCategories: ['invalid_category']
      };

      const isValid = preferencesService.validatePreferences(invalidPrefs);
      expect(isValid).toBe(false);
    });

    it('should reject preferences with invalid theme', () => {
      const invalidPrefs = {
        ...mockPreferences,
        theme: 'invalid_theme'
      };

      const isValid = preferencesService.validatePreferences(invalidPrefs);
      expect(isValid).toBe(false);
    });
  });
});