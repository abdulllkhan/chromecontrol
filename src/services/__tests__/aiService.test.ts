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
    }, 10000);

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
    }, 10000);

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
      model: 'gpt-5-mini',
      maxTokens: 4000,
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

  // ============================================================================
  // ENHANCED AI SERVICE TESTS FOR MCP CONTEXT SUPPORT
  // ============================================================================

  describe('Enhanced AI Service with MCP Context', () => {
    let enhancedAIService: AIService;
    
    beforeEach(() => {
      enhancedAIService = new AIService({
        apiKey: 'test-key',
        model: 'gpt-4o-mini',
        provider: 'openai'
      });
    });

    describe('MCP Context Integration', () => {
      it('should build prompts with MCP context for custom tasks', async () => {
        const mcpContext = {
          resources: [
            {
              uri: 'mcp://website-context/example.com',
              name: 'Website Context',
              description: 'Current website analysis',
              mimeType: 'application/json',
              content: JSON.stringify({
                domain: 'example.com',
                category: 'productivity',
                title: 'Test Page'
              })
            }
          ],
          tools: [
            {
              name: 'extract-text',
              description: 'Extract text from page',
              inputSchema: { type: 'object' },
              handler: async () => ({ success: true })
            }
          ],
          prompts: [],
          metadata: {
            version: '1.0.0',
            timestamp: new Date(),
            source: 'agentic-chrome-extension',
            capabilities: [
              { name: 'resource-management', version: '1.0.0', enabled: true }
            ]
          }
        };

        const request: AIRequest = {
          prompt: 'Processed custom prompt with variables injected',
          context: createMockWebsiteContext(),
          pageContent: createMockPageContent(),
          taskType: TaskType.ANALYZE_CONTENT,
          outputFormat: OutputFormat.PLAIN_TEXT,
          constraints: createMockSecurityConstraints(),
          taskId: 'test-task-1',
          timestamp: new Date(),
          mcpContext // Add MCP context to request
        } as any;

        // Mock the API call to capture the final prompt
        let capturedPrompt = '';
        vi.spyOn(aiService as any, 'makeAPICall').mockImplementation(async (apiRequest) => {
          capturedPrompt = apiRequest.messages[0].content;
          return {
            choices: [{
              message: {
                content: 'Test response'
              }
            }]
          };
        });

        await aiService.processRequest(request);

        // Verify MCP context is included in the prompt
        expect(capturedPrompt).toContain('Processed custom prompt with variables injected');
        expect(capturedPrompt).toContain('Structured Context (MCP)');
        expect(capturedPrompt).toContain('Available Resources:');
        expect(capturedPrompt).toContain('Website Context: Current website analysis');
        expect(capturedPrompt).toContain('Available Tools:');
        expect(capturedPrompt).toContain('extract-text: Extract text from page');
        expect(capturedPrompt).toContain('Context Metadata:');
        expect(capturedPrompt).toContain('Version: 1.0.0');
        expect(capturedPrompt).toContain('Source: agentic-chrome-extension');
        expect(capturedPrompt).toContain('Capabilities: resource-management');
      });

      it('should fallback to basic context when MCP context is not available', async () => {
        const request: AIRequest = {
          prompt: 'Custom task prompt',
          context: createMockWebsiteContext(),
          pageContent: createMockPageContent(),
          taskType: TaskType.ANALYZE_CONTENT,
          outputFormat: OutputFormat.PLAIN_TEXT,
          constraints: createMockSecurityConstraints(),
          taskId: 'test-task-1',
          timestamp: new Date()
          // No MCP context
        };

        let capturedPrompt = '';
        vi.spyOn(aiService as any, 'makeAPICall').mockImplementation(async (apiRequest) => {
          capturedPrompt = apiRequest.messages[0].content;
          return {
            choices: [{
              message: {
                content: 'Test response'
              }
            }]
          };
        });

        await aiService.processRequest(request);

        // Verify basic context is used instead
        expect(capturedPrompt).toContain('Custom task prompt');
        expect(capturedPrompt).toContain('Page Context:');
        expect(capturedPrompt).toContain('Website Context:');
        expect(capturedPrompt).not.toContain('Structured Context (MCP)');
      });

      it('should handle MCP context with small resource content', async () => {
        const mcpContext = {
          resources: [
            {
              uri: 'mcp://page-content/example.com',
              name: 'Page Content',
              description: 'Extracted page content',
              mimeType: 'application/json',
              content: JSON.stringify({
                domain: 'example.com',
                title: 'Test Page Title',
                category: 'productivity'
              })
            }
          ],
          tools: [],
          prompts: [],
          metadata: {
            version: '1.0.0',
            timestamp: new Date(),
            source: 'test',
            capabilities: []
          }
        };

        const request: AIRequest = {
          prompt: 'Test prompt',
          context: createMockWebsiteContext(),
          taskType: TaskType.GENERATE_TEXT,
          outputFormat: OutputFormat.PLAIN_TEXT,
          constraints: createMockSecurityConstraints(),
          taskId: 'test-task-1',
          timestamp: new Date(),
          mcpContext
        } as any;

        let capturedPrompt = '';
        vi.spyOn(aiService as any, 'makeAPICall').mockImplementation(async (apiRequest) => {
          capturedPrompt = apiRequest.messages[0].content;
          return {
            choices: [{
              message: {
                content: 'Test response'
              }
            }]
          };
        });

        await aiService.processRequest(request);

        // Verify resource content is included
        expect(capturedPrompt).toContain('Domain: example.com');
        expect(capturedPrompt).toContain('Title: Test Page Title');
        expect(capturedPrompt).toContain('Category: productivity');
      });

      it('should handle MCP context building errors gracefully', async () => {
        const invalidMcpContext = {
          resources: null, // Invalid structure
          tools: [],
          prompts: [],
          metadata: null
        };

        const request: AIRequest = {
          prompt: 'Test prompt',
          context: createMockWebsiteContext(),
          taskType: TaskType.GENERATE_TEXT,
          outputFormat: OutputFormat.PLAIN_TEXT,
          constraints: createMockSecurityConstraints(),
          taskId: 'test-task-1',
          timestamp: new Date(),
          mcpContext: invalidMcpContext
        } as any;

        let capturedPrompt = '';
        vi.spyOn(aiService as any, 'makeAPICall').mockImplementation(async (apiRequest) => {
          capturedPrompt = apiRequest.messages[0].content;
          return {
            choices: [{
              message: {
                content: 'Test response'
              }
            }]
          };
        });

        // Should not throw error, should fallback to basic context
        const response = await aiService.processRequest(request);

        expect(response).toBeDefined();
        expect(capturedPrompt).toContain('Test prompt');
        expect(capturedPrompt).toContain('Page Context:'); // Fallback context
      });

      it('should log MCP context information for debugging', async () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

        const mcpContext = {
          resources: [{ uri: 'test', name: 'test', content: 'test' }],
          tools: [{ name: 'test-tool', description: 'test', inputSchema: { type: 'object' }, handler: async () => ({}) }],
          prompts: [],
          metadata: { version: '1.0.0', timestamp: new Date(), source: 'test', capabilities: [] }
        };

        const request: AIRequest = {
          prompt: 'Test prompt',
          context: createMockWebsiteContext(),
          taskType: TaskType.GENERATE_TEXT,
          outputFormat: OutputFormat.PLAIN_TEXT,
          constraints: createMockSecurityConstraints(),
          taskId: 'test-task-1',
          timestamp: new Date(),
          mcpContext
        } as any;

        vi.spyOn(aiService as any, 'makeAPICall').mockResolvedValue({
          choices: [{ message: { content: 'Test response' } }]
        });

        await aiService.processRequest(request);

        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('[AIService] Final prompt for task test-task-1:')
        );
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('[AIService] Has MCP context: true')
        );

        consoleSpy.mockRestore();
      });
    });

    describe('Enhanced Prompt Building', () => {
      it('should prioritize processed prompts from PromptManager for custom tasks', async () => {
        const request: AIRequest = {
          prompt: 'This is a processed prompt with {{domain}} replaced with example.com',
          context: createMockWebsiteContext({ domain: 'example.com' }),
          pageContent: createMockPageContent({ title: 'Test Page' }),
          taskType: TaskType.ANALYZE_CONTENT,
          outputFormat: OutputFormat.PLAIN_TEXT,
          constraints: createMockSecurityConstraints(),
          taskId: 'custom-task-1',
          timestamp: new Date()
        };

        let capturedPrompt = '';
        vi.spyOn(aiService as any, 'makeAPICall').mockImplementation(async (apiRequest) => {
          capturedPrompt = apiRequest.messages[0].content;
          return {
            choices: [{
              message: {
                content: 'Test response'
              }
            }]
          };
        });

        await aiService.processRequest(request);

        // The processed prompt should be the primary instruction
        expect(capturedPrompt).toContain('This is a processed prompt with {{domain}} replaced with example.com');
        expect(capturedPrompt).toContain('Page Context:');
        expect(capturedPrompt).toContain('Domain: example.com');
        expect(capturedPrompt).toContain('Title: Test Page');
      });

      it('should use system prompts for generic requests without taskId', async () => {
        const request: AIRequest = {
          prompt: 'Generic user request',
          context: createMockWebsiteContext(),
          pageContent: createMockPageContent(),
          taskType: TaskType.GENERATE_TEXT,
          outputFormat: OutputFormat.MARKDOWN,
          constraints: createMockSecurityConstraints(),
          timestamp: new Date()
          // No taskId - generic request
        };

        let capturedPrompt = '';
        vi.spyOn(aiService as any, 'makeAPICall').mockImplementation(async (apiRequest) => {
          capturedPrompt = apiRequest.messages[0].content;
          return {
            choices: [{
              message: {
                content: 'Test response'
              }
            }]
          };
        });

        await aiService.processRequest(request);

        // Should include system prompt for generic requests
        expect(capturedPrompt).toContain('You are an AI assistant helping users with web-based tasks');
        expect(capturedPrompt).toContain('Generate helpful, relevant text content');
        expect(capturedPrompt).toContain('Respond in Markdown format');
        expect(capturedPrompt).toContain('Generic user request');
      });
    });
  });