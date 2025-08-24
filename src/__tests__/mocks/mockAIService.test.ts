/**
 * Mock AI Service Tests
 * 
 * Tests for the mock AI service to ensure it behaves correctly in test scenarios.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  MockAIService,
  createMockAIResponse,
  createMockAIRequest,
  createMockAIError,
  createSuccessfulMockAI,
  createUnreliableMockAI,
  createSlowMockAI,
  createRateLimitedMockAI,
  createCustomMockAI
} from './mockAIService';
import { OutputFormat, TaskType } from '../../types/index';

describe('MockAIService', () => {
  let mockAI: MockAIService;

  beforeEach(() => {
    mockAI = new MockAIService({ successRate: 1.0 }); // Ensure tests are deterministic
  });

  describe('Basic Functionality', () => {
    it('should process requests successfully', async () => {
      const request = createMockAIRequest();
      const response = await mockAI.processRequest(request);

      expect(response.content).toBeDefined();
      expect(response.format).toBe(OutputFormat.PLAIN_TEXT);
      expect(response.confidence).toBeGreaterThan(0);
      expect(response.timestamp).toBeInstanceOf(Date);
      expect(response.requestId).toBeDefined();
    });

    it('should validate responses correctly', () => {
      const validResponse = createMockAIResponse();
      const invalidResponse = { ...validResponse, content: undefined };

      expect(mockAI.validateResponse(validResponse)).toBe(true);
      expect(mockAI.validateResponse(invalidResponse as any)).toBe(false);
    });

    it('should handle errors appropriately', () => {
      const error = createMockAIError('Test error', 'TEST_ERROR', 500);
      const errorResponse = mockAI.handleError(error);

      expect(errorResponse.error).toBe('Test error');
      expect(errorResponse.code).toBe('TEST_ERROR');
      expect(errorResponse.statusCode).toBe(500);
      expect(errorResponse.retryable).toBe(true);
    });
  });

  describe('Request History Tracking', () => {
    it('should track request history', async () => {
      const request1 = createMockAIRequest({ prompt: 'First request' });
      const request2 = createMockAIRequest({ prompt: 'Second request' });

      await mockAI.processRequest(request1);
      await mockAI.processRequest(request2);

      const history = mockAI.getRequestHistory();
      expect(history).toHaveLength(2);
      expect(history[0].prompt).toBe('First request');
      expect(history[1].prompt).toBe('Second request');
    });

    it('should track request count', async () => {
      expect(mockAI.getRequestCount()).toBe(0);

      await mockAI.processRequest(createMockAIRequest());
      expect(mockAI.getRequestCount()).toBe(1);

      await mockAI.processRequest(createMockAIRequest());
      expect(mockAI.getRequestCount()).toBe(2);
    });

    it('should clear history', async () => {
      await mockAI.processRequest(createMockAIRequest());
      expect(mockAI.getRequestCount()).toBe(1);

      mockAI.clearHistory();
      expect(mockAI.getRequestCount()).toBe(0);
      expect(mockAI.getRequestHistory()).toHaveLength(0);
    });
  });

  describe('Configuration Options', () => {
    it('should respect success rate configuration', async () => {
      const unreliableMock = new MockAIService({ successRate: 0.5 });
      
      let successCount = 0;
      let errorCount = 0;

      // Run multiple requests to test success rate
      for (let i = 0; i < 20; i++) {
        try {
          await unreliableMock.processRequest(createMockAIRequest());
          successCount++;
        } catch {
          errorCount++;
        }
      }

      // Should have some failures (not exact due to randomness)
      expect(errorCount).toBeGreaterThan(0);
      expect(successCount).toBeGreaterThan(0);
    });

    it('should simulate latency', async () => {
      const slowMock = new MockAIService({ latency: 100 });
      
      const startTime = Date.now();
      await slowMock.processRequest(createMockAIRequest());
      const duration = Date.now() - startTime;

      expect(duration).toBeGreaterThanOrEqual(90); // Allow some variance
    });

    it('should handle rate limiting', async () => {
      const rateLimitedMock = new MockAIService({
        rateLimitEnabled: true,
        rateLimitMax: 2 // 2 requests per minute
      });

      // First request should succeed
      await rateLimitedMock.processRequest(createMockAIRequest());

      // Second request too soon should fail
      await expect(rateLimitedMock.processRequest(createMockAIRequest()))
        .rejects.toThrow('Rate limit exceeded');
    });
  });

  describe('Response Generation by Task Type', () => {
    it('should generate content generation responses', async () => {
      const request = createMockAIRequest({
        taskType: TaskType.CONTENT_GENERATION,
        context: {
          domain: 'example.com',
          category: 'productivity' as any,
          pageType: 'other' as any,
          extractedData: { title: 'Test Page' },
          securityLevel: 'public' as any,
          timestamp: new Date()
        }
      });

      const response = await mockAI.processRequest(request);

      expect(response.content).toContain('example.com');
      expect(response.content).toContain('Test Page');
      expect(response.suggestions).toBeDefined();
    });

    it('should generate analysis responses', async () => {
      const request = createMockAIRequest({
        taskType: TaskType.ANALYSIS,
        context: {
          domain: 'test.org',
          category: 'productivity' as any,
          pageType: 'other' as any,
          extractedData: { title: 'Analysis Page' },
          securityLevel: 'public' as any,
          timestamp: new Date()
        }
      });

      const response = await mockAI.processRequest(request);

      expect(response.content).toContain('Analysis Report');
      expect(response.content).toContain('test.org');
      expect(response.content).toContain('Analysis Page');
    });

    it('should generate automation responses', async () => {
      const request = createMockAIRequest({
        taskType: TaskType.AUTOMATION,
        outputFormat: OutputFormat.JSON
      });

      const response = await mockAI.processRequest(request);

      expect(response.content).toContain('Automation Plan');
      expect(response.automationInstructions).toBeDefined();
      expect(response.automationInstructions).toHaveLength(2);
    });

    it('should generate extraction responses with JSON format', async () => {
      const request = createMockAIRequest({
        taskType: TaskType.EXTRACTION,
        outputFormat: OutputFormat.JSON
      });

      const response = await mockAI.processRequest(request);

      expect(response.format).toBe(OutputFormat.JSON);
      expect(() => JSON.parse(response.content)).not.toThrow();
      
      const parsed = JSON.parse(response.content);
      expect(parsed.title).toBeDefined();
      expect(parsed.domain).toBeDefined();
    });
  });

  describe('Custom Response Generators', () => {
    it('should use custom response generators', async () => {
      const customMock = new MockAIService({
        responseGenerators: {
          [TaskType.CONTENT_GENERATION]: (request) => ({
            content: `Custom response for ${request.context?.domain}`,
            format: request.outputFormat || OutputFormat.PLAIN_TEXT,
            confidence: 0.95,
            timestamp: new Date(),
            requestId: 'custom-response'
          })
        }
      });

      const request = createMockAIRequest({
        taskType: TaskType.CONTENT_GENERATION,
        context: {
          domain: 'custom.com',
          category: 'productivity' as any,
          pageType: 'other' as any,
          extractedData: {},
          securityLevel: 'public' as any,
          timestamp: new Date()
        }
      });

      const response = await customMock.processRequest(request);

      expect(response.content).toBe('Custom response for custom.com');
      expect(response.requestId).toBe('custom-response');
      expect(response.confidence).toBe(0.95);
    });

    it('should add response generators dynamically', async () => {
      mockAI.addResponseGenerator('custom-task', (request) => ({
        content: 'Dynamic custom response',
        format: OutputFormat.MARKDOWN,
        confidence: 0.9,
        timestamp: new Date(),
        requestId: 'dynamic-response'
      }));

      const request = createMockAIRequest({
        taskType: 'custom-task' as any
      });

      const response = await mockAI.processRequest(request);

      expect(response.content).toBe('Dynamic custom response');
      expect(response.format).toBe(OutputFormat.MARKDOWN);
    });
  });

  describe('Configuration Updates', () => {
    it('should update success rate', async () => {
      mockAI.setSuccessRate(0.0); // Force failures

      await expect(mockAI.processRequest(createMockAIRequest()))
        .rejects.toThrow('Simulated AI service error');
    });

    it('should update latency', async () => {
      mockAI.setLatency(50);

      const startTime = Date.now();
      await mockAI.processRequest(createMockAIRequest());
      const duration = Date.now() - startTime;

      expect(duration).toBeGreaterThanOrEqual(40); // Allow some variance
    });
  });

  describe('Utility Functions', () => {
    it('should create mock AI responses', () => {
      const response = createMockAIResponse({
        content: 'Custom content',
        confidence: 0.75
      });

      expect(response.content).toBe('Custom content');
      expect(response.confidence).toBe(0.75);
      expect(response.format).toBe(OutputFormat.PLAIN_TEXT);
      expect(response.timestamp).toBeInstanceOf(Date);
    });

    it('should create mock AI requests', () => {
      const request = createMockAIRequest({
        prompt: 'Custom prompt',
        taskType: TaskType.ANALYSIS
      });

      expect(request.prompt).toBe('Custom prompt');
      expect(request.taskType).toBe(TaskType.ANALYSIS);
      expect(request.context).toBeDefined();
    });

    it('should create mock AI errors', () => {
      const error = createMockAIError('Custom error', 'CUSTOM_CODE', 400);

      expect(error.message).toBe('Custom error');
      expect(error.code).toBe('CUSTOM_CODE');
      expect(error.statusCode).toBe(400);
    });
  });

  describe('Pre-configured Mock Services', () => {
    it('should create successful mock AI', async () => {
      const successfulMock = createSuccessfulMockAI();
      
      // Should never fail
      for (let i = 0; i < 5; i++) {
        const response = await successfulMock.processRequest(createMockAIRequest());
        expect(response.content).toBeDefined();
      }
    });

    it('should create unreliable mock AI', async () => {
      const unreliableMock = createUnreliableMockAI();
      
      let errorCount = 0;
      for (let i = 0; i < 10; i++) {
        try {
          await unreliableMock.processRequest(createMockAIRequest());
        } catch {
          errorCount++;
        }
      }
      
      expect(errorCount).toBeGreaterThan(0);
    });

    it('should create slow mock AI', async () => {
      const slowMock = createSlowMockAI();
      
      const startTime = Date.now();
      await slowMock.processRequest(createMockAIRequest());
      const duration = Date.now() - startTime;
      
      expect(duration).toBeGreaterThan(1500); // Should be slow
    });

    it('should create rate limited mock AI', async () => {
      const rateLimitedMock = createRateLimitedMockAI();
      
      // First request should succeed
      await rateLimitedMock.processRequest(createMockAIRequest());
      
      // Rapid second request should fail
      await expect(rateLimitedMock.processRequest(createMockAIRequest()))
        .rejects.toThrow('Rate limit exceeded');
    });

    it('should create custom mock AI with generators', async () => {
      const customMock = createCustomMockAI({
        'test-task': (request) => ({
          content: 'Test task response',
          format: OutputFormat.PLAIN_TEXT,
          confidence: 1.0,
          timestamp: new Date(),
          requestId: 'test-task-response'
        })
      });

      const request = createMockAIRequest({
        taskType: 'test-task' as any
      });

      const response = await customMock.processRequest(request);
      expect(response.content).toBe('Test task response');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty prompts', async () => {
      const request = createMockAIRequest({ prompt: '' });
      const response = await mockAI.processRequest(request);

      expect(response.content).toBeDefined();
      expect(response.content.length).toBeGreaterThan(0);
    });

    it('should handle missing context', async () => {
      const request = createMockAIRequest({ context: undefined });
      const response = await mockAI.processRequest(request);

      expect(response.content).toBeDefined();
    });

    it('should handle invalid output formats gracefully', async () => {
      const request = createMockAIRequest({
        outputFormat: 'invalid-format' as any
      });

      const response = await mockAI.processRequest(request);
      expect(response.format).toBe('invalid-format');
    });

    it('should handle very long prompts', async () => {
      const longPrompt = 'word '.repeat(10000); // Very long prompt
      const request = createMockAIRequest({ prompt: longPrompt });

      const response = await mockAI.processRequest(request);
      expect(response.content).toBeDefined();
    });
  });
});