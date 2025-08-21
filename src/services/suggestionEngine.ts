/**
 * Suggestion Generation and Display System
 * 
 * This service generates contextual suggestions by matching custom tasks to the current website,
 * provides categorization and filtering capabilities, and implements prioritization algorithms.
 */

import {
  Suggestion,
  CustomTask,
  WebsiteContext,
  Pattern,
  WebsiteCategory,
  PageType,
  SecurityLevel,
  ValidationUtils
} from '../types/index.js';

import { PatternEngine } from './patternEngine.js';
import { TaskManager } from './taskManager.js';

// ============================================================================
// SUGGESTION ENGINE INTERFACES
// ============================================================================

export interface SuggestionEngineConfig {
  patternEngine: PatternEngine;
  taskManager: TaskManager;
  maxSuggestions: number;
  enableBuiltInSuggestions: boolean;
  enableCustomSuggestions: boolean;
  priorityWeights: {
    usage: number;
    recency: number;
    relevance: number;
    category: number;
  };
}

export interface SuggestionFilter {
  categories?: string[];
  requiresPermission?: boolean;
  isCustom?: boolean;
  estimatedTimeMax?: number;
  searchQuery?: string;
}

export interface SuggestionContext {
  websiteContext: WebsiteContext;
  userPreferences?: {
    enabledCategories: WebsiteCategory[];
    disabledSuggestions: string[];
    preferredOutputFormats: string[];
  };
  recentUsage?: {
    taskId: string;
    timestamp: Date;
    success: boolean;
  }[];
}

export interface PrioritizedSuggestion extends Suggestion {
  priority: number;
  relevanceScore: number;
  source: 'builtin' | 'custom' | 'pattern';
  matchingPatterns: string[];
}

// ============================================================================
// SUGGESTION GENERATOR
// ============================================================================

export class SuggestionGenerator {
  private config: SuggestionEngineConfig;
  private suggestionCache = new Map<string, PrioritizedSuggestion[]>();
  private cacheExpiry = new Map<string, number>();

  constructor(config: SuggestionEngineConfig) {
    this.config = config;
  }

  /**
   * Generates suggestions for the current website context
   */
  async generateSuggestions(context: SuggestionContext): Promise<PrioritizedSuggestion[]> {
    try {
      // Check cache first
      const cacheKey = this.generateCacheKey(context);
      if (this.isCacheValid(cacheKey)) {
        const cached = this.suggestionCache.get(cacheKey);
        if (cached) {
          console.log('Returning cached suggestions');
          return cached;
        }
      }

      const suggestions: PrioritizedSuggestion[] = [];

      // Generate built-in suggestions
      if (this.config.enableBuiltInSuggestions) {
        const builtInSuggestions = await this.generateBuiltInSuggestions(context);
        suggestions.push(...builtInSuggestions);
      }

      // Generate custom task suggestions
      if (this.config.enableCustomSuggestions) {
        const customSuggestions = await this.generateCustomSuggestions(context);
        suggestions.push(...customSuggestions);
      }

      // Generate pattern-based suggestions
      const patternSuggestions = await this.generatePatternSuggestions(context);
      suggestions.push(...patternSuggestions);

      // Apply prioritization
      const prioritizedSuggestions = this.prioritizeSuggestions(suggestions, context);

      // Apply user preferences and filters
      const filteredSuggestions = this.applyUserPreferences(prioritizedSuggestions, context);

      // Limit to max suggestions
      const finalSuggestions = filteredSuggestions.slice(0, this.config.maxSuggestions);

      // Cache the results
      this.cacheResults(cacheKey, finalSuggestions);

      console.log(`Generated ${finalSuggestions.length} suggestions for ${context.websiteContext.domain}`);
      return finalSuggestions;

    } catch (error) {
      console.error('Failed to generate suggestions:', error);
      return [];
    }
  }

  /**
   * Generates built-in suggestions based on website category
   */
  private async generateBuiltInSuggestions(context: SuggestionContext): Promise<PrioritizedSuggestion[]> {
    const suggestions: PrioritizedSuggestion[] = [];
    const { websiteContext } = context;

    // Get patterns from pattern engine
    const patterns = this.config.patternEngine.getMatchingPatterns(websiteContext);
    
    for (const pattern of patterns) {
      if (pattern.isBuiltIn) {
        for (const suggestion of pattern.suggestions) {
          suggestions.push({
            ...suggestion,
            priority: 0, // Will be calculated later
            relevanceScore: this.calculateRelevanceScore(suggestion, websiteContext),
            source: 'builtin',
            matchingPatterns: [pattern.urlRegex]
          });
        }
      }
    }

    return suggestions;
  }

  /**
   * Generates suggestions from custom tasks
   */
  private async generateCustomSuggestions(context: SuggestionContext): Promise<PrioritizedSuggestion[]> {
    const suggestions: PrioritizedSuggestion[] = [];
    const { websiteContext } = context;

    // Get matching custom tasks
    const customTasks = await this.config.taskManager.getTasksForWebsite(websiteContext);

    for (const task of customTasks) {
      if (!task.isEnabled) continue;

      const suggestion: PrioritizedSuggestion = {
        id: `custom-${task.id}`,
        title: task.name,
        description: task.description,
        category: this.mapCategoryToString(websiteContext.category),
        taskId: task.id,
        isCustom: true,
        estimatedTime: this.estimateTaskTime(task),
        requiresPermission: this.taskRequiresPermission(task),
        icon: this.getTaskIcon(task),
        priority: 0, // Will be calculated later
        relevanceScore: this.calculateTaskRelevanceScore(task, websiteContext),
        source: 'custom',
        matchingPatterns: task.websitePatterns
      };

      suggestions.push(suggestion);
    }

    return suggestions;
  }

  /**
   * Generates suggestions from pattern matching
   */
  private async generatePatternSuggestions(context: SuggestionContext): Promise<PrioritizedSuggestion[]> {
    const suggestions: PrioritizedSuggestion[] = [];
    const { websiteContext } = context;

    // Get patterns from pattern engine
    const patterns = this.config.patternEngine.getMatchingPatterns(websiteContext);
    
    for (const pattern of patterns) {
      if (!pattern.isBuiltIn) {
        for (const suggestion of pattern.suggestions) {
          suggestions.push({
            ...suggestion,
            priority: 0, // Will be calculated later
            relevanceScore: this.calculateRelevanceScore(suggestion, websiteContext),
            source: 'pattern',
            matchingPatterns: [pattern.urlRegex]
          });
        }
      }
    }

    return suggestions;
  }

  /**
   * Prioritizes suggestions based on various factors
   */
  private prioritizeSuggestions(
    suggestions: PrioritizedSuggestion[], 
    context: SuggestionContext
  ): PrioritizedSuggestion[] {
    const { priorityWeights } = this.config;

    return suggestions.map(suggestion => {
      let priority = 0;

      // Usage-based priority
      if (suggestion.taskId && context.recentUsage) {
        const usageCount = context.recentUsage.filter(u => u.taskId === suggestion.taskId).length;
        const successRate = context.recentUsage.filter(u => u.taskId === suggestion.taskId && u.success).length / Math.max(usageCount, 1);
        priority += (usageCount * successRate * priorityWeights.usage);
      }

      // Recency priority
      if (suggestion.taskId && context.recentUsage) {
        const recentUsage = context.recentUsage
          .filter(u => u.taskId === suggestion.taskId)
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];
        
        if (recentUsage) {
          const daysSinceUse = (Date.now() - recentUsage.timestamp.getTime()) / (1000 * 60 * 60 * 24);
          priority += Math.max(0, (7 - daysSinceUse) * priorityWeights.recency);
        }
      }

      // Relevance priority
      priority += suggestion.relevanceScore * priorityWeights.relevance;

      // Category priority
      priority += this.getCategoryPriority(suggestion.category, context.websiteContext.category) * priorityWeights.category;

      return {
        ...suggestion,
        priority
      };
    }).sort((a, b) => b.priority - a.priority);
  }

  /**
   * Applies user preferences to filter suggestions
   */
  private applyUserPreferences(
    suggestions: PrioritizedSuggestion[], 
    context: SuggestionContext
  ): PrioritizedSuggestion[] {
    const { userPreferences } = context;
    
    if (!userPreferences) {
      return suggestions;
    }

    return suggestions.filter(suggestion => {
      // Filter by enabled categories
      if (userPreferences.enabledCategories && userPreferences.enabledCategories.length > 0) {
        const suggestionCategory = this.mapStringToCategory(suggestion.category);
        if (!userPreferences.enabledCategories.includes(suggestionCategory)) {
          return false;
        }
      }

      // Filter out disabled suggestions
      if (userPreferences.disabledSuggestions && userPreferences.disabledSuggestions.includes(suggestion.id)) {
        return false;
      }

      return true;
    });
  }

  /**
   * Calculates relevance score for a suggestion
   */
  private calculateRelevanceScore(suggestion: Suggestion, context: WebsiteContext): number {
    let score = 0;

    // Category match
    const suggestionCategory = this.mapStringToCategory(suggestion.category);
    if (suggestionCategory === context.category) {
      score += 10;
    }

    // Page type relevance
    score += this.getPageTypeRelevance(suggestion, context.pageType);

    // Security level consideration
    if (suggestion.requiresPermission && context.securityLevel === SecurityLevel.RESTRICTED) {
      score -= 5;
    }

    // Estimated time consideration (prefer shorter tasks)
    score += Math.max(0, (60 - suggestion.estimatedTime) / 10);

    return Math.max(0, score);
  }

  /**
   * Calculates relevance score for a custom task
   */
  private calculateTaskRelevanceScore(task: CustomTask, context: WebsiteContext): number {
    let score = 0;

    // Pattern matching
    for (const pattern of task.websitePatterns) {
      try {
        const regex = new RegExp(pattern, 'i');
        if (regex.test(context.domain)) {
          score += 15;
        }
        if (regex.test(`https://${context.domain}`)) {
          score += 10;
        }
      } catch (error) {
        // Invalid regex, skip
        continue;
      }
    }

    // Usage history
    score += Math.min(task.usageCount * 0.5, 10);

    // Tag relevance
    const contextKeywords = [
      context.category,
      context.pageType,
      context.domain.split('.')[0]
    ].map(k => k.toLowerCase());

    for (const tag of task.tags) {
      if (contextKeywords.some(keyword => tag.toLowerCase().includes(keyword))) {
        score += 3;
      }
    }

    return score;
  }

  /**
   * Gets category priority based on context
   */
  private getCategoryPriority(suggestionCategory: string, contextCategory: WebsiteCategory): number {
    const categoryMap = this.mapStringToCategory(suggestionCategory);
    
    if (categoryMap === contextCategory) {
      return 10;
    }

    // Related categories get partial priority
    const relatedCategories: Record<WebsiteCategory, WebsiteCategory[]> = {
      [WebsiteCategory.SOCIAL_MEDIA]: [WebsiteCategory.NEWS_CONTENT],
      [WebsiteCategory.ECOMMERCE]: [WebsiteCategory.PRODUCTIVITY],
      [WebsiteCategory.PROFESSIONAL]: [WebsiteCategory.PRODUCTIVITY],
      [WebsiteCategory.NEWS_CONTENT]: [WebsiteCategory.SOCIAL_MEDIA],
      [WebsiteCategory.PRODUCTIVITY]: [WebsiteCategory.PROFESSIONAL, WebsiteCategory.ECOMMERCE],
      [WebsiteCategory.CUSTOM]: []
    };

    const related = relatedCategories[contextCategory] || [];
    if (related.includes(categoryMap)) {
      return 5;
    }

    return 0;
  }

  /**
   * Gets page type relevance for a suggestion
   */
  private getPageTypeRelevance(suggestion: Suggestion, pageType: PageType): number {
    const relevanceMap: Record<string, Record<PageType, number>> = {
      content: {
        [PageType.ARTICLE]: 10,
        [PageType.HOME]: 5,
        [PageType.OTHER]: 3,
        [PageType.PRODUCT]: 2,
        [PageType.PROFILE]: 2,
        [PageType.FORM]: 1
      },
      analysis: {
        [PageType.ARTICLE]: 8,
        [PageType.PRODUCT]: 8,
        [PageType.PROFILE]: 6,
        [PageType.HOME]: 4,
        [PageType.FORM]: 3,
        [PageType.OTHER]: 3
      },
      automation: {
        [PageType.FORM]: 10,
        [PageType.PRODUCT]: 7,
        [PageType.PROFILE]: 6,
        [PageType.HOME]: 3,
        [PageType.ARTICLE]: 2,
        [PageType.OTHER]: 2
      }
    };

    return relevanceMap[suggestion.category]?.[pageType] || 0;
  }

  /**
   * Estimates task execution time
   */
  private estimateTaskTime(task: CustomTask): number {
    let baseTime = 30; // Base 30 seconds

    // Adjust based on prompt complexity
    const promptLength = task.promptTemplate.length;
    if (promptLength > 500) baseTime += 20;
    if (promptLength > 1000) baseTime += 30;

    // Adjust based on automation steps
    if (task.automationSteps && task.automationSteps.length > 0) {
      baseTime += task.automationSteps.length * 10;
    }

    // Adjust based on output format
    switch (task.outputFormat) {
      case 'html':
      case 'json':
        baseTime += 10;
        break;
      case 'markdown':
        baseTime += 5;
        break;
    }

    return Math.min(baseTime, 300); // Cap at 5 minutes
  }

  /**
   * Determines if task requires permission
   */
  private taskRequiresPermission(task: CustomTask): boolean {
    // Check if task has automation steps
    if (task.automationSteps && task.automationSteps.length > 0) {
      return true;
    }

    // Check prompt template for automation keywords
    const automationKeywords = ['click', 'type', 'fill', 'submit', 'automate', 'interact'];
    const promptLower = task.promptTemplate.toLowerCase();
    
    return automationKeywords.some(keyword => promptLower.includes(keyword));
  }

  /**
   * Gets appropriate icon for task
   */
  private getTaskIcon(task: CustomTask): string {
    const iconMap: Record<string, string> = {
      content: '📝',
      analysis: '🔍',
      automation: '🤖',
      research: '📚',
      optimization: '⚡',
      organization: '📋'
    };

    // Try to determine category from task content
    const taskText = `${task.name} ${task.description}`.toLowerCase();
    
    for (const [category, icon] of Object.entries(iconMap)) {
      if (taskText.includes(category)) {
        return icon;
      }
    }

    return task.tags.length > 0 ? '🏷️' : '⚙️';
  }

  /**
   * Maps category string to enum
   */
  private mapStringToCategory(category: string): WebsiteCategory {
    const categoryMap: Record<string, WebsiteCategory> = {
      social_media: WebsiteCategory.SOCIAL_MEDIA,
      ecommerce: WebsiteCategory.ECOMMERCE,
      professional: WebsiteCategory.PROFESSIONAL,
      news_content: WebsiteCategory.NEWS_CONTENT,
      productivity: WebsiteCategory.PRODUCTIVITY,
      custom: WebsiteCategory.CUSTOM
    };

    return categoryMap[category] || WebsiteCategory.CUSTOM;
  }

  /**
   * Maps category enum to string
   */
  private mapCategoryToString(category: WebsiteCategory): string {
    return category.toString();
  }

  /**
   * Generates cache key for suggestions
   */
  private generateCacheKey(context: SuggestionContext): string {
    const keyData = {
      domain: context.websiteContext.domain,
      category: context.websiteContext.category,
      pageType: context.websiteContext.pageType,
      enabledCategories: context.userPreferences?.enabledCategories || [],
      timestamp: Math.floor(Date.now() / (1000 * 60 * 5)) // 5-minute cache buckets
    };

    return btoa(JSON.stringify(keyData));
  }

  /**
   * Checks if cache is valid
   */
  private isCacheValid(cacheKey: string): boolean {
    const expiry = this.cacheExpiry.get(cacheKey);
    return expiry ? Date.now() < expiry : false;
  }

  /**
   * Caches suggestion results
   */
  private cacheResults(cacheKey: string, suggestions: PrioritizedSuggestion[]): void {
    this.suggestionCache.set(cacheKey, suggestions);
    this.cacheExpiry.set(cacheKey, Date.now() + (1000 * 60 * 5)); // 5-minute cache
  }

  /**
   * Clears suggestion cache
   */
  clearCache(): void {
    this.suggestionCache.clear();
    this.cacheExpiry.clear();
  }
}

// ============================================================================
// SUGGESTION FILTER AND CATEGORIZER
// ============================================================================

export class SuggestionFilter {
  /**
   * Filters suggestions based on criteria
   */
  static filterSuggestions(
    suggestions: PrioritizedSuggestion[], 
    filter: SuggestionFilter
  ): PrioritizedSuggestion[] {
    return suggestions.filter(suggestion => {
      // Category filter
      if (filter.categories && filter.categories.length > 0) {
        if (!filter.categories.includes(suggestion.category)) {
          return false;
        }
      }

      // Permission filter
      if (filter.requiresPermission !== undefined) {
        if (suggestion.requiresPermission !== filter.requiresPermission) {
          return false;
        }
      }

      // Custom filter
      if (filter.isCustom !== undefined) {
        if (suggestion.isCustom !== filter.isCustom) {
          return false;
        }
      }

      // Time filter
      if (filter.estimatedTimeMax !== undefined) {
        if (suggestion.estimatedTime > filter.estimatedTimeMax) {
          return false;
        }
      }

      // Search query filter
      if (filter.searchQuery) {
        const query = filter.searchQuery.toLowerCase();
        const searchableText = `${suggestion.title} ${suggestion.description}`.toLowerCase();
        if (!searchableText.includes(query)) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Categorizes suggestions by type
   */
  static categorizeSuggestions(suggestions: PrioritizedSuggestion[]): Record<string, PrioritizedSuggestion[]> {
    const categories: Record<string, PrioritizedSuggestion[]> = {};

    for (const suggestion of suggestions) {
      const category = suggestion.category;
      if (!categories[category]) {
        categories[category] = [];
      }
      categories[category].push(suggestion);
    }

    // Sort each category by priority
    for (const category in categories) {
      categories[category].sort((a, b) => b.priority - a.priority);
    }

    return categories;
  }

  /**
   * Gets available filter options from suggestions
   */
  static getFilterOptions(suggestions: PrioritizedSuggestion[]): {
    categories: string[];
    hasPermissionRequired: boolean;
    hasCustomTasks: boolean;
    timeRange: { min: number; max: number };
  } {
    const categories = [...new Set(suggestions.map(s => s.category))];
    const hasPermissionRequired = suggestions.some(s => s.requiresPermission);
    const hasCustomTasks = suggestions.some(s => s.isCustom);
    const times = suggestions.map(s => s.estimatedTime);
    
    return {
      categories: categories.sort(),
      hasPermissionRequired,
      hasCustomTasks,
      timeRange: {
        min: Math.min(...times),
        max: Math.max(...times)
      }
    };
  }
}

// ============================================================================
// MAIN SUGGESTION ENGINE
// ============================================================================

export class SuggestionEngine {
  private generator: SuggestionGenerator;
  private filter: typeof SuggestionFilter;

  constructor(config: SuggestionEngineConfig) {
    this.generator = new SuggestionGenerator(config);
    this.filter = SuggestionFilter;
  }

  /**
   * Gets suggestions for a website context with optional filtering
   */
  async getSuggestions(
    context: SuggestionContext, 
    filter?: SuggestionFilter
  ): Promise<PrioritizedSuggestion[]> {
    const suggestions = await this.generator.generateSuggestions(context);
    
    if (filter) {
      return this.filter.filterSuggestions(suggestions, filter);
    }
    
    return suggestions;
  }

  /**
   * Gets categorized suggestions
   */
  async getCategorizedSuggestions(
    context: SuggestionContext, 
    filter?: SuggestionFilter
  ): Promise<Record<string, PrioritizedSuggestion[]>> {
    const suggestions = await this.getSuggestions(context, filter);
    return this.filter.categorizeSuggestions(suggestions);
  }

  /**
   * Gets filter options for current suggestions
   */
  async getFilterOptions(context: SuggestionContext): Promise<{
    categories: string[];
    hasPermissionRequired: boolean;
    hasCustomTasks: boolean;
    timeRange: { min: number; max: number };
  }> {
    const suggestions = await this.generator.generateSuggestions(context);
    return this.filter.getFilterOptions(suggestions);
  }

  /**
   * Clears suggestion cache
   */
  clearCache(): void {
    this.generator.clearCache();
  }
}