/**
 * Mock AI Service for Testing
 * 
 * Provides a mock implementation of the AI service for testing purposes,
 * allowing tests to run without making actual API calls.
 */

import { 
  AIService, 
  AIRequest, 
  AIResponse, 
  ErrorResponse,
  OutputFormat,
  TaskType 
} from '../../types/index';

// Create a simple AIError class for testing
export class AIError extends Error {
  constructor(
    message: string,
    public code: string = 'UNKNOWN_ERROR',
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'AIError';
  }
}

export interface MockAIServiceConfig {
  /** Simulate network latency (ms) */
  latency?: number;
  /** Probability of success (0-1) */
  successRate?: number;
  /** Default response content */
  defaultResponse?: string;
  /** Simulate rate limiting */
  rateLimitEnabled?: boolean;
  /** Maximum requests per minute */
  rateLimitMax?: number;
  /** Custom response generators */
  responseGenerators?: Record<string, (request: AIRequest) => AIResponse>;
}

export class MockAIService implements AIService {
  private config: Required<MockAIServiceConfig>;
  private requestCount = 0;
  private lastRequestTime = 0;
  private requestHistory: AIRequest[] = [];

  constructor(config: MockAIServiceConfig = {}) {
    this.config = {
      latency: config.latency ?? 100,
      successRate: config.successRate ?? 0.9,
      defaultResponse: config.defaultResponse ?? 'Mock AI response',
      rateLimitEnabled: config.rateLimitEnabled ?? false,
      rateLimitMax: config.rateLimitMax ?? 60,
      responseGenerators: config.responseGenerators ?? {}
    };
  }

  async processRequest(request: AIRequest): Promise<AIResponse> {
    // Record request
    this.requestHistory.push({ ...request });
    this.requestCount++;

    // Simulate latency
    if (this.config.latency > 0) {
      await new Promise(resolve => setTimeout(resolve, this.config.latency));
    }

    // Check rate limiting
    if (this.config.rateLimitEnabled) {
      const now = Date.now();
      if (now - this.lastRequestTime < (60000 / this.config.rateLimitMax)) {
        throw new AIError('Rate limit exceeded', 'RATE_LIMIT_EXCEEDED', 429);
      }
      this.lastRequestTime = now;
    }

    // Simulate random failures
    if (Math.random() > this.config.successRate) {
      throw new AIError('Simulated AI service error', 'MOCK_ERROR', 500);
    }

    // Use custom response generator if available
    const taskTypeKey = request.taskType || 'default';
    if (this.config.responseGenerators[taskTypeKey]) {
      return this.config.responseGenerators[taskTypeKey](request);
    }

    // Generate mock response based on request
    return this.generateMockResponse(request);
  }

  validateResponse(response: AIResponse): boolean {
    return !!(
      response.content &&
      response.format &&
      response.confidence !== undefined &&
      response.timestamp &&
      response.requestId
    );
  }

  handleError(error: AIError): ErrorResponse {
    return {
      error: error.message,
      code: error.code,
      statusCode: error.statusCode,
      timestamp: new Date(),
      requestId: `mock-error-${Date.now()}`,
      retryable: error.statusCode !== 401 && error.statusCode !== 403
    };
  }

  // Mock-specific methods for testing

  getRequestHistory(): AIRequest[] {
    return [...this.requestHistory];
  }

  getRequestCount(): number {
    return this.requestCount;
  }

  clearHistory(): void {
    this.requestHistory = [];
    this.requestCount = 0;
  }

  setSuccessRate(rate: number): void {
    this.config.successRate = Math.max(0, Math.min(1, rate));
  }

  setLatency(ms: number): void {
    this.config.latency = Math.max(0, ms);
  }

  addResponseGenerator(taskType: string, generator: (request: AIRequest) => AIResponse): void {
    this.config.responseGenerators[taskType] = generator;
  }

  private generateMockResponse(request: AIRequest): AIResponse {
    const baseResponse: AIResponse = {
      content: this.generateContentByTaskType(request),
      format: request.outputFormat || OutputFormat.PLAIN_TEXT,
      confidence: 0.8 + Math.random() * 0.2, // 0.8-1.0
      timestamp: new Date(),
      requestId: `mock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };

    // Add suggestions for certain task types
    if (request.taskType === TaskType.CONTENT_GENERATION) {
      baseResponse.suggestions = [
        'Consider adding more specific examples',
        'Include relevant statistics or data',
        'Add a call-to-action at the end'
      ];
    }

    // Add automation instructions for automation tasks
    if (request.taskType === TaskType.AUTOMATION) {
      baseResponse.automationInstructions = [
        {
          type: 'click',
          selector: '#mock-button',
          description: 'Click the mock button'
        },
        {
          type: 'type',
          selector: '#mock-input',
          value: 'Mock input value',
          description: 'Type mock value'
        }
      ];
    }

    return baseResponse;
  }

  private generateContentByTaskType(request: AIRequest): string {
    const context = request.context;
    const domain = context?.domain || 'example.com';
    const title = context?.extractedData?.title || 'Page Title';

    switch (request.taskType) {
      case TaskType.CONTENT_GENERATION:
        return this.generateContentGenerationResponse(request, domain, title);
      
      case TaskType.ANALYSIS:
        return this.generateAnalysisResponse(request, domain, title);
      
      case TaskType.SUMMARIZATION:
        return this.generateSummarizationResponse(request, domain, title);
      
      case TaskType.AUTOMATION:
        return this.generateAutomationResponse(request, domain, title);
      
      case TaskType.EXTRACTION:
        return this.generateExtractionResponse(request, domain, title);
      
      default:
        return `Mock AI response for ${domain}: ${title}\n\nGenerated content based on the prompt: "${request.prompt.substring(0, 100)}..."`;
    }
  }

  private generateContentGenerationResponse(request: AIRequest, domain: string, title: string): string {
    const templates = [
      `# Content for ${domain}

Based on "${title}", here's generated content:

## Key Points
- Relevant information extracted from the page
- AI-generated insights and recommendations
- Actionable next steps

## Generated Content
This is mock content generated specifically for ${domain}. The content takes into account the page context and user requirements.

*Generated by Mock AI Service*`,

      `**Social Media Post for ${domain}**

🚀 Exciting update from ${title}!

Key highlights:
✅ Important feature or benefit
✅ User value proposition  
✅ Call to action

#${domain.replace('.', '')} #AI #MockContent`,

      `## Email Template for ${domain}

Subject: Regarding ${title}

Dear [Name],

I hope this email finds you well. I'm writing to follow up on ${title} from ${domain}.

Key points to discuss:
- Main topic or concern
- Proposed solution or next steps
- Timeline and expectations

Best regards,
[Your Name]`
    ];

    // Use domain to determine which template to use for consistency
    const templateIndex = domain.length % templates.length;
    return templates[templateIndex];
  }

  private generateAnalysisResponse(request: AIRequest, domain: string, title: string): string {
    return `# Analysis Report for ${domain}

## Page Analysis: ${title}

### Content Overview
- **Domain**: ${domain}
- **Page Type**: ${request.context?.pageType || 'General'}
- **Security Level**: ${request.context?.securityLevel || 'Public'}

### Key Findings
1. **Content Quality**: The page contains relevant information with good structure
2. **User Experience**: Navigation and layout appear user-friendly
3. **SEO Factors**: Title and content are optimized for search engines

### Recommendations
- Consider adding more interactive elements
- Improve page loading speed
- Enhance mobile responsiveness

### Confidence Score: ${Math.floor(80 + Math.random() * 20)}%

*Analysis generated by Mock AI Service*`;
  }

  private generateSummarizationResponse(request: AIRequest, domain: string, title: string): string {
    return `## Summary of ${title}

**Source**: ${domain}

### Key Points
• Main topic or theme of the content
• Important details and supporting information  
• Relevant statistics or data points
• Conclusions and takeaways

### Action Items
1. Follow up on important points
2. Research additional information
3. Share findings with relevant stakeholders

**Summary Length**: ~150 words
**Confidence**: ${Math.floor(85 + Math.random() * 15)}%

*Summarized by Mock AI Service*`;
  }

  private generateAutomationResponse(request: AIRequest, domain: string, title: string): string {
    return `# Automation Plan for ${domain}

## Target Page: ${title}

### Automation Steps
1. **Navigate** to target elements
2. **Extract** relevant information
3. **Process** data according to requirements
4. **Execute** specified actions

### Expected Results
- Automated task completion
- Data extraction and processing
- User interaction simulation

### Safety Measures
- Validation before each step
- Error handling and recovery
- User confirmation for critical actions

**Automation Confidence**: ${Math.floor(75 + Math.random() * 20)}%

*Automation plan by Mock AI Service*`;
  }

  private generateExtractionResponse(request: AIRequest, domain: string, title: string): string {
    const extractedData = {
      title: title,
      domain: domain,
      extractedText: "Sample extracted text content",
      keyPhrases: ["important", "relevant", "extracted"],
      entities: ["Entity 1", "Entity 2"],
      sentiment: "positive",
      confidence: Math.floor(80 + Math.random() * 20)
    };

    if (request.outputFormat === OutputFormat.JSON) {
      return JSON.stringify(extractedData, null, 2);
    }

    return `# Data Extraction Results

## Source Information
- **Title**: ${title}
- **Domain**: ${domain}
- **Extraction Date**: ${new Date().toISOString()}

## Extracted Content
${extractedData.extractedText}

## Key Phrases
${extractedData.keyPhrases.map(phrase => `- ${phrase}`).join('\n')}

## Identified Entities
${extractedData.entities.map(entity => `- ${entity}`).join('\n')}

## Analysis
- **Sentiment**: ${extractedData.sentiment}
- **Confidence**: ${extractedData.confidence}%

*Extracted by Mock AI Service*`;
  }
}

// Utility functions for creating mock responses

export function createMockAIResponse(overrides: Partial<AIResponse> = {}): AIResponse {
  return {
    content: 'Mock AI response content',
    format: OutputFormat.PLAIN_TEXT,
    confidence: 0.85,
    timestamp: new Date(),
    requestId: `mock-${Date.now()}`,
    ...overrides
  };
}

export function createMockAIRequest(overrides: Partial<AIRequest> = {}): AIRequest {
  return {
    prompt: 'Mock AI request prompt',
    context: {
      domain: 'example.com',
      category: 'productivity' as any,
      pageType: 'other' as any,
      extractedData: { title: 'Mock Page' },
      securityLevel: 'public' as any,
      timestamp: new Date()
    },
    taskType: TaskType.CONTENT_GENERATION,
    outputFormat: OutputFormat.PLAIN_TEXT,
    constraints: {
      maxTokens: 1000,
      temperature: 0.7,
      allowSensitiveContent: false
    },
    ...overrides
  };
}

export function createMockAIError(message = 'Mock AI error', code = 'MOCK_ERROR', statusCode = 500): AIError {
  return new AIError(message, code, statusCode);
}

// Pre-configured mock services for common test scenarios

export const createSuccessfulMockAI = () => new MockAIService({
  successRate: 1.0,
  latency: 50
});

export const createUnreliableMockAI = () => new MockAIService({
  successRate: 0.6,
  latency: 200
});

export const createSlowMockAI = () => new MockAIService({
  successRate: 0.9,
  latency: 2000
});

export const createRateLimitedMockAI = () => new MockAIService({
  successRate: 0.9,
  latency: 100,
  rateLimitEnabled: true,
  rateLimitMax: 10
});

export const createCustomMockAI = (generators: Record<string, (request: AIRequest) => AIResponse>) => 
  new MockAIService({
    successRate: 1.0,
    latency: 100,
    responseGenerators: generators
  });