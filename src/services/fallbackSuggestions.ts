/**
 * Fallback Suggestions Service
 * 
 * Provides offline suggestions when AI services are unavailable,
 * implements caching strategies, and offers degraded functionality.
 */

import {
  Suggestion,
  WebsiteContext,
  WebsiteCategory,
  PageType,
  OutputFormat,
  TaskType
} from '../types/index.js';

// ============================================================================
// FALLBACK SUGGESTION INTERFACES
// ============================================================================

export interface FallbackSuggestion extends Suggestion {
  template?: string;
  placeholders?: Record<string, string>;
  instructions?: string[];
  isOffline: boolean;
}

export interface OfflineSuggestionSet {
  category: WebsiteCategory;
  pageType?: PageType;
  suggestions: FallbackSuggestion[];
}

export interface CachedResponse {
  id: string;
  prompt: string;
  response: string;
  timestamp: Date;
  context: WebsiteContext;
  usageCount: number;
}

export interface FallbackConfig {
  enableOfflineMode: boolean;
  maxCachedResponses: number;
  cacheExpiryHours: number;
  enableTemplateGeneration: boolean;
  enableInstructionMode: boolean;
}

// ============================================================================
// FALLBACK SUGGESTIONS DATA
// ============================================================================

const OFFLINE_SUGGESTIONS: OfflineSuggestionSet[] = [
  // Social Media Suggestions
  {
    category: WebsiteCategory.SOCIAL_MEDIA,
    suggestions: [
      {
        id: 'social-post-template',
        title: 'Create Engaging Post',
        description: 'Generate a template for an engaging social media post',
        category: 'social_media',
        isCustom: false,
        estimatedTime: 30,
        requiresPermission: false,
        icon: '📱',
        template: 'Check out this amazing [TOPIC]! 🎉\n\n[MAIN_MESSAGE]\n\n#[HASHTAG1] #[HASHTAG2] #[HASHTAG3]',
        placeholders: {
          TOPIC: 'Enter your topic',
          MAIN_MESSAGE: 'Write your main message',
          HASHTAG1: 'First hashtag',
          HASHTAG2: 'Second hashtag',
          HASHTAG3: 'Third hashtag'
        },
        instructions: [
          'Fill in the topic you want to post about',
          'Write your main message (keep it engaging and concise)',
          'Add relevant hashtags to increase visibility',
          'Review and customize the tone to match your brand'
        ],
        isOffline: true
      },
      {
        id: 'social-comment-reply',
        title: 'Reply to Comments',
        description: 'Template for professional comment replies',
        category: 'social_media',
        isCustom: false,
        estimatedTime: 15,
        requiresPermission: false,
        icon: '💬',
        template: 'Thanks for your [COMMENT_TYPE]! [RESPONSE] Feel free to [CALL_TO_ACTION]. 😊',
        placeholders: {
          COMMENT_TYPE: 'comment/question/feedback',
          RESPONSE: 'Your personalized response',
          CALL_TO_ACTION: 'reach out/ask questions/share your thoughts'
        },
        instructions: [
          'Identify the type of comment (question, compliment, criticism)',
          'Craft a personalized response that addresses their point',
          'Include a call-to-action to encourage further engagement',
          'Keep the tone friendly and professional'
        ],
        isOffline: true
      }
    ]
  },

  // E-commerce Suggestions
  {
    category: WebsiteCategory.ECOMMERCE,
    suggestions: [
      {
        id: 'product-comparison',
        title: 'Compare Products',
        description: 'Create a structured product comparison',
        category: 'ecommerce',
        isCustom: false,
        estimatedTime: 45,
        requiresPermission: false,
        icon: '🔍',
        template: 'Product Comparison:\n\n**[PRODUCT1]**\n- Price: [PRICE1]\n- Features: [FEATURES1]\n- Pros: [PROS1]\n- Cons: [CONS1]\n\n**[PRODUCT2]**\n- Price: [PRICE2]\n- Features: [FEATURES2]\n- Pros: [PROS2]\n- Cons: [CONS2]\n\n**Recommendation:** [RECOMMENDATION]',
        placeholders: {
          PRODUCT1: 'First product name',
          PRICE1: 'First product price',
          FEATURES1: 'Key features of first product',
          PROS1: 'Advantages of first product',
          CONS1: 'Disadvantages of first product',
          PRODUCT2: 'Second product name',
          PRICE2: 'Second product price',
          FEATURES2: 'Key features of second product',
          PROS2: 'Advantages of second product',
          CONS2: 'Disadvantages of second product',
          RECOMMENDATION: 'Your final recommendation'
        },
        instructions: [
          'Gather key information about each product (price, features, reviews)',
          'List the main advantages and disadvantages of each',
          'Consider your specific needs and budget',
          'Make a recommendation based on your analysis'
        ],
        isOffline: true
      },
      {
        id: 'review-summary',
        title: 'Summarize Reviews',
        description: 'Create a summary of product reviews',
        category: 'ecommerce',
        isCustom: false,
        estimatedTime: 30,
        requiresPermission: false,
        icon: '⭐',
        template: 'Review Summary for [PRODUCT_NAME]:\n\n**Overall Rating:** [RATING]/5 stars\n\n**Positive Feedback:**\n- [POSITIVE1]\n- [POSITIVE2]\n- [POSITIVE3]\n\n**Common Concerns:**\n- [CONCERN1]\n- [CONCERN2]\n\n**Best For:** [BEST_FOR]\n**Not Ideal For:** [NOT_IDEAL_FOR]',
        placeholders: {
          PRODUCT_NAME: 'Product name',
          RATING: 'Average rating',
          POSITIVE1: 'First positive point',
          POSITIVE2: 'Second positive point',
          POSITIVE3: 'Third positive point',
          CONCERN1: 'First common concern',
          CONCERN2: 'Second common concern',
          BEST_FOR: 'Who this product is best for',
          NOT_IDEAL_FOR: 'Who should avoid this product'
        },
        instructions: [
          'Read through multiple reviews to identify patterns',
          'Note the most frequently mentioned positive aspects',
          'Identify common complaints or concerns',
          'Determine what type of user would benefit most from this product'
        ],
        isOffline: true
      }
    ]
  },

  // Professional/LinkedIn Suggestions
  {
    category: WebsiteCategory.PROFESSIONAL,
    suggestions: [
      {
        id: 'linkedin-post',
        title: 'Professional Post',
        description: 'Create a professional LinkedIn post',
        category: 'professional',
        isCustom: false,
        estimatedTime: 20,
        requiresPermission: false,
        icon: '💼',
        template: '[HOOK_QUESTION]\n\n[MAIN_INSIGHT]\n\n[SUPPORTING_DETAILS]\n\n[CALL_TO_ACTION]\n\n#[INDUSTRY] #[SKILL] #[TOPIC]',
        placeholders: {
          HOOK_QUESTION: 'Engaging opening question',
          MAIN_INSIGHT: 'Your key insight or lesson',
          SUPPORTING_DETAILS: 'Supporting details or examples',
          CALL_TO_ACTION: 'What you want readers to do',
          INDUSTRY: 'Your industry hashtag',
          SKILL: 'Relevant skill hashtag',
          TOPIC: 'Topic hashtag'
        },
        instructions: [
          'Start with a compelling question or statement',
          'Share a valuable insight or lesson learned',
          'Provide specific examples or details',
          'End with a clear call-to-action',
          'Use relevant hashtags to increase visibility'
        ],
        isOffline: true
      },
      {
        id: 'connection-message',
        title: 'Connection Request',
        description: 'Personalized LinkedIn connection message',
        category: 'professional',
        isCustom: false,
        estimatedTime: 10,
        requiresPermission: false,
        icon: '🤝',
        template: 'Hi [NAME],\n\nI noticed [CONNECTION_REASON]. I\'d love to connect and [MUTUAL_BENEFIT].\n\nBest regards,\n[YOUR_NAME]',
        placeholders: {
          NAME: 'Their first name',
          CONNECTION_REASON: 'Why you want to connect',
          MUTUAL_BENEFIT: 'How you can help each other',
          YOUR_NAME: 'Your name'
        },
        instructions: [
          'Personalize with their name and a specific reason for connecting',
          'Mention something specific about their profile or work',
          'Explain how the connection could be mutually beneficial',
          'Keep it concise and professional'
        ],
        isOffline: true
      }
    ]
  },

  // News/Content Suggestions
  {
    category: WebsiteCategory.NEWS_CONTENT,
    suggestions: [
      {
        id: 'article-summary',
        title: 'Summarize Article',
        description: 'Create a structured article summary',
        category: 'news_content',
        isCustom: false,
        estimatedTime: 25,
        requiresPermission: false,
        icon: '📰',
        template: '**Article Summary: [TITLE]**\n\n**Key Points:**\n- [POINT1]\n- [POINT2]\n- [POINT3]\n\n**Main Argument:** [MAIN_ARGUMENT]\n\n**Evidence:** [EVIDENCE]\n\n**Conclusion:** [CONCLUSION]\n\n**My Takeaway:** [PERSONAL_TAKEAWAY]',
        placeholders: {
          TITLE: 'Article title',
          POINT1: 'First key point',
          POINT2: 'Second key point',
          POINT3: 'Third key point',
          MAIN_ARGUMENT: 'The main argument or thesis',
          EVIDENCE: 'Supporting evidence mentioned',
          CONCLUSION: 'Article\'s conclusion',
          PERSONAL_TAKEAWAY: 'Your personal insight or opinion'
        },
        instructions: [
          'Identify the main thesis or argument of the article',
          'Extract 3-5 key supporting points',
          'Note the evidence or data presented',
          'Summarize the author\'s conclusion',
          'Add your own takeaway or perspective'
        ],
        isOffline: true
      }
    ]
  },

  // Productivity Suggestions
  {
    category: WebsiteCategory.PRODUCTIVITY,
    suggestions: [
      {
        id: 'task-breakdown',
        title: 'Break Down Task',
        description: 'Break a complex task into manageable steps',
        category: 'productivity',
        isCustom: false,
        estimatedTime: 15,
        requiresPermission: false,
        icon: '✅',
        template: '**Task:** [MAIN_TASK]\n\n**Goal:** [GOAL]\n\n**Steps:**\n1. [STEP1] (Est. time: [TIME1])\n2. [STEP2] (Est. time: [TIME2])\n3. [STEP3] (Est. time: [TIME3])\n4. [STEP4] (Est. time: [TIME4])\n\n**Resources Needed:** [RESOURCES]\n**Deadline:** [DEADLINE]',
        placeholders: {
          MAIN_TASK: 'The main task to complete',
          GOAL: 'What you want to achieve',
          STEP1: 'First actionable step',
          TIME1: 'Estimated time for step 1',
          STEP2: 'Second actionable step',
          TIME2: 'Estimated time for step 2',
          STEP3: 'Third actionable step',
          TIME3: 'Estimated time for step 3',
          STEP4: 'Fourth actionable step',
          TIME4: 'Estimated time for step 4',
          RESOURCES: 'Tools, people, or materials needed',
          DEADLINE: 'When this needs to be completed'
        },
        instructions: [
          'Define the end goal clearly',
          'Break the task into 4-6 actionable steps',
          'Estimate time for each step realistically',
          'Identify what resources you\'ll need',
          'Set a realistic deadline'
        ],
        isOffline: true
      }
    ]
  }
];

// ============================================================================
// FALLBACK SUGGESTIONS SERVICE
// ============================================================================

export class FallbackSuggestionsService {
  private config: FallbackConfig;
  private cachedResponses: Map<string, CachedResponse> = new Map();

  constructor(config: Partial<FallbackConfig> = {}) {
    this.config = {
      enableOfflineMode: true,
      maxCachedResponses: 100,
      cacheExpiryHours: 24,
      enableTemplateGeneration: true,
      enableInstructionMode: true,
      ...config
    };

    this.loadCachedResponses();
  }

  /**
   * Get fallback suggestions for a website context
   */
  getFallbackSuggestions(context: WebsiteContext): FallbackSuggestion[] {
    if (!this.config.enableOfflineMode) {
      return [];
    }

    const suggestions: FallbackSuggestion[] = [];

    // Find suggestions for the specific category
    const categorySet = OFFLINE_SUGGESTIONS.find(set => set.category === context.category);
    if (categorySet) {
      suggestions.push(...categorySet.suggestions);
    }

    // Add generic suggestions that work for any category
    suggestions.push(...this.getGenericSuggestions());

    // Add cached responses as suggestions
    suggestions.push(...this.getCachedSuggestions(context));

    return suggestions;
  }

  /**
   * Get generic suggestions that work for any website
   */
  private getGenericSuggestions(): FallbackSuggestion[] {
    return [
      {
        id: 'copy-text',
        title: 'Copy Selected Text',
        description: 'Copy the currently selected text to clipboard',
        category: 'utility',
        isCustom: false,
        estimatedTime: 5,
        requiresPermission: false,
        icon: '📋',
        instructions: [
          'Select the text you want to copy',
          'Use Ctrl+C (or Cmd+C on Mac) to copy',
          'The text is now in your clipboard'
        ],
        isOffline: true
      },
      {
        id: 'take-notes',
        title: 'Take Notes',
        description: 'Template for taking structured notes',
        category: 'productivity',
        isCustom: false,
        estimatedTime: 10,
        requiresPermission: false,
        icon: '📝',
        template: '**Notes from [SOURCE]**\n\nDate: [DATE]\nURL: [URL]\n\n**Key Points:**\n- [POINT1]\n- [POINT2]\n- [POINT3]\n\n**Questions:**\n- [QUESTION1]\n- [QUESTION2]\n\n**Action Items:**\n- [ ] [ACTION1]\n- [ ] [ACTION2]',
        placeholders: {
          SOURCE: 'Website or article name',
          DATE: 'Today\'s date',
          URL: 'Current page URL',
          POINT1: 'First important point',
          POINT2: 'Second important point',
          POINT3: 'Third important point',
          QUESTION1: 'First question or follow-up',
          QUESTION2: 'Second question or follow-up',
          ACTION1: 'First action to take',
          ACTION2: 'Second action to take'
        },
        instructions: [
          'Fill in the source and current date',
          'Note the most important points from the page',
          'Write down any questions that come to mind',
          'List specific actions you want to take based on this information'
        ],
        isOffline: true
      }
    ];
  }

  /**
   * Get suggestions based on cached responses
   */
  private getCachedSuggestions(context: WebsiteContext): FallbackSuggestion[] {
    const suggestions: FallbackSuggestion[] = [];
    const relevantCached = Array.from(this.cachedResponses.values())
      .filter(cached => 
        cached.context.domain === context.domain || 
        cached.context.category === context.category
      )
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 3); // Top 3 most used

    for (const cached of relevantCached) {
      suggestions.push({
        id: `cached-${cached.id}`,
        title: `Reuse: ${cached.prompt.slice(0, 30)}...`,
        description: `Previously generated response (used ${cached.usageCount} times)`,
        category: 'cached',
        isCustom: false,
        estimatedTime: 5,
        requiresPermission: false,
        icon: '🔄',
        template: cached.response,
        instructions: [
          'This is a previously generated response',
          'Review and modify as needed for your current context',
          'Click to copy the cached response'
        ],
        isOffline: true
      });
    }

    return suggestions;
  }

  /**
   * Generate content from template
   */
  generateFromTemplate(
    suggestion: FallbackSuggestion, 
    values: Record<string, string>
  ): string {
    if (!suggestion.template) {
      return suggestion.description || '';
    }

    let content = suggestion.template;

    // Replace placeholders with provided values
    if (suggestion.placeholders) {
      for (const [placeholder, defaultValue] of Object.entries(suggestion.placeholders)) {
        const value = values[placeholder] || `[${defaultValue}]`;
        content = content.replace(new RegExp(`\\[${placeholder}\\]`, 'g'), value);
      }
    }

    return content;
  }

  /**
   * Get instructions for manual completion
   */
  getInstructions(suggestion: FallbackSuggestion): string[] {
    if (!this.config.enableInstructionMode) {
      return [];
    }

    return suggestion.instructions || [
      'This is an offline suggestion',
      'Follow the template and customize as needed',
      'Replace placeholders with your specific information'
    ];
  }

  /**
   * Cache a successful AI response for future offline use
   */
  async cacheResponse(
    prompt: string, 
    response: string, 
    context: WebsiteContext
  ): Promise<void> {
    const id = this.generateCacheId(prompt, context);
    
    const existing = this.cachedResponses.get(id);
    if (existing) {
      existing.usageCount++;
      existing.timestamp = new Date();
    } else {
      const cached: CachedResponse = {
        id,
        prompt,
        response,
        timestamp: new Date(),
        context,
        usageCount: 1
      };

      this.cachedResponses.set(id, cached);

      // Remove old entries if we exceed the limit
      if (this.cachedResponses.size > this.config.maxCachedResponses) {
        const oldest = Array.from(this.cachedResponses.entries())
          .sort(([,a], [,b]) => a.timestamp.getTime() - b.timestamp.getTime())[0];
        this.cachedResponses.delete(oldest[0]);
      }
    }

    await this.saveCachedResponses();
  }

  /**
   * Check if AI service is available
   */
  async checkAIAvailability(): Promise<boolean> {
    try {
      // Simple connectivity check
      const response = await fetch('https://api.openai.com/v1/models', {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000)
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get offline mode status
   */
  getOfflineStatus(): {
    isOffline: boolean;
    cachedResponsesCount: number;
    fallbackSuggestionsCount: number;
  } {
    const totalFallbackSuggestions = OFFLINE_SUGGESTIONS.reduce(
      (total, set) => total + set.suggestions.length, 
      0
    );

    return {
      isOffline: !this.config.enableOfflineMode,
      cachedResponsesCount: this.cachedResponses.size,
      fallbackSuggestionsCount: totalFallbackSuggestions
    };
  }

  /**
   * Clear cached responses
   */
  async clearCache(): Promise<void> {
    this.cachedResponses.clear();
    await this.saveCachedResponses();
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<FallbackConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private generateCacheId(prompt: string, context: WebsiteContext): string {
    const key = `${context.domain}-${prompt.slice(0, 50)}`;
    return btoa(key).replace(/[^a-zA-Z0-9]/g, '').slice(0, 16);
  }

  private async loadCachedResponses(): Promise<void> {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      try {
        const result = await chrome.storage.local.get(['cachedResponses']);
        if (result.cachedResponses) {
          const cached = result.cachedResponses;
          
          // Filter out expired entries
          const now = new Date();
          const expiryTime = this.config.cacheExpiryHours * 60 * 60 * 1000;
          
          for (const [id, response] of Object.entries(cached)) {
            const cachedResponse = response as CachedResponse;
            const age = now.getTime() - new Date(cachedResponse.timestamp).getTime();
            
            if (age < expiryTime) {
              this.cachedResponses.set(id, {
                ...cachedResponse,
                timestamp: new Date(cachedResponse.timestamp)
              });
            }
          }
        }
      } catch (error) {
        console.error('Failed to load cached responses:', error);
      }
    }
  }

  private async saveCachedResponses(): Promise<void> {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      try {
        const cached = Object.fromEntries(this.cachedResponses.entries());
        await chrome.storage.local.set({ cachedResponses: cached });
      } catch (error) {
        console.error('Failed to save cached responses:', error);
      }
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const fallbackSuggestions = new FallbackSuggestionsService();

export default fallbackSuggestions;