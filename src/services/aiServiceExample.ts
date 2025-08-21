/**
 * Example usage of the AI Service
 * 
 * This file demonstrates how to use the AI service for various tasks
 * in the Chrome extension context.
 */

import {
  AIService,
  createAIService,
  DEFAULT_AI_CONFIG,
  AIError
} from './aiService.js';
import {
  AIRequest,
  TaskType,
  OutputFormat,
  WebsiteCategory,
  PageType,
  SecurityLevel
} from '../types/index.js';

// ============================================================================
// EXAMPLE CONFIGURATIONS
// ============================================================================

/**
 * Example: Basic AI service setup
 */
export function createBasicAIService(apiKey: string): AIService {
  return createAIService({
    apiKey,
    ...DEFAULT_AI_CONFIG,
    maxTokens: 1500,
    temperature: 0.8
  });
}

/**
 * Example: AI service with streaming enabled
 */
export function createStreamingAIService(apiKey: string): AIService {
  return createAIService({
    apiKey,
    ...DEFAULT_AI_CONFIG,
    enableStreaming: true,
    maxTokens: 2000
  });
}

/**
 * Example: AI service with custom rate limiting
 */
export function createRateLimitedAIService(apiKey: string): AIService {
  return createAIService({
    apiKey,
    ...DEFAULT_AI_CONFIG,
    rateLimitRpm: 30, // Lower rate limit
    maxRetries: 5
  });
}

// ============================================================================
// EXAMPLE USAGE SCENARIOS
// ============================================================================

/**
 * Example: Generate social media post content
 */
export async function generateSocialMediaPost(
  aiService: AIService,
  websiteContext: any,
  topic: string
): Promise<string> {
  const request: AIRequest = {
    prompt: `Generate an engaging social media post about: ${topic}. 
             Make it catchy, include relevant hashtags, and keep it under 280 characters.`,
    context: {
      domain: 'twitter.com',
      category: WebsiteCategory.SOCIAL_MEDIA,
      pageType: PageType.FORM,
      extractedData: { topic },
      securityLevel: SecurityLevel.PUBLIC,
      timestamp: new Date()
    },
    taskType: TaskType.GENERATE_TEXT,
    outputFormat: OutputFormat.PLAIN_TEXT,
    constraints: {
      allowSensitiveData: false,
      maxContentLength: 1000,
      allowedDomains: ['twitter.com'],
      restrictedSelectors: []
    },
    timestamp: new Date()
  };

  try {
    const response = await aiService.processRequest(request);
    return response.content;
  } catch (error) {
    if (error instanceof AIError) {
      console.error('AI Service Error:', error.message, error.code);
      throw new Error(`Failed to generate social media post: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Example: Analyze e-commerce product page
 */
export async function analyzeProductPage(
  aiService: AIService,
  pageContent: any
): Promise<{ summary: string; pros: string[]; cons: string[]; rating: number }> {
  const request: AIRequest = {
    prompt: `Analyze this product page and provide:
             1. A brief summary of the product
             2. List of pros (positive aspects)
             3. List of cons (potential drawbacks)
             4. Overall rating out of 10
             
             Product data: ${JSON.stringify(pageContent.extractedData)}`,
    context: {
      domain: pageContent.domain,
      category: WebsiteCategory.ECOMMERCE,
      pageType: PageType.PRODUCT,
      extractedData: pageContent.extractedData,
      securityLevel: SecurityLevel.PUBLIC,
      timestamp: new Date()
    },
    taskType: TaskType.ANALYZE_CONTENT,
    outputFormat: OutputFormat.JSON,
    constraints: {
      allowSensitiveData: false,
      maxContentLength: 5000,
      allowedDomains: [pageContent.domain],
      restrictedSelectors: []
    },
    timestamp: new Date()
  };

  try {
    const response = await aiService.processRequest(request);
    return JSON.parse(response.content);
  } catch (error) {
    if (error instanceof AIError) {
      console.error('Product analysis failed:', error.message);
      // Return fallback analysis
      return {
        summary: 'Unable to analyze product at this time',
        pros: [],
        cons: [],
        rating: 0
      };
    }
    throw error;
  }
}

/**
 * Example: Generate automation instructions
 */
export async function generateAutomationSteps(
  aiService: AIService,
  task: string,
  websiteContext: any
): Promise<any[]> {
  const request: AIRequest = {
    prompt: `Generate step-by-step automation instructions for: ${task}
             
             Provide instructions in this format:
             1. Click on element with selector "..."
             2. Type "..." into input field "..."
             3. Wait for element "..." to appear
             
             Website context: ${websiteContext.domain}`,
    context: websiteContext,
    taskType: TaskType.AUTOMATE_ACTION,
    outputFormat: OutputFormat.PLAIN_TEXT,
    constraints: {
      allowSensitiveData: false,
      maxContentLength: 2000,
      allowedDomains: [websiteContext.domain],
      restrictedSelectors: ['input[type="password"]', '.sensitive-data']
    },
    timestamp: new Date()
  };

  try {
    const response = await aiService.processRequest(request);
    return response.automationInstructions || [];
  } catch (error) {
    if (error instanceof AIError && error.retryable) {
      console.warn('Automation generation failed, retrying...');
      // Could implement retry logic here
    }
    throw error;
  }
}

/**
 * Example: Streaming content generation
 */
export async function generateContentWithStreaming(
  aiService: AIService,
  prompt: string,
  onUpdate: (content: string) => void
): Promise<string> {
  const request: AIRequest = {
    prompt,
    context: {
      domain: 'example.com',
      category: WebsiteCategory.PRODUCTIVITY,
      pageType: PageType.OTHER,
      extractedData: {},
      securityLevel: SecurityLevel.PUBLIC,
      timestamp: new Date()
    },
    taskType: TaskType.GENERATE_TEXT,
    outputFormat: OutputFormat.MARKDOWN,
    constraints: {
      allowSensitiveData: false,
      maxContentLength: 3000,
      allowedDomains: ['example.com'],
      restrictedSelectors: []
    },
    timestamp: new Date()
  };

  try {
    const response = await aiService.processStreamingRequest(
      request,
      (chunk) => {
        onUpdate(chunk.content);
        if (chunk.isComplete) {
          console.log('Streaming complete');
        }
      }
    );

    return response.content;
  } catch (error) {
    if (error instanceof AIError) {
      console.error('Streaming failed:', error.message);
      throw new Error(`Streaming generation failed: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Example: Extract structured data from webpage
 */
export async function extractStructuredData(
  aiService: AIService,
  pageContent: string,
  dataSchema: any
): Promise<any> {
  const request: AIRequest = {
    prompt: `Extract structured data from this webpage content according to the provided schema.
             
             Schema: ${JSON.stringify(dataSchema)}
             
             Page content: ${pageContent}
             
             Return the extracted data as valid JSON matching the schema.`,
    context: {
      domain: 'unknown',
      category: WebsiteCategory.CUSTOM,
      pageType: PageType.OTHER,
      extractedData: { rawContent: pageContent },
      securityLevel: SecurityLevel.CAUTIOUS,
      timestamp: new Date()
    },
    taskType: TaskType.EXTRACT_DATA,
    outputFormat: OutputFormat.JSON,
    constraints: {
      allowSensitiveData: false,
      maxContentLength: 4000,
      allowedDomains: [],
      restrictedSelectors: []
    },
    timestamp: new Date()
  };

  try {
    const response = await aiService.processRequest(request);
    return JSON.parse(response.content);
  } catch (error) {
    if (error instanceof AIError) {
      console.error('Data extraction failed:', error.message);
      return null;
    }
    throw error;
  }
}

// ============================================================================
// ERROR HANDLING EXAMPLES
// ============================================================================

/**
 * Example: Robust error handling with fallbacks
 */
export async function generateWithFallback(
  aiService: AIService,
  primaryPrompt: string,
  fallbackPrompt: string
): Promise<string> {
  try {
    // Try primary request
    const response = await aiService.processRequest({
      prompt: primaryPrompt,
      context: {
        domain: 'example.com',
        category: WebsiteCategory.PRODUCTIVITY,
        pageType: PageType.OTHER,
        extractedData: {},
        securityLevel: SecurityLevel.PUBLIC,
        timestamp: new Date()
      },
      taskType: TaskType.GENERATE_TEXT,
      outputFormat: OutputFormat.PLAIN_TEXT,
      constraints: {
        allowSensitiveData: false,
        maxContentLength: 2000,
        allowedDomains: ['example.com'],
        restrictedSelectors: []
      },
      timestamp: new Date()
    });

    return response.content;
  } catch (error) {
    if (error instanceof AIError) {
      console.warn('Primary request failed, trying fallback:', error.message);
      
      // Try fallback request with simpler prompt
      try {
        const fallbackResponse = await aiService.processRequest({
          prompt: fallbackPrompt,
          context: {
            domain: 'example.com',
            category: WebsiteCategory.PRODUCTIVITY,
            pageType: PageType.OTHER,
            extractedData: {},
            securityLevel: SecurityLevel.PUBLIC,
            timestamp: new Date()
          },
          taskType: TaskType.GENERATE_TEXT,
          outputFormat: OutputFormat.PLAIN_TEXT,
          constraints: {
            allowSensitiveData: false,
            maxContentLength: 1000,
            allowedDomains: ['example.com'],
            restrictedSelectors: []
          },
          timestamp: new Date()
        });

        return fallbackResponse.content;
      } catch (fallbackError) {
        console.error('Both primary and fallback requests failed');
        return 'Unable to generate content at this time. Please try again later.';
      }
    }
    
    throw error;
  }
}

/**
 * Example: Rate limit monitoring and handling
 */
export async function monitorRateLimit(aiService: AIService): Promise<void> {
  const status = aiService.getRateLimitStatus();
  
  console.log('Rate Limit Status:', {
    remaining: status.remaining,
    resetTime: status.resetTime,
    queueLength: status.queueLength
  });

  if (status.remaining < 5) {
    console.warn('Approaching rate limit. Consider throttling requests.');
  }

  if (status.queueLength > 10) {
    console.warn('Request queue is getting long. Consider implementing user feedback.');
  }
}

// ============================================================================
// INTEGRATION EXAMPLES
// ============================================================================

/**
 * Example: Integration with Chrome extension popup
 */
export class PopupAIIntegration {
  private aiService: AIService;

  constructor(apiKey: string) {
    this.aiService = createAIService({
      apiKey,
      ...DEFAULT_AI_CONFIG,
      timeout: 15000, // Shorter timeout for popup
      maxRetries: 2
    });
  }

  async getSuggestions(websiteContext: any): Promise<string[]> {
    try {
      const response = await this.aiService.processRequest({
        prompt: `Based on the current website context, suggest 3-5 helpful AI-powered actions 
                 the user could take. Keep suggestions concise and actionable.`,
        context: websiteContext,
        taskType: TaskType.GENERATE_TEXT,
        outputFormat: OutputFormat.JSON,
        constraints: {
          allowSensitiveData: false,
          maxContentLength: 1000,
          allowedDomains: [websiteContext.domain],
          restrictedSelectors: []
        },
        timestamp: new Date()
      });

      const suggestions = JSON.parse(response.content);
      return Array.isArray(suggestions) ? suggestions : [];
    } catch (error) {
      console.error('Failed to get AI suggestions:', error);
      return [
        'Summarize page content',
        'Extract key information',
        'Generate related questions'
      ];
    }
  }

  async executeQuickTask(task: string, context: any): Promise<string> {
    return await this.aiService.processRequest({
      prompt: task,
      context,
      taskType: TaskType.GENERATE_TEXT,
      outputFormat: OutputFormat.PLAIN_TEXT,
      constraints: {
        allowSensitiveData: false,
        maxContentLength: 1500,
        allowedDomains: [context.domain],
        restrictedSelectors: []
      },
      timestamp: new Date()
    }).then(response => response.content);
  }
}

/**
 * Example: Background service integration
 */
export class BackgroundAIService {
  private aiService: AIService;
  private requestCache = new Map<string, any>();

  constructor(apiKey: string) {
    this.aiService = createAIService({
      apiKey,
      ...DEFAULT_AI_CONFIG,
      rateLimitRpm: 100, // Higher rate limit for background
      enableStreaming: false
    });
  }

  async processWithCache(request: AIRequest): Promise<any> {
    const cacheKey = this.generateCacheKey(request);
    
    if (this.requestCache.has(cacheKey)) {
      console.log('Returning cached response');
      return this.requestCache.get(cacheKey);
    }

    try {
      const response = await this.aiService.processRequest(request);
      this.requestCache.set(cacheKey, response);
      
      // Clean up old cache entries
      if (this.requestCache.size > 100) {
        const firstKey = this.requestCache.keys().next().value;
        this.requestCache.delete(firstKey);
      }
      
      return response;
    } catch (error) {
      console.error('Background AI request failed:', error);
      throw error;
    }
  }

  private generateCacheKey(request: AIRequest): string {
    return `${request.taskType}_${request.context.domain}_${request.prompt.slice(0, 50)}`;
  }
}

// Export examples for use in other parts of the extension
export const AIServiceExamples = {
  createBasicAIService,
  createStreamingAIService,
  createRateLimitedAIService,
  generateSocialMediaPost,
  analyzeProductPage,
  generateAutomationSteps,
  generateContentWithStreaming,
  extractStructuredData,
  generateWithFallback,
  monitorRateLimit,
  PopupAIIntegration,
  BackgroundAIService
};