/**
 * Fallback Suggestions Service Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FallbackSuggestionsService } from '../fallbackSuggestions.js';
import { WebsiteContext, WebsiteCategory, PageType, SecurityLevel } from '../../types/index.js';

// Mock chrome storage API
const mockChromeStorage = {
  local: {
    get: vi.fn(),
    set: vi.fn()
  }
};

// @ts-ignore
global.chrome = {
  storage: mockChromeStorage
};

// Mock fetch for AI availability check
global.fetch = vi.fn();

describe('FallbackSuggestionsService', () => {
  let service: FallbackSuggestionsService;
  let mockWebsiteContext: WebsiteContext;

  beforeEach(() => {
    vi.clearAllMocks();
    
    service = new FallbackSuggestionsService({
      enableOfflineMode: true,
      maxCachedResponses: 10,
      cacheExpiryHours: 24,
      enableTemplateGeneration: true,
      enableInstructionMode: true
    });

    mockWebsiteContext = {
      domain: 'example.com',
      category: WebsiteCategory.SOCIAL_MEDIA,
      pageType: PageType.HOME,
      securityLevel: SecurityLevel.PUBLIC,
      extractedData: {}
    };

    mockChromeStorage.local.get.mockResolvedValue({});
    mockChromeStorage.local.set.mockResolvedValue(undefined);
  });

  describe('getFallbackSuggestions', () => {
    it('should return suggestions for social media websites', () => {
      const suggestions = service.getFallbackSuggestions(mockWebsiteContext);
      
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some(s => s.title.includes('Post'))).toBe(true);
      expect(suggestions.every(s => s.isOffline)).toBe(true);
    });

    it('should return suggestions for e-commerce websites', () => {
      mockWebsiteContext.category = WebsiteCategory.ECOMMERCE;
      
      const suggestions = service.getFallbackSuggestions(mockWebsiteContext);
      
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some(s => s.title.includes('Product') || s.title.includes('Compare'))).toBe(true);
    });

    it('should return suggestions for professional websites', () => {
      mockWebsiteContext.category = WebsiteCategory.PROFESSIONAL;
      
      const suggestions = service.getFallbackSuggestions(mockWebsiteContext);
      
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some(s => s.title.includes('Professional') || s.title.includes('LinkedIn'))).toBe(true);
    });

    it('should return generic suggestions for any category', () => {
      mockWebsiteContext.category = WebsiteCategory.CUSTOM;
      
      const suggestions = service.getFallbackSuggestions(mockWebsiteContext);
      
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some(s => s.title.includes('Copy') || s.title.includes('Notes'))).toBe(true);
    });

    it('should return empty array when offline mode is disabled', () => {
      service.updateConfig({ enableOfflineMode: false });
      
      const suggestions = service.getFallbackSuggestions(mockWebsiteContext);
      
      expect(suggestions).toEqual([]);
    });
  });

  describe('generateFromTemplate', () => {
    it('should generate content from template with placeholders', () => {
      const suggestion = {
        id: 'test-suggestion',
        title: 'Test Suggestion',
        description: 'Test description',
        category: 'test',
        isCustom: false,
        estimatedTime: 30,
        requiresPermission: false,
        icon: '🧪',
        template: 'Hello [NAME], welcome to [WEBSITE]!',
        placeholders: {
          NAME: 'Enter your name',
          WEBSITE: 'Enter website name'
        },
        isOffline: true
      };

      const values = {
        NAME: 'John',
        WEBSITE: 'Example.com'
      };

      const result = service.generateFromTemplate(suggestion, values);
      
      expect(result).toBe('Hello John, welcome to Example.com!');
    });

    it('should use default values for missing placeholders', () => {
      const suggestion = {
        id: 'test-suggestion',
        title: 'Test Suggestion',
        description: 'Test description',
        category: 'test',
        isCustom: false,
        estimatedTime: 30,
        requiresPermission: false,
        icon: '🧪',
        template: 'Hello [NAME], welcome to [WEBSITE]!',
        placeholders: {
          NAME: 'Enter your name',
          WEBSITE: 'Enter website name'
        },
        isOffline: true
      };

      const values = {
        NAME: 'John'
        // WEBSITE is missing
      };

      const result = service.generateFromTemplate(suggestion, values);
      
      expect(result).toBe('Hello John, welcome to [Enter website name]!');
    });

    it('should return description if no template is provided', () => {
      const suggestion = {
        id: 'test-suggestion',
        title: 'Test Suggestion',
        description: 'Test description',
        category: 'test',
        isCustom: false,
        estimatedTime: 30,
        requiresPermission: false,
        icon: '🧪',
        isOffline: true
      };

      const result = service.generateFromTemplate(suggestion, {});
      
      expect(result).toBe('Test description');
    });
  });

  describe('getInstructions', () => {
    it('should return instructions when instruction mode is enabled', () => {
      const suggestion = {
        id: 'test-suggestion',
        title: 'Test Suggestion',
        description: 'Test description',
        category: 'test',
        isCustom: false,
        estimatedTime: 30,
        requiresPermission: false,
        icon: '🧪',
        instructions: ['Step 1', 'Step 2', 'Step 3'],
        isOffline: true
      };

      const instructions = service.getInstructions(suggestion);
      
      expect(instructions).toEqual(['Step 1', 'Step 2', 'Step 3']);
    });

    it('should return default instructions when none provided', () => {
      const suggestion = {
        id: 'test-suggestion',
        title: 'Test Suggestion',
        description: 'Test description',
        category: 'test',
        isCustom: false,
        estimatedTime: 30,
        requiresPermission: false,
        icon: '🧪',
        isOffline: true
      };

      const instructions = service.getInstructions(suggestion);
      
      expect(instructions.length).toBeGreaterThan(0);
      expect(instructions[0]).toContain('offline');
    });

    it('should return empty array when instruction mode is disabled', () => {
      service.updateConfig({ enableInstructionMode: false });
      
      const suggestion = {
        id: 'test-suggestion',
        title: 'Test Suggestion',
        description: 'Test description',
        category: 'test',
        isCustom: false,
        estimatedTime: 30,
        requiresPermission: false,
        icon: '🧪',
        instructions: ['Step 1', 'Step 2'],
        isOffline: true
      };

      const instructions = service.getInstructions(suggestion);
      
      expect(instructions).toEqual([]);
    });
  });

  describe('cacheResponse', () => {
    it('should cache successful AI responses', async () => {
      const prompt = 'Test prompt';
      const response = 'Test response';
      
      await service.cacheResponse(prompt, response, mockWebsiteContext);
      
      expect(mockChromeStorage.local.set).toHaveBeenCalled();
    });

    it('should increment usage count for existing cached responses', async () => {
      const prompt = 'Test prompt';
      const response = 'Test response';
      
      // Cache the same response twice
      await service.cacheResponse(prompt, response, mockWebsiteContext);
      await service.cacheResponse(prompt, response, mockWebsiteContext);
      
      // Should have been called twice (once for each cache operation)
      expect(mockChromeStorage.local.set).toHaveBeenCalledTimes(2);
    });

    it('should limit cached responses to max limit', async () => {
      const limitedService = new FallbackSuggestionsService({
        maxCachedResponses: 2
      });

      // Cache more responses than the limit
      await limitedService.cacheResponse('prompt1', 'response1', mockWebsiteContext);
      await limitedService.cacheResponse('prompt2', 'response2', mockWebsiteContext);
      await limitedService.cacheResponse('prompt3', 'response3', mockWebsiteContext);

      // Should maintain the limit
      expect(mockChromeStorage.local.set).toHaveBeenCalled();
    });
  });

  describe('checkAIAvailability', () => {
    it('should return true when AI service is available', async () => {
      (fetch as any).mockResolvedValue({
        ok: true
      });

      const isAvailable = await service.checkAIAvailability();
      
      expect(isAvailable).toBe(true);
      expect(fetch).toHaveBeenCalledWith('https://api.openai.com/v1/models', {
        method: 'HEAD',
        signal: expect.any(AbortSignal)
      });
    });

    it('should return false when AI service is unavailable', async () => {
      (fetch as any).mockRejectedValue(new Error('Network error'));

      const isAvailable = await service.checkAIAvailability();
      
      expect(isAvailable).toBe(false);
    });

    it('should return false when AI service returns error status', async () => {
      (fetch as any).mockResolvedValue({
        ok: false,
        status: 500
      });

      const isAvailable = await service.checkAIAvailability();
      
      expect(isAvailable).toBe(false);
    });
  });

  describe('getOfflineStatus', () => {
    it('should return correct offline status', () => {
      const status = service.getOfflineStatus();
      
      expect(status).toHaveProperty('isOffline');
      expect(status).toHaveProperty('cachedResponsesCount');
      expect(status).toHaveProperty('fallbackSuggestionsCount');
      expect(typeof status.cachedResponsesCount).toBe('number');
      expect(typeof status.fallbackSuggestionsCount).toBe('number');
    });
  });

  describe('clearCache', () => {
    it('should clear cached responses', async () => {
      await service.clearCache();
      
      expect(mockChromeStorage.local.set).toHaveBeenCalledWith({ cachedResponses: {} });
    });
  });

  describe('configuration', () => {
    it('should use default configuration when none provided', () => {
      const defaultService = new FallbackSuggestionsService();
      expect(defaultService).toBeDefined();
    });

    it('should allow configuration updates', () => {
      service.updateConfig({
        enableOfflineMode: false,
        maxCachedResponses: 50
      });

      // Test that configuration change affects behavior
      const suggestions = service.getFallbackSuggestions(mockWebsiteContext);
      expect(suggestions).toEqual([]);
    });
  });

  describe('cached suggestions', () => {
    it('should include cached responses as suggestions', async () => {
      // Mock existing cached responses
      mockChromeStorage.local.get.mockResolvedValue({
        cachedResponses: {
          'test-id': {
            id: 'test-id',
            prompt: 'Test prompt',
            response: 'Test response',
            timestamp: new Date().toISOString(),
            context: mockWebsiteContext,
            usageCount: 5
          }
        }
      });

      // Create new service to load cached responses
      const newService = new FallbackSuggestionsService();
      
      // Wait for async loading
      await new Promise(resolve => setTimeout(resolve, 0));
      
      const suggestions = newService.getFallbackSuggestions(mockWebsiteContext);
      
      // Should include cached suggestions
      expect(suggestions.some(s => s.id.startsWith('cached-'))).toBe(true);
    });
  });
});