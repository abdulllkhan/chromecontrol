/**
 * Task Manager Tests
 * 
 * Comprehensive test suite for the task management system including
 * CRUD operations, website associations, execution engine, and validation.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TaskManager, createTaskManager, createTaskTemplate } from '../taskManager.js';
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
  ValidationError
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
  subtle: {
    generateKey: vi.fn(),
    exportKey: vi.fn(),
    importKey: vi.fn(),
    encrypt: vi.fn(),
    decrypt: vi.fn()
  },
  getRandomValues: (array: Uint8Array) => {
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
    return array;
  }
} as any;

// Mock fetch for AI service
global.fetch = vi.fn();

// ============================================================================
// TEST FIXTURES
// ============================================================================

const createMockTask = (overrides: Partial<CustomTask> = {}): CustomTask => ({
  id: 'test-task-1',
  name: 'Test Task',
  description: 'A test task for unit testing',
  websitePatterns: ['example\\.com', 'test\\.org'],
  promptTemplate: 'Generate content for {{domain}} with title: {{pageTitle}}',
  outputFormat: OutputFormat.PLAIN_TEXT,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  usageCount: 5,
  isEnabled: true,
  tags: ['test', 'example'],
  ...overrides
});

const createMockWebsiteContext = (overrides: Partial<WebsiteContext> = {}): WebsiteContext => ({
  domain: 'example.com',
  category: WebsiteCategory.PRODUCTIVITY,
  pageType: PageType.OTHER,
  extractedData: { title: 'Test Page' },
  securityLevel: SecurityLevel.PUBLIC,
  timestamp: new Date(),
  ...overrides
});

const createMockExecutionContext = (overrides: Partial<ExecutionContext> = {}): ExecutionContext => ({
  websiteContext: createMockWebsiteContext(),
  pageContent: {
    url: 'https://example.com/test',
    title: 'Test Page',
    headings: ['Main Heading'],
    textContent: 'This is test content',
    forms: [],
    links: [],
    metadata: {},
    extractedAt: new Date()
  },
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

const createMockPageContent = (overrides: Partial<any> = {}): any => ({
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

const createMockSecurityConstraints = (overrides: Partial<any> = {}): any => ({
  allowSensitiveData: false,
  maxContentLength: 5000,
  allowedDomains: ['example.com'],
  restrictedSelectors: ['.sensitive'],
  ...overrides
});

// ============================================================================
// TEST SUITE
// ============================================================================

describe('TaskManager', () => {
  let taskManager: TaskManager;
  let mockStorageService: ChromeStorageService;
  let mockAIService: AIService;

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Setup storage service mock
    mockStorageService = new ChromeStorageService();
    vi.spyOn(mockStorageService, 'createCustomTask').mockResolvedValue('test-task-1');
    vi.spyOn(mockStorageService, 'getCustomTask').mockResolvedValue(createMockTask());
    vi.spyOn(mockStorageService, 'getAllCustomTasks').mockResolvedValue({
      'test-task-1': createMockTask()
    });
    vi.spyOn(mockStorageService, 'updateCustomTask').mockResolvedValue(true);
    vi.spyOn(mockStorageService, 'deleteCustomTask').mockResolvedValue(true);
    vi.spyOn(mockStorageService, 'getTasksForWebsite').mockResolvedValue([createMockTask()]);
    vi.spyOn(mockStorageService, 'recordTaskUsage').mockResolvedValue();

    // Setup AI service mock
    mockAIService = new AIService({ apiKey: 'test-key' });
    vi.spyOn(mockAIService, 'processRequest').mockResolvedValue(createMockAIResponse());
    vi.spyOn(mockAIService, 'validateResponse').mockReturnValue(true);

    // Create task manager
    taskManager = createTaskManager(mockStorageService, mockAIService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================================================
  // TASK CRUD OPERATIONS TESTS
  // ============================================================================

  describe('Task CRUD Operations', () => {
    describe('createTask', () => {
      it('should create a new task successfully', async () => {
        const taskData = createTaskTemplate(
          'New Task',
          'A new test task',
          'Test prompt for {{domain}}',
          ['example\\.com']
        );

        const taskId = await taskManager.createTask(taskData);

        expect(taskId).toBe('test-task-1');
        expect(mockStorageService.createCustomTask).toHaveBeenCalledWith(taskData);
      });

      it('should validate task data before creation', async () => {
        const invalidTaskData = {
          name: '', // Invalid: empty name
          description: 'Test',
          websitePatterns: [],
          promptTemplate: 'Test',
          outputFormat: OutputFormat.PLAIN_TEXT,
          isEnabled: true,
          tags: []
        };

        await expect(taskManager.createTask(invalidTaskData)).rejects.toThrow(ValidationError);
      });

      it('should handle storage service errors', async () => {
        vi.spyOn(mockStorageService, 'createCustomTask').mockRejectedValue(new Error('Storage error'));

        const taskData = createTaskTemplate('Test Task', 'Description', 'Prompt');

        await expect(taskManager.createTask(taskData)).rejects.toThrow('Storage error');
      });
    });

    describe('getTask', () => {
      it('should retrieve a task by ID', async () => {
        const task = await taskManager.getTask('test-task-1');

        expect(task).toEqual(createMockTask());
        expect(mockStorageService.getCustomTask).toHaveBeenCalledWith('test-task-1');
      });

      it('should return null for non-existent task', async () => {
        vi.spyOn(mockStorageService, 'getCustomTask').mockResolvedValue(null);

        const task = await taskManager.getTask('non-existent');

        expect(task).toBeNull();
      });

      it('should handle storage errors gracefully', async () => {
        vi.spyOn(mockStorageService, 'getCustomTask').mockRejectedValue(new Error('Storage error'));

        const task = await taskManager.getTask('test-task-1');

        expect(task).toBeNull();
      });
    });

    describe('getAllTasks', () => {
      it('should retrieve all tasks', async () => {
        const tasks = await taskManager.getAllTasks();

        expect(tasks).toEqual({ 'test-task-1': createMockTask() });
        expect(mockStorageService.getAllCustomTasks).toHaveBeenCalled();
      });

      it('should return empty object on storage error', async () => {
        vi.spyOn(mockStorageService, 'getAllCustomTasks').mockRejectedValue(new Error('Storage error'));

        const tasks = await taskManager.getAllTasks();

        expect(tasks).toEqual({});
      });
    });

    describe('updateTask', () => {
      it('should update a task successfully', async () => {
        const updates = { name: 'Updated Task Name' };

        const result = await taskManager.updateTask('test-task-1', updates);

        expect(result).toBe(true);
        expect(mockStorageService.updateCustomTask).toHaveBeenCalledWith('test-task-1', updates);
      });

      it('should validate updates before applying', async () => {
        const invalidUpdates = { websitePatterns: ['[invalid-regex'] };

        await expect(taskManager.updateTask('test-task-1', invalidUpdates)).rejects.toThrow();
      });

      it('should handle non-existent task', async () => {
        vi.spyOn(mockStorageService, 'getCustomTask').mockResolvedValue(null);

        await expect(taskManager.updateTask('non-existent', { name: 'New Name' })).rejects.toThrow('Task non-existent not found');
      });
    });

    describe('deleteTask', () => {
      it('should delete a task successfully', async () => {
        const result = await taskManager.deleteTask('test-task-1');

        expect(result).toBe(true);
        expect(mockStorageService.deleteCustomTask).toHaveBeenCalledWith('test-task-1');
      });

      it('should handle storage errors', async () => {
        vi.spyOn(mockStorageService, 'deleteCustomTask').mockRejectedValue(new Error('Storage error'));

        await expect(taskManager.deleteTask('test-task-1')).rejects.toThrow('Storage error');
      });
    });

    describe('duplicateTask', () => {
      it('should duplicate an existing task', async () => {
        const newTaskId = await taskManager.duplicateTask('test-task-1', 'Duplicated Task');

        expect(newTaskId).toBe('test-task-1');
        expect(mockStorageService.createCustomTask).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Duplicated Task',
            usageCount: 0
          })
        );
      });

      it('should handle non-existent task', async () => {
        vi.spyOn(mockStorageService, 'getCustomTask').mockResolvedValue(null);

        await expect(taskManager.duplicateTask('non-existent')).rejects.toThrow('Task non-existent not found');
      });
    });
  });

  // ============================================================================
  // WEBSITE ASSOCIATION TESTS
  // ============================================================================

  describe('Website Association Logic', () => {
    describe('getTasksForWebsite', () => {
      it('should return tasks matching website context', async () => {
        const context = createMockWebsiteContext();

        const tasks = await taskManager.getTasksForWebsite(context);

        expect(tasks).toHaveLength(1);
        expect(tasks[0]).toEqual(createMockTask());
        expect(mockStorageService.getTasksForWebsite).toHaveBeenCalledWith('example.com');
      });

      it('should return empty array on error', async () => {
        vi.spyOn(mockStorageService, 'getTasksForWebsite').mockRejectedValue(new Error('Storage error'));

        const context = createMockWebsiteContext();
        const tasks = await taskManager.getTasksForWebsite(context);

        expect(tasks).toEqual([]);
      });

      it('should filter disabled tasks', async () => {
        const disabledTask = createMockTask({ isEnabled: false });
        vi.spyOn(mockStorageService, 'getTasksForWebsite').mockResolvedValue([disabledTask]);

        const context = createMockWebsiteContext();
        const tasks = await taskManager.getTasksForWebsite(context);

        expect(tasks).toEqual([]);
      });
    });

    describe('associateTaskWithWebsite', () => {
      it('should associate task with website patterns', async () => {
        const patterns = ['newsite\\.com', 'another\\.org'];

        const result = await taskManager.associateTaskWithWebsite('test-task-1', patterns);

        expect(result).toBe(true);
        expect(mockStorageService.updateCustomTask).toHaveBeenCalledWith('test-task-1', {
          websitePatterns: patterns
        });
      });

      it('should validate URL patterns', async () => {
        const invalidPatterns = ['[invalid-regex'];

        await expect(taskManager.associateTaskWithWebsite('test-task-1', invalidPatterns)).rejects.toThrow();
      });
    });

    describe('removeTaskWebsiteAssociation', () => {
      it('should remove specific website patterns', async () => {
        const patternsToRemove = ['example\\.com'];

        const result = await taskManager.removeTaskWebsiteAssociation('test-task-1', patternsToRemove);

        expect(result).toBe(true);
        expect(mockStorageService.updateCustomTask).toHaveBeenCalledWith('test-task-1', {
          websitePatterns: ['test\\.org'] // Only remaining pattern
        });
      });

      it('should handle non-existent task', async () => {
        vi.spyOn(mockStorageService, 'getCustomTask').mockResolvedValue(null);

        await expect(taskManager.removeTaskWebsiteAssociation('non-existent', ['pattern'])).rejects.toThrow('Task non-existent not found');
      });
    });

    describe('getAllWebsiteAssociations', () => {
      it('should return all website associations', async () => {
        const associations = await taskManager.getAllWebsiteAssociations();

        expect(associations).toEqual({
          'test-task-1': ['example\\.com', 'test\\.org']
        });
      });

      it('should handle storage errors', async () => {
        vi.spyOn(mockStorageService, 'getAllCustomTasks').mockRejectedValue(new Error('Storage error'));

        const associations = await taskManager.getAllWebsiteAssociations();

        expect(associations).toEqual({});
      });
    });
  });

  // ============================================================================
  // TASK EXECUTION TESTS
  // ============================================================================

  describe('Task Execution Engine', () => {
    describe('executeTask', () => {
      it('should execute a task successfully', async () => {
        const context = createMockExecutionContext();

        const result = await taskManager.executeTask('test-task-1', context);

        expect(result.success).toBe(true);
        expect(result.content).toBe('Generated test content');
        expect(result.format).toBe(OutputFormat.PLAIN_TEXT);
        expect(mockAIService.processRequest).toHaveBeenCalled();
        expect(mockStorageService.recordTaskUsage).toHaveBeenCalledWith('test-task-1', true, expect.any(Number));
      });

      it('should handle disabled tasks', async () => {
        const disabledTask = createMockTask({ isEnabled: false });
        vi.spyOn(mockStorageService, 'getCustomTask').mockResolvedValue(disabledTask);

        const context = createMockExecutionContext();

        const result = await taskManager.executeTask('test-task-1', context);

        expect(result.success).toBe(false);
        expect(result.error).toContain('disabled');
      });

      it('should handle non-existent tasks', async () => {
        vi.spyOn(mockStorageService, 'getCustomTask').mockResolvedValue(null);

        const context = createMockExecutionContext();

        const result = await taskManager.executeTask('non-existent', context);

        expect(result.success).toBe(false);
        expect(result.error).toContain('not found');
      });

      it('should perform dry run execution', async () => {
        const context = createMockExecutionContext();

        const result = await taskManager.executeTask('test-task-1', context, { dryRun: true });

        expect(result.success).toBe(true);
        expect(result.content).toContain('[SIMULATED]');
        expect(mockAIService.processRequest).not.toHaveBeenCalled();
      });

      it('should validate before execution when requested', async () => {
        const context = createMockExecutionContext();

        // Mock validation to fail
        vi.spyOn(taskManager, 'validateTask').mockResolvedValue({
          isValid: false,
          errors: [new ValidationError('Test validation error')],
          warnings: [],
          suggestions: []
        });

        const result = await taskManager.executeTask('test-task-1', context, { validateBeforeExecution: true });

        expect(result.success).toBe(false);
        expect(result.error).toContain('validation failed');
      });

      it('should handle AI service errors', async () => {
        vi.spyOn(mockAIService, 'processRequest').mockRejectedValue(new Error('AI service error'));

        const context = createMockExecutionContext();

        const result = await taskManager.executeTask('test-task-1', context);

        expect(result.success).toBe(false);
        expect(result.error).toContain('AI service error');
        expect(mockStorageService.recordTaskUsage).toHaveBeenCalledWith('test-task-1', false, expect.any(Number));
      });

      it('should inject context variables into prompt template', async () => {
        const context = createMockExecutionContext();

        await taskManager.executeTask('test-task-1', context);

        const aiRequestCall = (mockAIService.processRequest as any).mock.calls[0][0] as AIRequest;
        expect(aiRequestCall.prompt).toContain('example.com'); // Domain injected
        expect(aiRequestCall.prompt).toContain('Test Page'); // Title injected
      });
    });

    describe('executeTaskSequence', () => {
      it('should execute multiple tasks in sequence', async () => {
        const context = createMockExecutionContext();
        const taskIds = ['test-task-1', 'test-task-2'];

        // Mock second task
        vi.spyOn(mockStorageService, 'getCustomTask')
          .mockResolvedValueOnce(createMockTask({ id: 'test-task-1' }))
          .mockResolvedValueOnce(createMockTask({ id: 'test-task-2' }));

        const results = await taskManager.executeTaskSequence(taskIds, context);

        expect(results).toHaveLength(2);
        expect(results[0].success).toBe(true);
        expect(results[1].success).toBe(true);
        expect(mockAIService.processRequest).toHaveBeenCalledTimes(2);
      });

      it('should stop on first failure', async () => {
        const context = createMockExecutionContext();
        const taskIds = ['test-task-1', 'test-task-2'];

        // Mock first task to fail
        vi.spyOn(mockAIService, 'processRequest')
          .mockRejectedValueOnce(new Error('First task failed'))
          .mockResolvedValueOnce(createMockAIResponse());

        const results = await taskManager.executeTaskSequence(taskIds, context);

        expect(results).toHaveLength(1);
        expect(results[0].success).toBe(false);
        expect(mockAIService.processRequest).toHaveBeenCalledTimes(1);
      });
    });
  });

  // ============================================================================
  // VALIDATION AND TESTING TESTS
  // ============================================================================

  describe('Task Validation and Testing', () => {
    describe('validateTask', () => {
      it('should validate a valid task', async () => {
        const result = await taskManager.validateTask('test-task-1');

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should detect validation errors', async () => {
        const invalidTask = createMockTask({
          name: '', // Invalid
          websitePatterns: ['[invalid-regex'] // Invalid regex
        });
        vi.spyOn(mockStorageService, 'getCustomTask').mockResolvedValue(invalidTask);

        const result = await taskManager.validateTask('test-task-1');

        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it('should handle non-existent task', async () => {
        vi.spyOn(mockStorageService, 'getCustomTask').mockResolvedValue(null);

        const result = await taskManager.validateTask('non-existent');

        expect(result.isValid).toBe(false);
        expect(result.errors[0].message).toContain('not found');
      });

      it('should provide warnings and suggestions', async () => {
        const taskWithIssues = createMockTask({
          promptTemplate: 'Short', // Too short
          websitePatterns: Array(15).fill('pattern'), // Too many patterns
          tags: [] // No tags
        });
        vi.spyOn(mockStorageService, 'getCustomTask').mockResolvedValue(taskWithIssues);

        const result = await taskManager.validateTask('test-task-1');

        expect(result.warnings.length).toBeGreaterThan(0);
        expect(result.suggestions.length).toBeGreaterThan(0);
      });
    });

    describe('testTask', () => {
      it('should test a task successfully', async () => {
        const result = await taskManager.testTask('test-task-1');

        expect(result.success).toBe(true);
        expect(result.validationResult.isValid).toBe(true);
        expect(result.result).toBeDefined();
        expect(result.executionTime).toBeGreaterThan(0);
      });

      it('should fail test for invalid task', async () => {
        const invalidTask = createMockTask({ name: '' });
        vi.spyOn(mockStorageService, 'getCustomTask').mockResolvedValue(invalidTask);

        const result = await taskManager.testTask('test-task-1');

        expect(result.success).toBe(false);
        expect(result.validationResult.isValid).toBe(false);
        expect(result.error).toContain('Validation failed');
      });

      it('should use provided sample context', async () => {
        const sampleContext = createMockExecutionContext({
          websiteContext: createMockWebsiteContext({ domain: 'custom.com' })
        });

        const result = await taskManager.testTask('test-task-1', sampleContext);

        expect(result.success).toBe(true);
        expect(result.result?.content).toContain('custom.com');
      });
    });

    describe('testAllTasks', () => {
      it('should test all tasks', async () => {
        const tasks = {
          'task-1': createMockTask({ id: 'task-1' }),
          'task-2': createMockTask({ id: 'task-2' })
        };
        vi.spyOn(mockStorageService, 'getAllCustomTasks').mockResolvedValue(tasks);

        const results = await taskManager.testAllTasks();

        expect(Object.keys(results)).toHaveLength(2);
        expect(results['task-1'].success).toBe(true);
        expect(results['task-2'].success).toBe(true);
      });

      it('should handle individual task test failures', async () => {
        const validTask = createMockTask({ id: 'valid-task' });
        const invalidTask = createMockTask({ id: 'invalid-task', name: '' });
        const tasks = {
          'valid-task': validTask,
          'invalid-task': invalidTask
        };
        vi.spyOn(mockStorageService, 'getAllCustomTasks').mockResolvedValue(tasks);
        
        // Mock individual task retrieval for validation
        vi.spyOn(mockStorageService, 'getCustomTask')
          .mockImplementation((taskId: string) => {
            if (taskId === 'valid-task') return Promise.resolve(validTask);
            if (taskId === 'invalid-task') return Promise.resolve(invalidTask);
            return Promise.resolve(null);
          });

        const results = await taskManager.testAllTasks();

        expect(results['valid-task'].success).toBe(true);
        // The invalid task should fail validation, which should cause the test to fail
        expect(results['invalid-task'].validationResult.isValid).toBe(false);
        expect(results['invalid-task'].validationResult.errors.length).toBeGreaterThan(0);
      });
    });
  });

  // ============================================================================
  // UTILITY FUNCTION TESTS
  // ============================================================================

  describe('Utility Functions', () => {
    describe('createTaskManager', () => {
      it('should create task manager with default config', () => {
        const manager = createTaskManager(mockStorageService, mockAIService);

        expect(manager).toBeInstanceOf(TaskManager);
      });

      it('should accept config overrides', () => {
        const manager = createTaskManager(mockStorageService, mockAIService, {
          enableValidation: false,
          maxExecutionTime: 60000
        });

        expect(manager).toBeInstanceOf(TaskManager);
      });
    });

    describe('createTaskTemplate', () => {
      it('should create a basic task template', () => {
        const template = createTaskTemplate(
          'Test Task',
          'Test Description',
          'Test Prompt',
          ['example\\.com'],
          OutputFormat.MARKDOWN
        );

        expect(template.name).toBe('Test Task');
        expect(template.description).toBe('Test Description');
        expect(template.promptTemplate).toBe('Test Prompt');
        expect(template.websitePatterns).toEqual(['example\\.com']);
        expect(template.outputFormat).toBe(OutputFormat.MARKDOWN);
        expect(template.isEnabled).toBe(true);
        expect(template.tags).toEqual([]);
      });

      it('should use default values', () => {
        const template = createTaskTemplate('Test', 'Description', 'Prompt');

        expect(template.websitePatterns).toEqual([]);
        expect(template.outputFormat).toBe(OutputFormat.PLAIN_TEXT);
        expect(template.isEnabled).toBe(true);
        expect(template.tags).toEqual([]);
      });
    });
  });

  // ============================================================================
  // INTEGRATION TESTS
  // ============================================================================

  describe('Integration Tests', () => {
    it('should handle complete task lifecycle', async () => {
      // Create task
      const taskData = createTaskTemplate(
        'Integration Test Task',
        'A task for integration testing',
        'Generate content for {{domain}}: {{pageTitle}}',
        ['integration\\.test']
      );

      const taskId = await taskManager.createTask(taskData);
      expect(taskId).toBe('test-task-1');

      // Mock the created task for retrieval
      const createdTask = createMockTask({
        id: taskId,
        name: 'Integration Test Task',
        description: 'A task for integration testing',
        promptTemplate: 'Generate content for {{domain}}: {{pageTitle}}',
        websitePatterns: ['integration\\.test']
      });
      vi.spyOn(mockStorageService, 'getCustomTask').mockResolvedValue(createdTask);

      // Get task
      const retrievedTask = await taskManager.getTask(taskId);
      expect(retrievedTask?.name).toBe('Integration Test Task');

      // Update task
      await taskManager.updateTask(taskId, { description: 'Updated description' });

      // Execute task
      const context = createMockExecutionContext();
      const result = await taskManager.executeTask(taskId, context);
      expect(result.success).toBe(true);

      // Validate task
      const validation = await taskManager.validateTask(taskId);
      expect(validation.isValid).toBe(true);

      // Test task
      const testResult = await taskManager.testTask(taskId);
      expect(testResult.success).toBe(true);

      // Delete task
      const deleted = await taskManager.deleteTask(taskId);
      expect(deleted).toBe(true);
    });

    it('should handle website association workflow', async () => {
      const context = createMockWebsiteContext({ domain: 'example.com' });

      // Get tasks for website
      const tasks = await taskManager.getTasksForWebsite(context);
      expect(tasks.length).toBeGreaterThan(0);

      // Associate task with new patterns
      await taskManager.associateTaskWithWebsite('test-task-1', ['newsite\\.com']);

      // Mock the updated task with new patterns for getAllWebsiteAssociations
      const updatedTask = createMockTask({ websitePatterns: ['newsite\\.com'] });
      vi.spyOn(mockStorageService, 'getAllCustomTasks').mockResolvedValue({
        'test-task-1': updatedTask
      });

      // Get all associations
      const associations = await taskManager.getAllWebsiteAssociations();
      expect(associations['test-task-1']).toContain('newsite\\.com');

      // Remove association
      await taskManager.removeTaskWebsiteAssociation('test-task-1', ['newsite\\.com']);
    });

    it('should handle error scenarios gracefully', async () => {
      // Test with storage service failures
      vi.spyOn(mockStorageService, 'getCustomTask').mockRejectedValue(new Error('Storage failure'));

      const task = await taskManager.getTask('test-task-1');
      expect(task).toBeNull();

      // Test with AI service failures
      vi.spyOn(mockAIService, 'processRequest').mockRejectedValue(new Error('AI failure'));

      const context = createMockExecutionContext();
      const result = await taskManager.executeTask('test-task-1', context);
      expect(result.success).toBe(false);
    });
  });
});

// ============================================================================
// ENHANCED TASK EXECUTION PIPELINE TESTS
// ============================================================================

  describe('Enhanced Task Execution Pipeline', () => {
    let promptManager: PromptManager;
    let textExtractionEngine: TextExtractionEngine;
    let mcpService: MCPService;

    beforeEach(() => {
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
      const enhancedConfig = {
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

        expect(promptManager.processCustomTaskPrompt).toHaveBeenCalledWith(task, expect.any(Object));
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
        expect(result.error).toBe('System error occurred');
        expect((result as any).debugInfo).toEqual({
          errorType: 'system',
          technicalDetails: 'Mock error details',
          suggestedFix: 'Try again',
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

        // Should still succeed with original page content
        expect(result.success).toBe(true);
        expect(mockAIService.processRequest).toHaveBeenCalledWith(
          expect.objectContaining({
            pageContent: context.pageContent // Original page content
          })
        );
      });
    });

    describe('Custom Prompt Template Usage', () => {
      it('should verify custom prompt templates are used correctly', async () => {
        const customTemplate = 'Custom task for {{domain}}: {{pageTitle}}';
        const task = createMockTask({ promptTemplate: customTemplate });

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

        const preview = await taskManager.previewTaskPrompt(task.id, context);

        expect(preview).toBe('Processed custom prompt with injected variables');
        expect(promptManager.processCustomTaskPrompt).toHaveBeenCalledWith(task, expect.any(Object));
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
        expect((result as any).debugInfo.userFriendlyMessage).toContain('extracting clean text');
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
});