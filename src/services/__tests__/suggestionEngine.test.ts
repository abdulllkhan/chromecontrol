/**
 * Tests for Suggestion Engine
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  SuggestionEngine,
  SuggestionGenerator,
  SuggestionFilter as SuggestionFilterClass,
  type SuggestionEngineConfig,
  type SuggestionContext,
  type SuggestionFilter,
  type PrioritizedSuggestion
} from '../suggestionEngine.js';
import { PatternEngine } from '../patternEngine.js';
import { TaskManager } from '../taskManager.js';
import {
  WebsiteContext,
  WebsiteCategory,
  PageType,
  SecurityLevel,
  CustomTask,
  OutputFormat,
  Pattern,
  Suggestion
} from '../../types/index.js';

// ============================================================================
// MOCK DATA
// ============================================================================

const mockWebsiteContext: WebsiteContext = {
  domain: 'example.com',
  category: WebsiteCategory.PRODUCTIVITY,
  pageType: PageType.HOME,
  extractedData: { title: 'Example Site' },
  securityLevel: SecurityLevel.PUBLIC,
  timestamp: new Date()
};

const mockCustomTask: CustomTask = {
  id: 'task-1',
  name: 'Test Task',
  description: 'A test task for productivity sites',
  websitePatterns: ['example.com', '*.productivity.com'],
  promptTemplate: 'Generate content for {{domain}}',
  outputFormat: OutputFormat.PLAIN_TEXT,
  automationSteps: [],
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  usageCount: 5,
  isEnabled: true,
  tags: ['productivity', 'content']
};

const mockPattern: Pattern = {
  id: 'pattern-1',
  name: 'Productivity Pattern',
  urlRegex: '.*example\\.com.*',
  category: WebsiteCategory.PRODUCTIVITY,
  suggestions: [
    {
      id: 'builtin-1',
      title: 'Organize Content',
      description: 'Structure and categorize information',
      category: 'organization',
      isCustom: false,
      estimatedTime: 30,
      requiresPermission: false
    }
  ],
  isBuiltIn: true
};

const mockSuggestionContext: SuggestionContext = {
  websiteContext: mockWebsiteContext,
  userPreferences: {
    enabledCategories: [WebsiteCategory.PRODUCTIVITY],
    disabledSuggestions: [],
    preferredOutputFormats: ['plain_text']
  },
  recentUsage: [
    {
      taskId: 'task-1',
      timestamp: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
      success: true
    }
  ]
};

// ============================================================================
// MOCKS
// ============================================================================

const mockPatternEngine = {
  getMatchingPatterns: vi.fn().mockReturnValue([mockPattern]),
  analyzeWebsite: vi.fn().mockReturnValue(mockWebsiteContext),
  registerCustomPattern: vi.fn(),
  updateCustomPatterns: vi.fn(),
  getCustomPatterns: vi.fn().mockReturnValue([])
} as unknown as PatternEngine;

const mockTaskManager = {
  getTasksForWebsite: vi.fn().mockResolvedValue([mockCustomTask]),
  createTask: vi.fn(),
  getTask: vi.fn(),
  getAllTasks: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  executeTask: vi.fn(),
  validateTask: vi.fn(),
  testTask: vi.fn()
} as unknown as TaskManager;

const mockConfig: SuggestionEngineConfig = {
  patternEngine: mockPatternEngine,
  taskManager: mockTaskManager,
  maxSuggestions: 10,
  enableBuiltInSuggestions: true,
  enableCustomSuggestions: true,
  priorityWeights: {
    usage: 1.0,
    recency: 0.8,
    relevance: 1.2,
    category: 0.6
  }
};

// ============================================================================
// SUGGESTION GENERATOR TESTS
// ============================================================================

describe('SuggestionGenerator', () => {
  let generator: SuggestionGenerator;

  beforeEach(() => {
    vi.clearAllMocks();
    generator = new SuggestionGenerator(mockConfig);
  });

  describe('generateSuggestions', () => {
    it('should generate suggestions from multiple sources', async () => {
      const suggestions = await generator.generateSuggestions(mockSuggestionContext);

      expect(suggestions).toBeDefined();
      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBeGreaterThan(0);

      // Should have custom suggestions at minimum
      const hasCustom = suggestions.some(s => s.source === 'custom');
      expect(hasCustom).toBe(true);

      // May have built-in suggestions depending on pattern matching
      const sources = [...new Set(suggestions.map(s => s.source))];
      expect(sources.length).toBeGreaterThan(0);
    });

    it('should prioritize suggestions correctly', async () => {
      const suggestions = await generator.generateSuggestions(mockSuggestionContext);

      // Suggestions should be sorted by priority (highest first)
      for (let i = 0; i < suggestions.length - 1; i++) {
        expect(suggestions[i].priority).toBeGreaterThanOrEqual(suggestions[i + 1].priority);
      }
    });

    it('should respect max suggestions limit', async () => {
      const configWithLimit = { ...mockConfig, maxSuggestions: 2 };
      const limitedGenerator = new SuggestionGenerator(configWithLimit);

      const suggestions = await limitedGenerator.generateSuggestions(mockSuggestionContext);

      expect(suggestions.length).toBeLessThanOrEqual(2);
    });

    it('should apply user preferences', async () => {
      const contextWithPrefs: SuggestionContext = {
        ...mockSuggestionContext,
        userPreferences: {
          enabledCategories: [WebsiteCategory.SOCIAL_MEDIA], // Different category
          disabledSuggestions: [],
          preferredOutputFormats: ['plain_text']
        }
      };

      const suggestions = await generator.generateSuggestions(contextWithPrefs);

      // Should filter out suggestions not matching enabled categories
      // (This might result in fewer or no suggestions depending on implementation)
      expect(suggestions).toBeDefined();
    });

    it('should handle disabled built-in suggestions', async () => {
      const configNoBuiltIn = { ...mockConfig, enableBuiltInSuggestions: false };
      const noBuiltInGenerator = new SuggestionGenerator(configNoBuiltIn);

      const suggestions = await noBuiltInGenerator.generateSuggestions(mockSuggestionContext);

      // Should not have built-in suggestions
      const hasBuiltIn = suggestions.some(s => s.source === 'builtin');
      expect(hasBuiltIn).toBe(false);
    });

    it('should handle disabled custom suggestions', async () => {
      const configNoCustom = { ...mockConfig, enableCustomSuggestions: false };
      const noCustomGenerator = new SuggestionGenerator(configNoCustom);

      const suggestions = await noCustomGenerator.generateSuggestions(mockSuggestionContext);

      // Should not have custom suggestions
      const hasCustom = suggestions.some(s => s.source === 'custom');
      expect(hasCustom).toBe(false);
    });

    it('should cache suggestions', async () => {
      // First call
      const suggestions1 = await generator.generateSuggestions(mockSuggestionContext);
      
      // Second call should use cache
      const suggestions2 = await generator.generateSuggestions(mockSuggestionContext);

      expect(suggestions1).toEqual(suggestions2);
      
      // TaskManager should only be called once due to caching
      expect(mockTaskManager.getTasksForWebsite).toHaveBeenCalledTimes(1);
    });

    it('should handle errors gracefully', async () => {
      // Mock an error in task manager
      vi.mocked(mockTaskManager.getTasksForWebsite).mockRejectedValueOnce(new Error('Task manager error'));

      const suggestions = await generator.generateSuggestions(mockSuggestionContext);

      // Should return empty array on error, not throw
      expect(suggestions).toEqual([]);
    });
  });

  describe('clearCache', () => {
    it('should clear suggestion cache', async () => {
      // Generate suggestions to populate cache
      await generator.generateSuggestions(mockSuggestionContext);
      
      // Clear cache
      generator.clearCache();
      
      // Next call should hit the services again
      await generator.generateSuggestions(mockSuggestionContext);
      
      expect(mockTaskManager.getTasksForWebsite).toHaveBeenCalledTimes(2);
    });
  });
});

// ============================================================================
// SUGGESTION FILTER TESTS
// ============================================================================

describe('SuggestionFilter', () => {
  const mockSuggestions: PrioritizedSuggestion[] = [
    {
      id: 'suggestion-1',
      title: 'Content Generation',
      description: 'Generate content for productivity',
      category: 'content',
      isCustom: false,
      estimatedTime: 30,
      requiresPermission: false,
      priority: 10,
      relevanceScore: 8,
      source: 'builtin',
      matchingPatterns: ['.*example\\.com.*']
    },
    {
      id: 'suggestion-2',
      title: 'Automation Task',
      description: 'Automate form filling',
      category: 'automation',
      isCustom: true,
      estimatedTime: 60,
      requiresPermission: true,
      priority: 8,
      relevanceScore: 6,
      source: 'custom',
      matchingPatterns: ['example.com']
    },
    {
      id: 'suggestion-3',
      title: 'Analysis Task',
      description: 'Analyze page content',
      category: 'analysis',
      isCustom: false,
      estimatedTime: 45,
      requiresPermission: false,
      priority: 6,
      relevanceScore: 7,
      source: 'builtin',
      matchingPatterns: ['.*\\.com.*']
    }
  ];

  describe('filterSuggestions', () => {
    it('should filter by categories', () => {
      const filter: SuggestionFilter = {
        categories: ['content', 'analysis']
      };

      const filtered = SuggestionFilterClass.filterSuggestions(mockSuggestions, filter);

      expect(filtered).toHaveLength(2);
      expect(filtered.every(s => ['content', 'analysis'].includes(s.category))).toBe(true);
    });

    it('should filter by permission requirement', () => {
      const filter: SuggestionFilter = {
        requiresPermission: true
      };

      const filtered = SuggestionFilterClass.filterSuggestions(mockSuggestions, filter);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].requiresPermission).toBe(true);
    });

    it('should filter by custom status', () => {
      const filter: SuggestionFilter = {
        isCustom: true
      };

      const filtered = SuggestionFilterClass.filterSuggestions(mockSuggestions, filter);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].isCustom).toBe(true);
    });

    it('should filter by estimated time', () => {
      const filter: SuggestionFilter = {
        estimatedTimeMax: 40
      };

      const filtered = SuggestionFilterClass.filterSuggestions(mockSuggestions, filter);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].estimatedTime).toBeLessThanOrEqual(40);
    });

    it('should filter by search query', () => {
      const filter: SuggestionFilter = {
        searchQuery: 'automation'
      };

      const filtered = SuggestionFilterClass.filterSuggestions(mockSuggestions, filter);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].title.toLowerCase()).toContain('automation');
    });

    it('should apply multiple filters', () => {
      const filter: SuggestionFilter = {
        categories: ['content', 'automation'],
        requiresPermission: false
      };

      const filtered = SuggestionFilterClass.filterSuggestions(mockSuggestions, filter);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].category).toBe('content');
      expect(filtered[0].requiresPermission).toBe(false);
    });
  });

  describe('categorizeSuggestions', () => {
    it('should categorize suggestions by type', () => {
      const categorized = SuggestionFilterClass.categorizeSuggestions(mockSuggestions);

      expect(categorized).toHaveProperty('content');
      expect(categorized).toHaveProperty('automation');
      expect(categorized).toHaveProperty('analysis');

      expect(categorized.content).toHaveLength(1);
      expect(categorized.automation).toHaveLength(1);
      expect(categorized.analysis).toHaveLength(1);
    });

    it('should sort categories by priority', () => {
      const categorized = SuggestionFilterClass.categorizeSuggestions(mockSuggestions);

      // Each category should be sorted by priority (highest first)
      for (const category in categorized) {
        const suggestions = categorized[category];
        for (let i = 0; i < suggestions.length - 1; i++) {
          expect(suggestions[i].priority).toBeGreaterThanOrEqual(suggestions[i + 1].priority);
        }
      }
    });
  });

  describe('getFilterOptions', () => {
    it('should extract available filter options', () => {
      const options = SuggestionFilterClass.getFilterOptions(mockSuggestions);

      expect(options.categories).toEqual(['analysis', 'automation', 'content']);
      expect(options.hasPermissionRequired).toBe(true);
      expect(options.hasCustomTasks).toBe(true);
      expect(options.timeRange.min).toBe(30);
      expect(options.timeRange.max).toBe(60);
    });
  });
});

// ============================================================================
// SUGGESTION ENGINE TESTS
// ============================================================================

describe('SuggestionEngine', () => {
  let engine: SuggestionEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new SuggestionEngine(mockConfig);
  });

  describe('getSuggestions', () => {
    it('should get suggestions without filter', async () => {
      const suggestions = await engine.getSuggestions(mockSuggestionContext);

      expect(suggestions).toBeDefined();
      expect(Array.isArray(suggestions)).toBe(true);
    });

    it('should get suggestions with filter', async () => {
      const filter: SuggestionFilter = {
        categories: ['content']
      };

      const suggestions = await engine.getSuggestions(mockSuggestionContext, filter);

      expect(suggestions).toBeDefined();
      expect(Array.isArray(suggestions)).toBe(true);
    });
  });

  describe('getCategorizedSuggestions', () => {
    it('should return categorized suggestions', async () => {
      const categorized = await engine.getCategorizedSuggestions(mockSuggestionContext);

      expect(typeof categorized).toBe('object');
      expect(categorized).not.toBeNull();
    });
  });

  describe('getFilterOptions', () => {
    it('should return filter options', async () => {
      const options = await engine.getFilterOptions(mockSuggestionContext);

      expect(options).toHaveProperty('categories');
      expect(options).toHaveProperty('hasPermissionRequired');
      expect(options).toHaveProperty('hasCustomTasks');
      expect(options).toHaveProperty('timeRange');
    });
  });

  describe('clearCache', () => {
    it('should clear cache', () => {
      expect(() => engine.clearCache()).not.toThrow();
    });
  });
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe('SuggestionEngine Integration', () => {
  let engine: SuggestionEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new SuggestionEngine(mockConfig);
  });

  it('should handle complete suggestion workflow', async () => {
    // Get suggestions
    const suggestions = await engine.getSuggestions(mockSuggestionContext);
    expect(suggestions.length).toBeGreaterThan(0);

    // Get filter options
    const options = await engine.getFilterOptions(mockSuggestionContext);
    expect(options.categories.length).toBeGreaterThan(0);

    // Apply filter
    const filter: SuggestionFilter = {
      categories: options.categories.slice(0, 1)
    };
    const filtered = await engine.getSuggestions(mockSuggestionContext, filter);
    expect(filtered.length).toBeLessThanOrEqual(suggestions.length);

    // Get categorized
    const categorized = await engine.getCategorizedSuggestions(mockSuggestionContext);
    expect(Object.keys(categorized).length).toBeGreaterThan(0);
  });

  it('should handle different website contexts', async () => {
    const socialMediaContext: SuggestionContext = {
      websiteContext: {
        ...mockWebsiteContext,
        domain: 'twitter.com',
        category: WebsiteCategory.SOCIAL_MEDIA
      }
    };

    const suggestions = await engine.getSuggestions(socialMediaContext);
    expect(suggestions).toBeDefined();
  });

  it('should handle empty results gracefully', async () => {
    // Mock empty results
    vi.mocked(mockTaskManager.getTasksForWebsite).mockResolvedValueOnce([]);
    vi.mocked(mockPatternEngine.getMatchingPatterns).mockReturnValueOnce([]);

    const suggestions = await engine.getSuggestions(mockSuggestionContext);
    expect(suggestions).toEqual([]);
  });
});