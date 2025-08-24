/**
 * Task Addition Workflow Tests
 * 
 * Tests for the task addition workflow that handles creating tasks
 * from the current page context with pre-population and validation.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TaskAdditionWorkflow } from '../taskManager';
import { ChromeStorageService } from '../storage';
import { PatternEngine } from '../patternEngine';
import {
  WebsiteContext,
  PageContent,
  CustomTask,
  OutputFormat,
  WebsiteCategory,
  PageType,
  SecurityLevel,
  ValidationError
} from '../../types/index';

// Mock dependencies
const mockStorageService = {
  createCustomTask: vi.fn(),
  getTasksForWebsite: vi.fn(),
  getUserPreferences: vi.fn()
} as unknown as ChromeStorageService;

const mockPatternEngine = {
  analyzeWebsite: vi.fn(),
  generateSuggestedPatterns: vi.fn(),
  validatePattern: vi.fn()
} as unknown as PatternEngine;

// Test fixtures
const createMockPageContent = (overrides: Partial<PageContent> = {}): PageContent => ({
  url: 'https://example.com/test-page',
  title: 'Test Page Title',
  headings: ['Main Heading', 'Sub Heading'],
  textContent: 'This is the main content of the test page with important information.',
  forms: [
    {
      id: 'contact-form',
      action: '/submit',
      method: 'POST',
      fields: [
        { name: 'email', type: 'email', label: 'Email Address' },
        { name: 'message', type: 'textarea', label: 'Message' }
      ]
    }
  ],
  links: [
    { href: '/about', text: 'About Us' },
    { href: '/contact', text: 'Contact' }
  ],
  metadata: {
    description: 'Test page description',
    keywords: 'test, example, page'
  },
  extractedAt: new Date(),
  ...overrides
});

const createMockWebsiteContext = (overrides: Partial<WebsiteContext> = {}): WebsiteContext => ({
  domain: 'example.com',
  category: WebsiteCategory.PRODUCTIVITY,
  pageType: PageType.OTHER,
  extractedData: {
    title: 'Test Page Title',
    description: 'Test page description'
  },
  securityLevel: SecurityLevel.PUBLIC,
  timestamp: new Date(),
  ...overrides
});

describe('TaskAdditionWorkflow', () => {
  let workflow: TaskAdditionWorkflow;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mock implementations
    (mockStorageService.createCustomTask as any).mockResolvedValue('new-task-id');
    (mockStorageService.getTasksForWebsite as any).mockResolvedValue([]);
    (mockStorageService.getUserPreferences as any).mockResolvedValue({
      enabledCategories: [WebsiteCategory.PRODUCTIVITY],
      customPatterns: [],
      privacySettings: {
        sharePageContent: true,
        shareFormData: false,
        allowAutomation: true,
        securityLevel: SecurityLevel.CAUTIOUS,
        excludedDomains: []
      }
    });

    (mockPatternEngine.analyzeWebsite as any).mockResolvedValue(createMockWebsiteContext());
    (mockPatternEngine.generateSuggestedPatterns as any).mockReturnValue(['example\\.com']);
    (mockPatternEngine.validatePattern as any).mockReturnValue(true);

    workflow = new TaskAdditionWorkflow(mockStorageService, mockPatternEngine);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initializeFromCurrentPage', () => {
    it('should initialize workflow with current page context', async () => {
      const pageContent = createMockPageContent();
      
      const result = await workflow.initializeFromCurrentPage(pageContent);

      expect(result.success).toBe(true);
      expect(result.websiteContext).toBeDefined();
      expect(result.suggestedPatterns).toContain('example\\.com');
      expect(result.existingTasks).toEqual([]);
      expect(mockPatternEngine.analyzeWebsite).toHaveBeenCalledWith(
        pageContent.url,
        pageContent
      );
    });

    it('should handle analysis errors gracefully', async () => {
      (mockPatternEngine.analyzeWebsite as any).mockRejectedValue(new Error('Analysis failed'));
      
      const pageContent = createMockPageContent();
      const result = await workflow.initializeFromCurrentPage(pageContent);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Analysis failed');
    });

    it('should detect existing tasks for the website', async () => {
      const existingTask: CustomTask = {
        id: 'existing-task',
        name: 'Existing Task',
        description: 'An existing task',
        websitePatterns: ['example\\.com'],
        promptTemplate: 'Existing prompt',
        outputFormat: OutputFormat.PLAIN_TEXT,
        createdAt: new Date(),
        updatedAt: new Date(),
        usageCount: 0,
        isEnabled: true,
        tags: []
      };

      (mockStorageService.getTasksForWebsite as any).mockResolvedValue([existingTask]);
      
      const pageContent = createMockPageContent();
      const result = await workflow.initializeFromCurrentPage(pageContent);

      expect(result.success).toBe(true);
      expect(result.existingTasks).toHaveLength(1);
      expect(result.existingTasks[0].id).toBe('existing-task');
    });
  });

  describe('generateTaskSuggestions', () => {
    it('should generate task suggestions based on website category', async () => {
      const context = createMockWebsiteContext({ category: WebsiteCategory.SOCIAL_MEDIA });
      
      const suggestions = await workflow.generateTaskSuggestions(context);

      expect(suggestions).toHaveLength(3);
      expect(suggestions[0].name).toContain('Social Media Post');
      expect(suggestions[1].name).toContain('Hashtag Suggestions');
      expect(suggestions[2].name).toContain('Content Analysis');
    });

    it('should generate e-commerce specific suggestions', async () => {
      const context = createMockWebsiteContext({ category: WebsiteCategory.ECOMMERCE });
      
      const suggestions = await workflow.generateTaskSuggestions(context);

      expect(suggestions).toHaveLength(3);
      expect(suggestions[0].name).toContain('Product Analysis');
      expect(suggestions[1].name).toContain('Price Comparison');
      expect(suggestions[2].name).toContain('Review Summary');
    });

    it('should generate professional platform suggestions', async () => {
      const context = createMockWebsiteContext({ category: WebsiteCategory.PROFESSIONAL });
      
      const suggestions = await workflow.generateTaskSuggestions(context);

      expect(suggestions).toHaveLength(3);
      expect(suggestions[0].name).toContain('Profile Optimization');
      expect(suggestions[1].name).toContain('Connection Message');
      expect(suggestions[2].name).toContain('Job Application');
    });

    it('should generate generic suggestions for unknown categories', async () => {
      const context = createMockWebsiteContext({ category: WebsiteCategory.CUSTOM });
      
      const suggestions = await workflow.generateTaskSuggestions(context);

      expect(suggestions).toHaveLength(3);
      expect(suggestions[0].name).toContain('Content Summary');
      expect(suggestions[1].name).toContain('Key Points');
      expect(suggestions[2].name).toContain('Action Items');
    });
  });

  describe('createTaskFromTemplate', () => {
    it('should create task from suggestion template', async () => {
      const pageContent = createMockPageContent();
      await workflow.initializeFromCurrentPage(pageContent);

      const context = createMockWebsiteContext();
      const suggestions = await workflow.generateTaskSuggestions(context);
      
      const taskId = await workflow.createTaskFromTemplate(suggestions[0]);

      expect(taskId).toBe('new-task-id');
      expect(mockStorageService.createCustomTask).toHaveBeenCalledWith(
        expect.objectContaining({
          name: suggestions[0].name,
          description: suggestions[0].description,
          promptTemplate: suggestions[0].promptTemplate,
          websitePatterns: ['example\\.com']
        })
      );
    });

    it('should handle creation errors', async () => {
      (mockStorageService.createCustomTask as any).mockRejectedValue(new Error('Creation failed'));
      
      const pageContent = createMockPageContent();
      await workflow.initializeFromCurrentPage(pageContent);

      const context = createMockWebsiteContext();
      const suggestions = await workflow.generateTaskSuggestions(context);
      
      await expect(workflow.createTaskFromTemplate(suggestions[0])).rejects.toThrow('Creation failed');
    });

    it('should throw error if workflow not initialized', async () => {
      const context = createMockWebsiteContext();
      const suggestions = await workflow.generateTaskSuggestions(context);
      
      await expect(workflow.createTaskFromTemplate(suggestions[0])).rejects.toThrow('not initialized');
    });
  });

  describe('createCustomTask', () => {
    it('should create custom task with user input', async () => {
      const pageContent = createMockPageContent();
      await workflow.initializeFromCurrentPage(pageContent);

      const taskData = {
        name: 'Custom Task',
        description: 'A custom task created by user',
        promptTemplate: 'Custom prompt for {{domain}}',
        outputFormat: OutputFormat.MARKDOWN,
        tags: ['custom', 'user-created']
      };

      const taskId = await workflow.createCustomTask(taskData);

      expect(taskId).toBe('new-task-id');
      expect(mockStorageService.createCustomTask).toHaveBeenCalledWith(
        expect.objectContaining({
          ...taskData,
          websitePatterns: ['example\\.com'],
          isEnabled: true
        })
      );
    });

    it('should validate custom task data', async () => {
      const pageContent = createMockPageContent();
      await workflow.initializeFromCurrentPage(pageContent);

      const invalidTaskData = {
        name: '', // Invalid: empty name
        description: 'Description',
        promptTemplate: 'Prompt',
        outputFormat: OutputFormat.PLAIN_TEXT,
        tags: []
      };

      await expect(workflow.createCustomTask(invalidTaskData)).rejects.toThrow(ValidationError);
    });

    it('should allow custom website patterns', async () => {
      const pageContent = createMockPageContent();
      await workflow.initializeFromCurrentPage(pageContent);

      const taskData = {
        name: 'Custom Task',
        description: 'Description',
        promptTemplate: 'Prompt',
        outputFormat: OutputFormat.PLAIN_TEXT,
        tags: [],
        websitePatterns: ['custom\\.site\\.com', 'another\\.domain\\.org']
      };

      const taskId = await workflow.createCustomTask(taskData);

      expect(mockStorageService.createCustomTask).toHaveBeenCalledWith(
        expect.objectContaining({
          websitePatterns: ['custom\\.site\\.com', 'another\\.domain\\.org']
        })
      );
    });
  });

  describe('validateTaskData', () => {
    it('should validate valid task data', () => {
      const validData = {
        name: 'Valid Task',
        description: 'A valid task description',
        promptTemplate: 'Valid prompt template',
        outputFormat: OutputFormat.PLAIN_TEXT,
        tags: ['valid']
      };

      const result = workflow.validateTaskData(validData);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing required fields', () => {
      const invalidData = {
        name: '',
        description: '',
        promptTemplate: '',
        outputFormat: OutputFormat.PLAIN_TEXT,
        tags: []
      };

      const result = workflow.validateTaskData(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.message.includes('name'))).toBe(true);
      expect(result.errors.some(e => e.message.includes('description'))).toBe(true);
      expect(result.errors.some(e => e.message.includes('prompt'))).toBe(true);
    });

    it('should validate website patterns', () => {
      const dataWithInvalidPatterns = {
        name: 'Task',
        description: 'Description',
        promptTemplate: 'Prompt',
        outputFormat: OutputFormat.PLAIN_TEXT,
        tags: [],
        websitePatterns: ['[invalid-regex', 'valid\\.pattern']
      };

      (mockPatternEngine.validatePattern as any).mockImplementation((pattern: string) => {
        return !pattern.includes('[invalid-regex');
      });

      const result = workflow.validateTaskData(dataWithInvalidPatterns);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.message.includes('pattern'))).toBe(true);
    });

    it('should provide warnings for potential issues', () => {
      const dataWithWarnings = {
        name: 'Task',
        description: 'Short', // Too short
        promptTemplate: 'Very short prompt', // Too short
        outputFormat: OutputFormat.PLAIN_TEXT,
        tags: []
      };

      const result = workflow.validateTaskData(dataWithWarnings);

      expect(result.isValid).toBe(true); // Still valid but has warnings
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('getContextVariables', () => {
    it('should extract context variables from page content', async () => {
      const pageContent = createMockPageContent({
        title: 'Product Review: Amazing Widget',
        headings: ['Overview', 'Features', 'Pricing'],
        metadata: {
          description: 'Comprehensive review of the amazing widget',
          keywords: 'widget, review, product'
        }
      });

      await workflow.initializeFromCurrentPage(pageContent);
      const variables = workflow.getContextVariables();

      expect(variables).toEqual({
        domain: 'example.com',
        url: 'https://example.com/test-page',
        title: 'Product Review: Amazing Widget',
        description: 'Comprehensive review of the amazing widget',
        headings: ['Overview', 'Features', 'Pricing'],
        keywords: 'widget, review, product',
        pageType: 'other',
        category: 'productivity'
      });
    });

    it('should handle missing metadata gracefully', async () => {
      const pageContent = createMockPageContent({
        metadata: {}
      });

      await workflow.initializeFromCurrentPage(pageContent);
      const variables = workflow.getContextVariables();

      expect(variables.description).toBe('');
      expect(variables.keywords).toBe('');
    });

    it('should throw error if not initialized', () => {
      expect(() => workflow.getContextVariables()).toThrow('not initialized');
    });
  });

  describe('previewTask', () => {
    it('should generate task preview with context injection', async () => {
      const pageContent = createMockPageContent();
      await workflow.initializeFromCurrentPage(pageContent);

      const taskData = {
        name: 'Preview Task',
        description: 'Task for preview',
        promptTemplate: 'Generate content for {{domain}} with title "{{title}}"',
        outputFormat: OutputFormat.PLAIN_TEXT,
        tags: []
      };

      const preview = workflow.previewTask(taskData);

      expect(preview.processedPrompt).toContain('example.com');
      expect(preview.processedPrompt).toContain('Test Page Title');
      expect(preview.contextVariables).toBeDefined();
      expect(preview.estimatedTokens).toBeGreaterThan(0);
    });

    it('should handle template variables that are not available', async () => {
      const pageContent = createMockPageContent();
      await workflow.initializeFromCurrentPage(pageContent);

      const taskData = {
        name: 'Preview Task',
        description: 'Task for preview',
        promptTemplate: 'Generate content for {{nonexistent}} variable',
        outputFormat: OutputFormat.PLAIN_TEXT,
        tags: []
      };

      const preview = workflow.previewTask(taskData);

      expect(preview.processedPrompt).toContain('{{nonexistent}}'); // Should remain unprocessed
      expect(preview.warnings).toContain('Unknown template variable: nonexistent');
    });
  });

  describe('reset', () => {
    it('should reset workflow state', async () => {
      const pageContent = createMockPageContent();
      await workflow.initializeFromCurrentPage(pageContent);

      expect(workflow.getContextVariables()).toBeDefined();

      workflow.reset();

      expect(() => workflow.getContextVariables()).toThrow('not initialized');
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete workflow from initialization to task creation', async () => {
      // Initialize with page content
      const pageContent = createMockPageContent({
        url: 'https://twitter.com/user/status/123',
        title: 'Tweet about AI development'
      });

      const initResult = await workflow.initializeFromCurrentPage(pageContent);
      expect(initResult.success).toBe(true);

      // Generate suggestions
      const context = createMockWebsiteContext({ 
        domain: 'twitter.com',
        category: WebsiteCategory.SOCIAL_MEDIA 
      });
      (mockPatternEngine.analyzeWebsite as any).mockResolvedValue(context);

      const suggestions = await workflow.generateTaskSuggestions(context);
      expect(suggestions.length).toBeGreaterThan(0);

      // Create task from suggestion
      const taskId = await workflow.createTaskFromTemplate(suggestions[0]);
      expect(taskId).toBe('new-task-id');

      // Verify the task was created with correct patterns
      expect(mockStorageService.createCustomTask).toHaveBeenCalledWith(
        expect.objectContaining({
          websitePatterns: expect.arrayContaining(['example\\.com'])
        })
      );
    });

    it('should handle privacy-sensitive websites', async () => {
      const pageContent = createMockPageContent({
        url: 'https://banking.example.com/account'
      });

      const sensitiveContext = createMockWebsiteContext({
        domain: 'banking.example.com',
        securityLevel: SecurityLevel.RESTRICTED
      });

      (mockPatternEngine.analyzeWebsite as any).mockResolvedValue(sensitiveContext);

      const initResult = await workflow.initializeFromCurrentPage(pageContent);
      expect(initResult.success).toBe(true);
      expect(initResult.privacyWarnings).toContain('sensitive website');
    });
  });
});