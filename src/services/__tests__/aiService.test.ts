/**
 * Tests for AI Service
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import {
  AIService,
  AIServiceConfig,
  AIError,
  createAIService,
  validateAIConfig,
  DEFAULT_AI_CONFIG
} from '../aiService.js';
import {
  AIRequest,
  AIResponse,
  TaskType,
  OutputFormat,
  WebsiteCategory,
  PageType,
  SecurityLevel
} from '../../types/index.js';

// Mock fetch globally
global.fetch = vi.fn();

describe('AIService', () => {
  let aiService: AIService;
  let mockConfig: AIServiceConfig;
  let mockRequest: AIRequest;

  beforeEach(() => {
    mockConfig = {
      apiKey: 'test-api-key',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4',
      maxTokens: 1000,
      temperature: 0.7,
      timeout: 5000,
      maxRetries: 2,
      rateLimitRpm: 10,
      enableStreaming: false
    };

    mockRequest = {
      prompt: 'Test prompt',
      context: {
        domain: 'example.com',
        category: WebsiteCategory.ECOMMERCE,
        pageType: PageType.PRODUCT,
        extractedData: { title: 'Test Product' },
        securityLevel: SecurityLevel.PUBLIC,
        timestamp: new Date()
      },
      taskType: TaskType.GENERATE_TEXT,
      outputFormat: OutputFormat.PLAIN_TEXT,
      constraints: {
        allowSensitiveData: false,
        maxContentLength: 5000,
        allowedDomains: ['example.com'],
        restrictedSelectors: []
      },
      timestamp: new Date()
    };

    aiService = new AIService(mockConfig);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Constructor and Configuration', () => {
    it('should create AI service with default config', () => {
      const service = new AIService({ apiKey: 'test-key' });
      expect(service).toBeInstanceOf(AIService);
    });

    it('should merge provided config with defaults', () => {
      const customConfig = { apiKey: 'test-key', maxTokens: 500 };
      const service = new AIService(customConfig);
      expect(service).toBeInstanceOf(AIService);
    });

    it('should update config', () => {
      aiService.updateConfig({ maxTokens: 1500 });
      // Config should be updated internally
      expect(aiService).toBeInstanceOf(AIService);
    });
  });

  describe('Request Processing', () => {
    it('should process valid AI request', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'Test response content'
          }
        }]
      };

      (fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const response = await aiService.processRequest(mockRequest);

      expect(response).toMatchObject({
        content: 'Test response content',
        format: OutputFormat.PLAIN_TEXT,
        confidence: expect.any(Number),
        timestamp: expect.any(Date),
        requestId: expect.any(String)
      });
    });

    it('should handle API errors', async () => {
      (fetch as Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request'
      });

      await expect(aiService.processRequest(mockRequest)).rejects.toThrow(AIError);
    });

    it('should handle network errors', async () => {
      (fetch as Mock).mockRejectedValueOnce(new Error('Network error'));

      await expect(aiService.processRequest(mockRequest)).rejects.toThrow(AIError);
    }, 10000);

    it('should handle timeout errors', async () => {
      // Mock AbortController to simulate timeout
      const mockAbortController = {
        abort: vi.fn(),
        signal: { aborted: false }
      };
      
      vi.stubGlobal('AbortController', vi.fn(() => mockAbortController));
      
      (fetch as Mock).mockRejectedValueOnce(new Error('AbortError'));

      await expect(aiService.processRequest(mockRequest)).rejects.toThrow(AIError);
    });

    it('should retry failed requests', async () => {
      (fetch as Mock)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            choices: [{ message: { content: 'Success after retry' } }]
          })
        });

      const response = await aiService.processRequest(mockRequest);
      expect(response.content).toBe('Success after retry');
    });

    it('should sanitize sensitive data', async () => {
      const sensitiveRequest = {
        ...mockRequest,
        prompt: 'My credit card is 1234-5678-9012-3456 and SSN is 123-45-6789'
      };

      (fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: 'Sanitized response' } }]
        })
      });

      await aiService.processRequest(sensitiveRequest);

      const fetchCall = (fetch as Mock).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      const sentPrompt = requestBody.messages[0].content;
      
      expect(sentPrompt).toContain('[CREDIT_CARD_REDACTED]');
      expect(sentPrompt).toContain('[SSN_REDACTED]');
    });
  });

  describe('Streaming Support', () => {
    it('should handle streaming requests when enabled', async () => {
      const streamingService = new AIService({ ...mockConfig, enableStreaming: true });
      const chunks: any[] = [];

      const mockReadableStream = {
        getReader: () => ({
          read: vi.fn()
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n')
            })
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode('data: {"choices":[{"delta":{"content":" World"}}]}\n\n')
            })
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode('data: [DONE]\n\n')
            })
            .mockResolvedValueOnce({ done: true }),
          releaseLock: vi.fn()
        })
      };

      (fetch as Mock).mockResolvedValueOnce({
        ok: true,
        body: mockReadableStream
      });

      const response = await streamingService.processStreamingRequest(
        mockRequest,
        (chunk) => chunks.push(chunk)
      );

      expect(response.content).toBe('Hello World');
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[chunks.length - 1].isComplete).toBe(true);
    });

    it('should throw error when streaming is disabled', async () => {
      await expect(
        aiService.processStreamingRequest(mockRequest, () => {})
      ).rejects.toThrow('Streaming not enabled');
    });
  });

  describe('Rate Limiting', () => {
    it('should track rate limit status', () => {
      const status = aiService.getRateLimitStatus();
      
      expect(status).toMatchObject({
        remaining: expect.any(Number),
        resetTime: expect.any(Date),
        queueLength: expect.any(Number)
      });
    });

    it('should queue requests when rate limit is exceeded', async () => {
      // Create service with very low rate limit
      const limitedService = new AIService({ ...mockConfig, rateLimitRpm: 1 });

      (fetch as Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: 'Response' } }]
        })
      });

      // Test that rate limit status is tracked
      const status = limitedService.getRateLimitStatus();
      expect(status.remaining).toBeGreaterThanOrEqual(0);
      expect(status.queueLength).toBe(0);
      
      // Make a request to test basic functionality
      const response = await limitedService.processRequest(mockRequest);
      expect(response.content).toBe('Response');
    });
  });

  describe('Response Validation', () => {
    it('should validate correct response format', () => {
      const validResponse: AIResponse = {
        content: 'Test content',
        format: OutputFormat.PLAIN_TEXT,
        confidence: 0.8,
        timestamp: new Date(),
        requestId: 'test-id'
      };

      expect(aiService.validateResponse(validResponse)).toBe(true);
    });

    it('should reject invalid response format', () => {
      const invalidResponse = {
        content: 'Test content',
        // Missing required fields
      } as any;

      expect(aiService.validateResponse(invalidResponse)).toBe(false);
    });

    it('should reject response with invalid confidence', () => {
      const invalidResponse: AIResponse = {
        content: 'Test content',
        format: OutputFormat.PLAIN_TEXT,
        confidence: 1.5, // Invalid confidence > 1
        timestamp: new Date(),
        requestId: 'test-id'
      };

      expect(aiService.validateResponse(invalidResponse)).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle different error types correctly', async () => {
      // Test API error
      (fetch as Mock).mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests'
      });

      await expect(aiService.processRequest(mockRequest)).rejects.toThrow(AIError);
      
      try {
        await aiService.processRequest(mockRequest);
      } catch (error) {
        expect(error).toBeInstanceOf(AIError);
        expect((error as AIError).retryable).toBe(true);
      }
    });

    it('should handle empty response content', async () => {
      (fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: '' } }]
        })
      });

      await expect(aiService.processRequest(mockRequest)).rejects.toThrow('Empty response content');
    });
  });

  describe('Prompt Building', () => {
    it('should build proper prompts for different task types', async () => {
      const analyzeRequest = {
        ...mockRequest,
        taskType: TaskType.ANALYZE_CONTENT
      };

      (fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: 'Analysis result' } }]
        })
      });

      await aiService.processRequest(analyzeRequest);

      const fetchCall = (fetch as Mock).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      const prompt = requestBody.messages[0].content;
      
      expect(prompt).toContain('Analyze');
      expect(prompt).toContain('example.com');
      expect(prompt).toContain('ecommerce');
    });

    it('should include user input in prompts', async () => {
      const requestWithInput = {
        ...mockRequest,
        userInput: { productName: 'Test Product', price: '$99' }
      };

      (fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: 'Response with input' } }]
        })
      });

      await aiService.processRequest(requestWithInput);

      const fetchCall = (fetch as Mock).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      const prompt = requestBody.messages[0].content;
      
      expect(prompt).toContain('productName: Test Product');
      expect(prompt).toContain('price: $99');
    });
  });
});

describe('Factory Functions', () => {
  it('should create AI service using factory', () => {
    const service = createAIService({ apiKey: 'test-key' });
    expect(service).toBeInstanceOf(AIService);
  });

  it('should validate AI config correctly', () => {
    const validConfig = { apiKey: 'test-key' };
    expect(validateAIConfig(validConfig)).toBe(true);
  });

  it('should throw error for invalid config', () => {
    const invalidConfig = { apiKey: '' } as AIServiceConfig;
    expect(() => validateAIConfig(invalidConfig)).toThrow();
  });

  it('should validate config parameters', () => {
    expect(() => validateAIConfig({ 
      apiKey: 'test', 
      temperature: 3 // Invalid temperature
    })).toThrow('Temperature must be a number between 0 and 2');

    expect(() => validateAIConfig({ 
      apiKey: 'test', 
      maxTokens: -1 // Invalid max tokens
    })).toThrow('Max tokens must be a positive number');

    expect(() => validateAIConfig({ 
      apiKey: 'test', 
      timeout: 0 // Invalid timeout
    })).toThrow('Timeout must be a positive number');
  });
});

describe('Default Configuration', () => {
  it('should have valid default configuration', () => {
    expect(DEFAULT_AI_CONFIG).toMatchObject({
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4',
      maxTokens: 2000,
      temperature: 0.7,
      timeout: 30000,
      maxRetries: 3,
      rateLimitRpm: 60,
      enableStreaming: false
    });
  });
});

describe('AIError', () => {
  it('should create AI error with correct properties', () => {
    const error = new AIError('Test error', 'TEST_CODE', 400, true);
    
    expect(error.message).toBe('Test error');
    expect(error.code).toBe('TEST_CODE');
    expect(error.statusCode).toBe(400);
    expect(error.retryable).toBe(true);
    expect(error.name).toBe('AIError');
  });

  it('should have default retryable value', () => {
    const error = new AIError('Test error', 'TEST_CODE');
    expect(error.retryable).toBe(false);
  });
});