/**
 * Enhanced Task Execution Pipeline Tests
 * 
 * Tests for the updated task execution pipeline that integrates
 * PromptManager, TextExtractionEngine, and MCP context.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TaskManager, TaskManagerConfig } from '../taskManager.js';
import { ChromeStorageService } from '../storage.js';
import { AIService } from '../aiService.js';
import { PromptManager } from '../promptManager.js';
import { TextExtractionEngine } from '../textExtractionEngine.js';
import { MCPService } from '../mcpService.js';
import {
  CustomTask,
  ExecutionContext,
  TaskResult,
  WebsiteContext,
  AIRequest,
  AIResponse,
  TaskType,
  OutputFormat,
  SecurityLevel,
  WebsiteCategory,
  PageType,
  PageContent
} from '../../types/index.js';

// ============================================================================
// MOCK SETUP
// ============================================================================

// Mock Chrome APIs
const mockChrome = {
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn()
    },
    sync: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn()
    }
  }
};

// @ts-ignore
global.chrome = mockChrome;
global.crypto = {
  randomUUID: () => 'test-uuid-' + Math.random().toString(36).substr(2, 9),
  // @ts-ignore
  getRandomValues: (arr) => arr.map(() => Math.floor(Math.random() * 256))
};

// ============================================================================
// MOCK FACTORIES
// ============================================================================

const createMockTask = (overrides: Partial<CustomTask> = {}): CustomTask => ({
  id: 'test-task-1',
  name: 'Test Task',
  description: 'A test task for validation',
  websitePatterns: ['example\\.com', 'test\\.org'],
  promptTemplate: 'Analyze the content on {{domain}} with title {{pageTitle}}',
  outputFormat: OutputFormat.PLAIN_TEXT,
  automationSteps: [],
  usageCount: 5,
  isEnabled: true,
  tags: ['test', 'example'],
  ...overrides
});

const createMockWebsiteContext = (overrides: Partial<WebsiteContext> = {}): WebsiteContext => ({
  domain: 'example.com',
  category: WebsiteCategory.PRODUCTIVITY,
  pageType: PageType.ARTICLE,
  extractedData: { title: 'Test Page' },
  securityLevel: SecurityLevel.PUBLIC,
  timestamp: new Date(),
  ...overrides
});

const createMockPageContent = (overrides: Partial<PageContent> = {}): PageContent => ({
  url: 'https://example.com/test',
  title: 'Test Page Title',
  headings: ['Main Heading', 'Sub Heading'],
  textContent: 'This is the main text content of the page.',
  forms: [],
  links: [],
  metadata: {},
  extractedAt: new Date(),
  ...overrides
});

const createMockExecutionContext = (overrides: Partial<ExecutionContext> = {}): ExecutionContext => ({
  websiteContext: createMockWebsiteContext(),
  pageContent: createMockPageContent(),
  taskId: 'test-task-1',
  userInput: { customField: 'test value' },
  ...overrides
});

const createMockAIResponse = (overrides: Partial<AIResponse> = {}): AIResponse => ({
  content: 'Generated test content',
  format: OutputFormat.PLAIN_TEXT,
  confidence: 0.8,
  timestamp: new Date(),
  requestId: 'test-request-1',
  ...overrides
});

// ============================================================================
// TEST SUITE
// ============================================================================

describe('Enhanced Task Execution Pipeline', () => {
  let taskManager: TaskManager;
  let mockStorageService: ChromeStorageService;
  let mockAIService: AIService;
  let promptManager: PromptManager;
  let textExtractionEngine: TextExtractionEngine;
  let mcpService: MCPService;

  beforeEach(() => {
    // Setup storage service mock
    mockStorageService = new ChromeStorageService();
    vi.spyOn(mockStorageService, 'getCustomTask').mockResolvedValue(createMockTask());
    vi.spyOn(mockStorageService, 'createCustomTask').mockResolvedValue('test-task-1');
    vi.spyOn(mockStorageService, 'recordTaskUsage').mockResolvedValue();

    // Setup AI service mock
    mockAIService = new AIService({ apiKey: 'test-key' });
    vi.spyOn(mockAIService, 'processRequest').mockResolvedValue(createMockAIResponse());
    vi.spyOn(mockAIService, 'validateResponse').mockReturnValue(true);

    // Create enhanced services
    promptManager = new PromptManager();
    textExtractionEngine = new TextExtractionEngine();
    mcpService = MCPService.getInstance();

    // Mock PromptManager methods
    vi.spyOn(promptManager, 'processCustomTaskPrompt').mockResolvedValue('Processed custom prompt with injected variables');
    vi.spyOn(promptManager, 'analyzeExecutionError').mockReturnValue({
      errorType: 'system',
      userFriendlyMessage: 'System error occurred',
      technicalDetails: 'Mock error details',
      suggestedFix: 'Try again'
    });

    // Mock TextExtractionEngine methods
    vi.spyOn(textExtractionEngine, 'extractCleanContent').mockReturnValue({
      mainText: 'Clean extracted text content from the page',
      headings: [{ content: 'Main Heading', level: 1, context: 'h1' }],
      paragraphs: [{ content: 'First paragraph content', context: 'p1' }],
      lists: [],
      metadata: {
        wordCount: 50,
        readingTime: 1,
        language: 'en',
        extractedAt: new Date(),
        paragraphCount: 1,
        hasStructuredContent: true
      }
    });

    vi.spyOn(textExtractionEngine, 'removeNoiseElements').mockReturnValue('Cleaned text content');

    // Mock MCPService methods
    vi.spyOn(mcpService, 'buildMCPContext').mockResolvedValue({
      resources: [
        {
          uri: 'mcp://website-context/example.com',
          name: 'Website Context',
          description: 'Current website analysis',
          mimeType: 'application/json',
          content: JSON.stringify({ domain: 'example.com', category: 'productivity' })
        }
      ],
      tools: [
        {
          name: 'extract-text',
          description: 'Extract text from page',
          inputSchema: { type: 'object', properties: {} },
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
    });

    // Create enhanced task manager with all services
    const enhancedConfig: TaskManagerConfig = {
      storageService: mockStorageService,
      aiService: mockAIService,
      promptManager,
      textExtractionEngine,
      mcpService,
      enableValidation: true,
      enableTesting: true,
      maxExecutionTime: 30000,
      defaultSecurityConstraints: {
        allowSensitiveData: false,
        maxContentLength: 5000,
        allowedDomains: ['example.com'],
        restrictedSelectors: ['.sensitive']
      }
    };

    taskManager = new TaskManager(enhancedConfig);
  });

  describe('Enhanced Task Execution', () => {
    it('should use PromptManager to process custom task prompts', async () => {
      const task = createMockTask({
        promptTemplate: 'Analyze {{domain}} page with title {{pageTitle}}'
      });
      const context = createMockExecutionContext();

      await taskManager.executeTask(task.id, context);

      expect(promptManager.processCustomTaskPrompt).toHaveBeenCalledWith(
        expect.objectContaining({
          id: task.id,
          promptTemplate: expect.any(String)
        }), 
        expect.objectContaining({
          websiteContext: context.websiteContext,
          pageContent: expect.any(Object),
          userInput: context.userInput,
          taskId: task.id
        })
      );
      expect(mockAIService.processRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: 'Processed custom prompt with injected variables',
          taskId: task.id
        })
      );
    });

    it('should enhance page content with TextExtractionEngine when document is available', async () => {
      // Mock document availability
      const mockDocument = {
        querySelector: vi.fn(),
        querySelectorAll: vi.fn().mockReturnValue([])
      };
      global.document = mockDocument as any;

      const task = createMockTask();
      const context = createMockExecutionContext();

      await taskManager.executeTask(task.id, context);

      expect(textExtractionEngine.extractCleanContent).toHaveBeenCalledWith(mockDocument);
      expect(mockAIService.processRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          pageContent: expect.objectContaining({
            textContent: 'Clean extracted text content from the page',
            metadata: expect.objectContaining({
              extractionMethod: 'intelligent'
            })
          })
        })
      );

      // Cleanup
      delete global.document;
    });

    it('should fallback to basic text cleanup when document is not available', async () => {
      const task = createMockTask();
      const context = createMockExecutionContext();

      await taskManager.executeTask(task.id, context);

      expect(textExtractionEngine.removeNoiseElements).toHaveBeenCalled();
      expect(mockAIService.processRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          pageContent: expect.objectContaining({
            metadata: expect.objectContaining({
              extractionMethod: 'basic-cleanup'
            })
          })
        })
      );
    });

    it('should build and include MCP context in AI requests', async () => {
      const task = createMockTask();
      const context = createMockExecutionContext();

      await taskManager.executeTask(task.id, context);

      expect(mcpService.buildMCPContext).toHaveBeenCalledWith(
        context.websiteContext,
        expect.any(Object), // Enhanced page content
        undefined, // User preferences
        [task] // Current task
      );

      expect(mockAIService.processRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          mcpContext: expect.objectContaining({
            resources: expect.any(Array),
            tools: expect.any(Array),
            metadata: expect.any(Object)
          })
        })
      );
    });

    it('should provide enhanced error analysis for task execution failures', async () => {
      const task = createMockTask();
      const context = createMockExecutionContext();
      const mockError = new Error('Test execution error');

      vi.spyOn(mockAIService, 'processRequest').mockRejectedValue(mockError);

      const result = await taskManager.executeTask(task.id, context);

      expect(result.success).toBe(false);
      expect(result.error).toBe('An unexpected system error occurred during task execution.');
      expect((result as any).debugInfo).toEqual({
        errorType: 'system',
        technicalDetails: 'Test execution error',
        suggestedFix: 'Try again, or contact support if the issue persists.',
        timestamp: expect.any(Date)
      });

      expect(promptManager.analyzeExecutionError).toHaveBeenCalledWith(
        mockError,
        task.id,
        task.promptTemplate
      );
    });

    it('should handle MCP context building failures gracefully', async () => {
      const task = createMockTask();
      const context = createMockExecutionContext();

      vi.spyOn(mcpService, 'buildMCPContext').mockRejectedValue(new Error('MCP context failed'));

      const result = await taskManager.executeTask(task.id, context);

      // Should still succeed with fallback
      expect(result.success).toBe(true);
      expect(mockAIService.processRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: 'Processed custom prompt with injected variables'
        })
      );
    });

    it('should handle text extraction failures gracefully', async () => {
      const task = createMockTask();
      const context = createMockExecutionContext();

      vi.spyOn(textExtractionEngine, 'extractCleanContent').mockImplementation(() => {
        throw new Error('Text extraction failed');
      });

      const result = await taskManager.executeTask(task.id, context);

      // Should still succeed with enhanced page content (fallback text cleanup)
      expect(result.success).toBe(true);
      expect(mockAIService.processRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          pageContent: expect.objectContaining({
            textContent: 'Cleaned text content', // Fallback cleanup
            metadata: expect.objectContaining({
              extractionMethod: 'basic-cleanup'
            })
          })
        })
      );
    });
  });

  describe('Custom Prompt Template Usage', () => {
    it('should verify custom prompt templates are used correctly', async () => {
      const customTemplate = 'Custom task for {{domain}}: {{pageTitle}}';
      const task = createMockTask({ promptTemplate: customTemplate });

      // Mock the storage service to return the task with custom template
      vi.spyOn(mockStorageService, 'getCustomTask').mockResolvedValue(task);

      const result = await taskManager.testCustomPromptUsage(task.id);

      expect(result.success).toBe(true);
      expect(result.customPromptTemplate).toBe(customTemplate);
      expect(result.isCustomPromptUsed).toBe(true);
      expect(promptManager.processCustomTaskPrompt).toHaveBeenCalled();
    });

    it('should provide debugging information for prompt processing', async () => {
      const task = createMockTask();
      const context = createMockExecutionContext();

      const result = await taskManager.executeTaskWithDebug(task.id, context);

      expect(result.success).toBe(true);
      expect(promptManager.processCustomTaskPrompt).toHaveBeenCalledWith(
        task,
        expect.objectContaining({
          websiteContext: context.websiteContext,
          pageContent: expect.any(Object), // Enhanced page content
          userInput: context.userInput,
          taskId: task.id
        })
      );
    });

    it('should preview task prompts without execution', async () => {
      const task = createMockTask({
        promptTemplate: 'Preview task for {{domain}}'
      });
      const context = createMockExecutionContext();

      // Mock the storage service to return the task with preview template
      vi.spyOn(mockStorageService, 'getCustomTask').mockResolvedValue(task);

      const preview = await taskManager.previewTaskPrompt(task.id, context);

      expect(preview).toBe('Processed custom prompt with injected variables');
      expect(promptManager.processCustomTaskPrompt).toHaveBeenCalledWith(
        expect.objectContaining({
          promptTemplate: 'Preview task for {{domain}}'
        }), 
        expect.any(Object)
      );
      expect(mockAIService.processRequest).not.toHaveBeenCalled();
    });
  });

  describe('Error Analysis and Debugging', () => {
    it('should categorize prompt-related errors correctly', async () => {
      const task = createMockTask();
      const context = createMockExecutionContext();
      const promptError = new Error('Template validation failed: unknown variable');

      vi.spyOn(promptManager, 'analyzeExecutionError').mockReturnValue({
        errorType: 'prompt',
        userFriendlyMessage: 'There is an issue with your custom prompt template.',
        technicalDetails: 'Template validation failed: unknown variable',
        suggestedFix: 'Check your template syntax'
      });

      vi.spyOn(mockAIService, 'processRequest').mockRejectedValue(promptError);

      const result = await taskManager.executeTask(task.id, context);

      expect(result.success).toBe(false);
      expect(result.error).toBe('There is an issue with your custom prompt template.');
      expect((result as any).debugInfo.errorType).toBe('prompt');
    });

    it('should categorize MCP-related errors correctly', async () => {
      const task = createMockTask();
      const context = createMockExecutionContext();
      const mcpError = new Error('MCP context building failed');

      vi.spyOn(mockAIService, 'processRequest').mockRejectedValue(mcpError);

      const result = await taskManager.executeTask(task.id, context);

      expect(result.success).toBe(false);
      expect((result as any).debugInfo.errorType).toBe('mcp');
      expect((result as any).debugInfo.suggestedFix).toContain('MCP context building failed');
    });

    it('should categorize text extraction errors correctly', async () => {
      const task = createMockTask();
      const context = createMockExecutionContext();
      const extractionError = new Error('Text extraction failed: DOM access denied');

      vi.spyOn(mockAIService, 'processRequest').mockRejectedValue(extractionError);

      const result = await taskManager.executeTask(task.id, context);

      expect(result.success).toBe(false);
      expect((result as any).debugInfo.errorType).toBe('extraction');
      expect(result.error).toBe('Error occurred while extracting clean text from the page.');
      expect((result as any).debugInfo.technicalDetails).toBe('Text extraction failed: DOM access denied');
    });

    it('should categorize network errors correctly', async () => {
      const task = createMockTask();
      const context = createMockExecutionContext();
      const networkError = new Error('Network timeout: API request failed');

      vi.spyOn(mockAIService, 'processRequest').mockRejectedValue(networkError);

      const result = await taskManager.executeTask(task.id, context);

      expect(result.success).toBe(false);
      expect((result as any).debugInfo.errorType).toBe('network');
      expect((result as any).debugInfo.suggestedFix).toContain('internet connection');
    });
  });
});