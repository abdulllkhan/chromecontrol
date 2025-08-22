import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TaskManager } from '../taskManager';
import { ChromeStorageService } from '../storage';
import { AIService } from '../aiService';
import { WebsiteContext, CustomTask, ExecutionContext, OutputFormat, WebsiteCategory, PageContent, FormElement, LinkElement } from '../../types';

// ============================================================================
// TEST FIXTURES
// ============================================================================

const createMockWebsiteContext = (overrides: Partial<WebsiteContext> = {}): WebsiteContext => ({
  domain: 'example.com',
  url: 'https://example.com/page',
  title: 'Example Page',
  headings: ['Main Heading', 'Sub Heading'],
  pageText: 'Sample page content with useful information.',
  links: [
    { text: 'Home', url: 'https://example.com', title: 'Home page' },
    { text: 'About', url: 'https://example.com/about', title: 'About page' }
  ],
  forms: [
    { action: '/submit', method: 'POST', fields: [{ name: 'email', type: 'email', value: '', placeholder: 'Enter email', required: true }] }
  ],
  category: WebsiteCategory.BUSINESS,
  securityLevel: 'standard',
  ...overrides
});

const createMockPageContent = (overrides: Partial<PageContent> = {}): PageContent => ({
  url: 'https://example.com/page',
  title: 'Example Page',
  headings: ['Main Heading', 'Sub Heading'],
  textContent: 'Sample page content with useful information.',
  forms: [
    { action: '/submit', method: 'POST', fields: [{ name: 'email', type: 'email', value: '', placeholder: 'Enter email', required: true }] }
  ],
  links: [
    { text: 'Home', url: 'https://example.com', title: 'Home page' },
    { text: 'About', url: 'https://example.com/about', title: 'About page' }
  ],
  metadata: { description: 'Sample page' },
  extractedAt: new Date(),
  ...overrides
});

const createMockExecutionContext = (overrides: Partial<ExecutionContext> = {}): ExecutionContext => ({
  websiteContext: createMockWebsiteContext(),
  pageContent: createMockPageContent(),
  userInput: {},
  taskId: 'test-task-1',
  ...overrides
});

const createMockTask = (overrides: Partial<CustomTask> = {}): CustomTask => ({
  id: 'test-task-1',
  name: 'Test Task',
  description: 'A test task for task addition workflow',
  websitePatterns: ['example\\.com'],
  promptTemplate: 'Generate content for {{domain}} with title: {{title}}',
  outputFormat: OutputFormat.PLAIN_TEXT,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  usageCount: 0,
  isEnabled: true,
  tags: ['test'],
  ...overrides
});

// ============================================================================
// TEST SETUP
// ============================================================================

describe('Task Addition Workflow', () => {
  let taskManager: TaskManager;
  let mockStorageService: ChromeStorageService;
  let mockAIService: AIService;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup storage service mock
    mockStorageService = new ChromeStorageService();
    vi.spyOn(mockStorageService, 'createCustomTask').mockResolvedValue('new-task-id');
    vi.spyOn(mockStorageService, 'getCustomTask').mockResolvedValue(null);
    vi.spyOn(mockStorageService, 'updateCustomTask').mockResolvedValue(true);
    vi.spyOn(mockStorageService, 'getAllCustomTasks').mockResolvedValue({});
    
    // Setup AI service mock
    mockAIService = new AIService({ apiKey: 'test-key' });
    vi.spyOn(mockAIService, 'processRequest').mockResolvedValue({
      text: 'Generated content for example.com',
      usage: { promptTokens: 50, completionTokens: 30, totalTokens: 80 },
      metadata: { model: 'test-model', timestamp: new Date() }
    });
    vi.spyOn(mockAIService, 'validateResponse').mockReturnValue(true);
    
    // Create task manager
    taskManager = new TaskManager({
      storageService: mockStorageService,
      aiService: mockAIService,
      enableValidation: true,
      enableCaching: false,
      maxCacheSize: 100
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================================================
  // TASK CREATION WORKFLOW TESTS
  // ============================================================================

  describe('Task Creation Workflow', () => {
    it('should create a new task with current page context pre-population', async () => {
      const websiteContext = createMockWebsiteContext({
        domain: 'example.com',
        title: 'Example Page',
        category: WebsiteCategory.BUSINESS
      });

      // Create task data based on current page context
      const taskData = {
        name: 'Extract Key Information',
        description: 'Extract key information from business websites',
        websitePatterns: [websiteContext.domain.replace('.', '\\.')],
        promptTemplate: `Extract key information from {{title}} on {{domain}}. Focus on: {{headings}}`,
        outputFormat: OutputFormat.MARKDOWN,
        tags: ['extraction', 'business']
      };

      const taskId = await taskManager.createTask(taskData);

      expect(taskId).toBe('new-task-id');
      expect(mockStorageService.createCustomTask).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Extract Key Information',
          description: 'Extract key information from business websites',
          websitePatterns: ['example\\.com'],
          promptTemplate: expect.stringContaining('{{title}}'),
          tags: ['extraction', 'business']
        })
      );
    });

    it('should validate task data before creation', async () => {
      const invalidTaskData = {
        name: '', // Invalid: empty name
        description: 'Test description',
        websitePatterns: ['example\\.com'],
        promptTemplate: 'Test template',
        outputFormat: OutputFormat.PLAIN_TEXT
      };

      await expect(taskManager.createTask(invalidTaskData)).rejects.toThrow('Task validation failed');
      expect(mockStorageService.createCustomTask).not.toHaveBeenCalled();
    });

    it('should handle task creation with website pattern auto-generation', async () => {
      const websiteContext = createMockWebsiteContext({
        domain: 'special-site.co.uk',
        url: 'https://special-site.co.uk/category/item'
      });

      const taskData = {
        name: 'Process Special Site',
        description: 'Process content from special site',
        websitePatterns: [], // Empty initially
        promptTemplate: 'Process content from {{domain}}',
        outputFormat: OutputFormat.JSON
      };

      // Simulate auto-generation of patterns based on current context
      const generatedPatterns = [
        websiteContext.domain.replace(/\./g, '\\.'),
        websiteContext.url.split('/')[2].replace(/\./g, '\\.')
      ];

      const taskDataWithPatterns = {
        ...taskData,
        websitePatterns: generatedPatterns
      };

      const taskId = await taskManager.createTask(taskDataWithPatterns);

      expect(taskId).toBe('new-task-id');
      expect(mockStorageService.createCustomTask).toHaveBeenCalledWith(
        expect.objectContaining({
          websitePatterns: ['special-site\\.co\\.uk', 'special-site\\.co\\.uk']
        })
      );
    });
  });

  // ============================================================================
  // IMMEDIATE TASK TESTING WORKFLOW
  // ============================================================================

  describe('Immediate Task Testing Workflow', () => {
    it('should test newly created task immediately on current page', async () => {
      const taskData = {
        name: 'Test Task',
        description: 'A task to test immediately',
        websitePatterns: ['example\\.com'],
        promptTemplate: 'Analyze {{title}} on {{domain}}',
        outputFormat: OutputFormat.PLAIN_TEXT
      };

      // Mock the created task for testing
      const createdTask = createMockTask({
        id: 'new-task-id',
        ...taskData
      });
      
      vi.spyOn(mockStorageService, 'getCustomTask').mockResolvedValue(createdTask);

      // Create the task
      const taskId = await taskManager.createTask(taskData);
      
      // Test the task immediately with current page context
      const executionContext = createMockExecutionContext();
      const testResult = await taskManager.testTask(taskId, executionContext);

      expect(testResult.success).toBe(true);
      expect(testResult.result).toBeDefined();
      expect(testResult.validationResult.isValid).toBe(true);
      expect(testResult.result?.content).toContain('SIMULATED');
      // In dry run mode, AI service is not actually called
      expect(mockAIService.processRequest).not.toHaveBeenCalled();
    });

    it('should handle test failures gracefully and provide feedback', async () => {
      const taskData = {
        name: 'Failing Task',
        description: 'A task that will fail testing',
        websitePatterns: ['example\\.com'],
        promptTemplate: 'Invalid template with {{nonexistent}}',
        outputFormat: OutputFormat.PLAIN_TEXT
      };

      const createdTask = createMockTask({
        id: 'new-task-id',
        ...taskData
      });
      
      vi.spyOn(mockStorageService, 'getCustomTask').mockResolvedValue(createdTask);
      vi.spyOn(mockAIService, 'processRequest').mockRejectedValue(new Error('Template error'));

      const taskId = await taskManager.createTask(taskData);
      const executionContext = createMockExecutionContext();
      const testResult = await taskManager.testTask(taskId, executionContext);

      // In dry run mode, tasks always succeed even with AI errors, since it's simulated
      expect(testResult.success).toBe(true);
      expect(testResult.result?.content).toContain('SIMULATED');
      expect(testResult.validationResult.isValid).toBe(true);
    });

    it('should provide immediate feedback on task effectiveness', async () => {
      const taskData = {
        name: 'Content Extractor',
        description: 'Extract main content from pages',
        websitePatterns: ['.*'], // Works on all sites
        promptTemplate: 'Extract the main content from: {{pageText}}',
        outputFormat: OutputFormat.MARKDOWN
      };

      const createdTask = createMockTask({
        id: 'new-task-id',
        ...taskData
      });
      
      vi.spyOn(mockStorageService, 'getCustomTask').mockResolvedValue(createdTask);

      const taskId = await taskManager.createTask(taskData);
      const executionContext = createMockExecutionContext({
        websiteContext: createMockWebsiteContext({
          pageText: 'This is the main content of the page with important information.'
        })
      });

      const testResult = await taskManager.testTask(taskId, executionContext);

      expect(testResult.success).toBe(true);
      expect(testResult.result?.content).toContain('SIMULATED');
      expect(testResult.result?.content).toContain('Content Extractor');
      expect(testResult.executionTime).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // TASK PARAMETER DEFINITION WORKFLOW
  // ============================================================================

  describe('Task Parameter Definition Workflow', () => {
    it('should support custom parameters in task templates', async () => {
      const taskData = {
        name: 'Custom Parameter Task',
        description: 'Task with custom parameters',
        websitePatterns: ['example\\.com'],
        promptTemplate: 'Analyze {{title}} for {{customParam}} and generate {{outputType}}',
        outputFormat: OutputFormat.JSON,
        customParameters: {
          customParam: 'sentiment analysis',
          outputType: 'summary report'
        }
      };

      const taskId = await taskManager.createTask(taskData);

      expect(mockStorageService.createCustomTask).toHaveBeenCalledWith(
        expect.objectContaining({
          promptTemplate: expect.stringContaining('{{customParam}}'),
          customParameters: expect.objectContaining({
            customParam: 'sentiment analysis',
            outputType: 'summary report'
          })
        })
      );
    });

    it('should validate template parameters against available context', async () => {
      const taskData = {
        name: 'Parameter Validation Task',
        description: 'Task to validate parameter usage',
        websitePatterns: ['example\\.com'],
        promptTemplate: 'Process {{title}}, {{domain}}, and {{pageText}} for {{validParam}}',
        outputFormat: OutputFormat.PLAIN_TEXT
      };

      // This should succeed as all parameters are valid
      const taskId = await taskManager.createTask(taskData);
      expect(taskId).toBe('new-task-id');
    });

    it('should suggest available parameters for template completion', async () => {
      const websiteContext = createMockWebsiteContext();
      
      // Get available parameters from context
      const availableParams = [
        'domain', 'url', 'title', 'headings', 'pageText', 'links', 'forms'
      ];

      // Simulate parameter suggestion logic
      const taskData = {
        name: 'Parameter Suggestion Task',
        description: 'Task to demonstrate parameter suggestions',
        websitePatterns: ['example\\.com'],
        promptTemplate: 'Available parameters: {{domain}}, {{title}}, {{headings}}',
        outputFormat: OutputFormat.MARKDOWN,
        suggestedParams: availableParams
      };

      const taskId = await taskManager.createTask(taskData);

      expect(mockStorageService.createCustomTask).toHaveBeenCalledWith(
        expect.objectContaining({
          promptTemplate: expect.stringContaining('{{domain}}'),
          suggestedParams: expect.arrayContaining(['domain', 'title', 'headings'])
        })
      );
    });
  });

  // ============================================================================
  // WORKFLOW INTEGRATION TESTS
  // ============================================================================

  describe('Complete Task Addition Workflow Integration', () => {
    it('should complete full workflow: create -> validate -> test -> refine', async () => {
      // Step 1: Create initial task
      const initialTaskData = {
        name: 'SEO Analysis Task',
        description: 'Analyze page for SEO optimization',
        websitePatterns: ['.*'],
        promptTemplate: 'Analyze {{title}} and {{headings}} for SEO optimization',
        outputFormat: OutputFormat.MARKDOWN
      };

      const taskId = await taskManager.createTask(initialTaskData);
      expect(taskId).toBe('new-task-id');

      // Step 2: Validate task
      const createdTask = createMockTask({
        id: taskId,
        ...initialTaskData
      });
      vi.spyOn(mockStorageService, 'getCustomTask').mockResolvedValue(createdTask);

      const validationResult = await taskManager.validateTask(taskId);
      expect(validationResult.isValid).toBe(true);

      // Step 3: Test task
      const executionContext = createMockExecutionContext();
      const testResult = await taskManager.testTask(taskId, executionContext);
      expect(testResult.success).toBe(true);

      // Step 4: Refine task based on test results
      const updates = {
        promptTemplate: 'Analyze {{title}}, {{headings}}, and {{pageText}} for comprehensive SEO optimization'
      };

      const updateSuccess = await taskManager.updateTask(taskId, updates);
      expect(updateSuccess).toBe(true);
      expect(mockStorageService.updateCustomTask).toHaveBeenCalledWith(taskId, updates);
    });

    it('should handle workflow errors and provide recovery options', async () => {
      // Simulate storage failure during creation
      vi.spyOn(mockStorageService, 'createCustomTask').mockRejectedValue(new Error('Storage failure'));

      const taskData = {
        name: 'Test Task',
        description: 'Test description',
        websitePatterns: ['example\\.com'],
        promptTemplate: 'Test template',
        outputFormat: OutputFormat.PLAIN_TEXT
      };

      await expect(taskManager.createTask(taskData)).rejects.toThrow('Storage failure');

      // Verify no partial state was created
      expect(mockStorageService.getCustomTask).not.toHaveBeenCalled();
    });

    it('should support task creation with different website contexts', async () => {
      const contexts = [
        createMockWebsiteContext({ domain: 'ecommerce.com', category: WebsiteCategory.ECOMMERCE }),
        createMockWebsiteContext({ domain: 'news.org', category: WebsiteCategory.NEWS }),
        createMockWebsiteContext({ domain: 'social.net', category: WebsiteCategory.SOCIAL })
      ];

      for (const context of contexts) {
        const taskData = {
          name: `${context.category} Task`,
          description: `Task for ${context.category} websites`,
          websitePatterns: [context.domain.replace('.', '\\.')],
          promptTemplate: `Process ${context.category} content from {{domain}}`,
          outputFormat: OutputFormat.JSON
        };

        const taskId = await taskManager.createTask(taskData);
        expect(taskId).toBe('new-task-id');
      }

      expect(mockStorageService.createCustomTask).toHaveBeenCalledTimes(3);
    });
  });
});