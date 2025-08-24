/**
 * End-to-End User Workflow Tests
 * 
 * Tests complete user workflows from initialization through task execution,
 * simulating real user interactions with the extension.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TaskManager, createTaskManager } from '../../services/taskManager';
import { ChromeStorageService } from '../../services/storage';
import { PatternEngine } from '../../services/patternEngine';
import { AutomationEngine } from '../../services/automationEngine';
import { SuggestionEngine } from '../../services/suggestionEngine';
import { SecurityManager } from '../../services/securityManager';
import { MockAIService, createSuccessfulMockAI } from '../mocks/mockAIService';
import {
  CustomTask,
  WebsiteContext,
  PageContent,
  ExecutionContext,
  OutputFormat,
  WebsiteCategory,
  PageType,
  SecurityLevel,
  TaskType,
  Suggestion
} from '../../types/index';

// Mock Chrome APIs for E2E tests
const setupChromeAPIMocks = () => {
  const storage = {
    local: {
      data: {} as Record<string, any>,
      get: vi.fn().mockImplementation((keys) => {
        if (!keys) return Promise.resolve(storage.local.data);
        if (typeof keys === 'string') {
          return Promise.resolve({ [keys]: storage.local.data[keys] });
        }
        const result: Record<string, any> = {};
        keys.forEach((key: string) => {
          if (storage.local.data[key] !== undefined) {
            result[key] = storage.local.data[key];
          }
        });
        return Promise.resolve(result);
      }),
      set: vi.fn().mockImplementation((items) => {
        Object.assign(storage.local.data, items);
        return Promise.resolve();
      }),
      clear: vi.fn().mockImplementation(() => {
        storage.local.data = {};
        return Promise.resolve();
      })
    },
    sync: {
      data: {} as Record<string, any>,
      get: vi.fn().mockImplementation((keys) => {
        if (!keys) return Promise.resolve(storage.sync.data);
        if (typeof keys === 'string') {
          return Promise.resolve({ [keys]: storage.sync.data[keys] });
        }
        const result: Record<string, any> = {};
        keys.forEach((key: string) => {
          if (storage.sync.data[key] !== undefined) {
            result[key] = storage.sync.data[key];
          }
        });
        return Promise.resolve(result);
      }),
      set: vi.fn().mockImplementation((items) => {
        Object.assign(storage.sync.data, items);
        return Promise.resolve();
      })
    }
  };

  const currentTab = {
    id: 1,
    url: 'https://example.com/test-page',
    title: 'Test Page - Example Site'
  };

  const tabs = {
    currentTab,
    query: vi.fn().mockResolvedValue([currentTab]),
    get: vi.fn().mockResolvedValue(currentTab),
    sendMessage: vi.fn().mockResolvedValue({ success: true })
  };

  const scripting = {
    executeScript: vi.fn().mockResolvedValue([
      { result: { success: true, data: 'script executed' } }
    ])
  };

  global.chrome = {
    storage,
    tabs,
    scripting,
    runtime: {
      sendMessage: vi.fn().mockResolvedValue({ success: true }),
      onMessage: { addListener: vi.fn(), removeListener: vi.fn() }
    }
  } as any;

  return { storage, tabs, scripting };
};

// Test fixtures
const createTestPageContent = (url = 'https://example.com/test-page'): PageContent => ({
  url,
  title: 'Test Page - Example Site',
  headings: ['Welcome to Example', 'Features', 'Get Started'],
  textContent: 'This is a comprehensive test page with various content sections including features, benefits, and call-to-action elements.',
  forms: [
    {
      id: 'contact-form',
      action: '/contact',
      method: 'POST',
      fields: [
        { name: 'name', type: 'text', label: 'Full Name' },
        { name: 'email', type: 'email', label: 'Email Address' },
        { name: 'message', type: 'textarea', label: 'Message' }
      ]
    }
  ],
  links: [
    { href: '/about', text: 'About Us' },
    { href: '/services', text: 'Our Services' },
    { href: '/contact', text: 'Contact' }
  ],
  metadata: {
    description: 'Example site test page with comprehensive content',
    keywords: 'test, example, demo, features'
  },
  extractedAt: new Date()
});

const createSocialMediaPageContent = (): PageContent => ({
  url: 'https://twitter.com/user/status/123456789',
  title: 'Tweet about AI development trends',
  headings: ['Tweet', 'Replies', 'Related Tweets'],
  textContent: 'Exciting developments in AI technology are reshaping how we work and interact with digital systems.',
  forms: [
    {
      id: 'reply-form',
      action: '/tweet',
      method: 'POST',
      fields: [
        { name: 'tweet', type: 'textarea', label: 'Tweet your reply' }
      ]
    }
  ],
  links: [
    { href: '/user/profile', text: 'View Profile' },
    { href: '/hashtag/AI', text: '#AI' }
  ],
  metadata: {
    description: 'Tweet about AI development trends',
    keywords: 'AI, technology, development, trends'
  },
  extractedAt: new Date()
});

describe('End-to-End User Workflows', () => {
  let taskManager: TaskManager;
  let storageService: ChromeStorageService;
  let patternEngine: PatternEngine;
  let automationEngine: AutomationEngine;
  let suggestionEngine: SuggestionEngine;
  let securityManager: SecurityManager;
  let mockAI: MockAIService;
  let chromeMocks: ReturnType<typeof setupChromeAPIMocks>;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Setup Chrome API mocks
    chromeMocks = setupChromeAPIMocks();

    // Initialize services
    mockAI = createSuccessfulMockAI();
    storageService = new ChromeStorageService();
    patternEngine = new PatternEngine();
    automationEngine = new AutomationEngine();
    suggestionEngine = new SuggestionEngine(storageService, patternEngine);
    securityManager = new SecurityManager();
    taskManager = createTaskManager(storageService, mockAI);

    // Initialize storage service
    await storageService.initialize();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('New User Onboarding Workflow', () => {
    it('should handle first-time user setup and task creation', async () => {
      // Step 1: User opens extension on a new website
      const pageContent = createTestPageContent();
      const websiteContext = await patternEngine.analyzeWebsite(pageContent.url, pageContent);

      expect(websiteContext.domain).toBe('example.com');
      expect(websiteContext.category).toBe(WebsiteCategory.PRODUCTIVITY);

      // Step 2: Extension shows suggestions for new users
      const suggestions = await suggestionEngine.generateSuggestions(websiteContext, pageContent);

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].category).toBeDefined();

      // Step 3: User selects a suggestion to create their first task
      const selectedSuggestion = suggestions.find(s => s.title.includes('Summary'));
      expect(selectedSuggestion).toBeDefined();

      // Step 4: Task is created and stored
      const taskId = await taskManager.createTask({
        name: selectedSuggestion!.title,
        description: selectedSuggestion!.description,
        promptTemplate: 'Summarize the content of {{title}} from {{domain}}',
        websitePatterns: ['example\\.com'],
        outputFormat: OutputFormat.PLAIN_TEXT,
        isEnabled: true,
        tags: ['summary', 'productivity']
      });

      expect(taskId).toBeDefined();

      // Step 5: User immediately tests the task
      const executionContext: ExecutionContext = {
        websiteContext,
        pageContent,
        taskId,
        userInput: {}
      };

      const result = await taskManager.executeTask(taskId, executionContext);

      expect(result.success).toBe(true);
      expect(result.content).toContain('Mock AI response');
      expect(mockAI.getRequestCount()).toBe(1);

      // Step 6: Verify task is saved and can be retrieved
      const savedTask = await taskManager.getTask(taskId);
      expect(savedTask).toBeDefined();
      expect(savedTask!.name).toBe(selectedSuggestion!.title);
    });

    it('should guide user through privacy and security setup', async () => {
      // Step 1: User visits a sensitive website
      const sensitivePageContent = createTestPageContent('https://banking.example.com/account');
      const websiteContext = await patternEngine.analyzeWebsite(
        sensitivePageContent.url, 
        sensitivePageContent
      );

      // Step 2: Security manager detects sensitive site
      const securityLevel = securityManager.validateWebsitePermissions('banking.example.com');
      expect(securityLevel).toBe(SecurityLevel.RESTRICTED);

      // Step 3: Content is sanitized for privacy
      const sanitizedContent = securityManager.sanitizePageContent(sensitivePageContent);
      expect(sanitizedContent.forms).toHaveLength(0); // Sensitive forms removed

      // Step 4: User preferences are updated with security settings
      await storageService.updateUserPreferences({
        privacySettings: {
          sharePageContent: false,
          shareFormData: false,
          allowAutomation: false,
          securityLevel: SecurityLevel.RESTRICTED,
          excludedDomains: ['banking.example.com']
        }
      });

      const preferences = await storageService.getUserPreferences();
      expect(preferences.privacySettings.excludedDomains).toContain('banking.example.com');
    });
  });

  describe('Daily Usage Workflow', () => {
    it('should handle typical user workflow on social media', async () => {
      // Setup: User has existing social media tasks
      const socialMediaTask = await taskManager.createTask({
        name: 'Generate Social Media Post',
        description: 'Create engaging social media content',
        promptTemplate: 'Create a social media post about: {{title}}. Make it engaging and include relevant hashtags.',
        websitePatterns: ['twitter\\.com', 'facebook\\.com', 'linkedin\\.com'],
        outputFormat: OutputFormat.PLAIN_TEXT,
        isEnabled: true,
        tags: ['social', 'content']
      });

      // Step 1: User navigates to Twitter
      const twitterContent = createSocialMediaPageContent();
      const websiteContext = await patternEngine.analyzeWebsite(twitterContent.url, twitterContent);

      expect(websiteContext.domain).toBe('twitter.com');
      expect(websiteContext.category).toBe(WebsiteCategory.SOCIAL_MEDIA);

      // Step 2: Extension automatically shows relevant tasks
      const availableTasks = await taskManager.getTasksForWebsite(websiteContext);
      expect(availableTasks.length).toBeGreaterThan(0);
      expect(availableTasks[0].id).toBe(socialMediaTask);

      // Step 3: User executes the social media task
      const executionContext: ExecutionContext = {
        websiteContext,
        pageContent: twitterContent,
        taskId: socialMediaTask,
        userInput: { topic: 'AI development trends' }
      };

      const result = await taskManager.executeTask(socialMediaTask, executionContext);

      expect(result.success).toBe(true);
      expect(result.content).toContain('AI development trends');

      // Step 4: User copies content and uses it
      // (This would be handled by the UI component)

      // Step 5: Usage statistics are updated
      const stats = await storageService.getTaskUsageStats(socialMediaTask);
      expect(stats?.usageCount).toBeGreaterThan(0);
    });

    it('should handle task execution with automation', async () => {
      // Setup: Create automation task
      const automationTask = await taskManager.createTask({
        name: 'Auto-fill Contact Form',
        description: 'Automatically fill contact forms with user information',
        promptTemplate: 'Generate professional contact message for {{domain}}',
        websitePatterns: ['.*\\.com'],
        outputFormat: OutputFormat.PLAIN_TEXT,
        isEnabled: true,
        tags: ['automation', 'forms'],
        automationSteps: [
          {
            type: 'type',
            selector: '#name',
            value: '{{userName}}',
            description: 'Fill name field'
          },
          {
            type: 'type',
            selector: '#email',
            value: '{{userEmail}}',
            description: 'Fill email field'
          },
          {
            type: 'click',
            selector: '#submit',
            description: 'Submit form'
          }
        ]
      });

      // Step 1: User is on a page with a contact form
      const pageContent = createTestPageContent();
      const websiteContext = await patternEngine.analyzeWebsite(pageContent.url, pageContent);

      // Step 2: User executes automation task
      const executionContext: ExecutionContext = {
        websiteContext,
        pageContent,
        taskId: automationTask,
        userInput: {
          userName: 'John Doe',
          userEmail: 'john@example.com'
        }
      };

      // Mock automation execution
      vi.spyOn(automationEngine, 'executeSteps').mockResolvedValue({
        success: true,
        completedSteps: 3,
        extractedData: {},
        executionTime: 1500
      });

      const result = await taskManager.executeTask(automationTask, executionContext);

      expect(result.success).toBe(true);
      expect(result.automationSummary).toContain('automation completed');
    });
  });

  describe('Power User Workflow', () => {
    it('should handle complex multi-step task creation and management', async () => {
      // Step 1: Power user creates multiple related tasks
      const tasks = await Promise.all([
        taskManager.createTask({
          name: 'Extract Product Info',
          description: 'Extract product details from e-commerce pages',
          promptTemplate: 'Extract product name, price, and key features from: {{title}}',
          websitePatterns: ['amazon\\.com', 'ebay\\.com'],
          outputFormat: OutputFormat.JSON,
          isEnabled: true,
          tags: ['extraction', 'ecommerce']
        }),
        taskManager.createTask({
          name: 'Compare Prices',
          description: 'Compare product prices across different sites',
          promptTemplate: 'Compare prices for {{productName}} across different retailers',
          websitePatterns: ['.*'],
          outputFormat: OutputFormat.MARKDOWN,
          isEnabled: true,
          tags: ['comparison', 'ecommerce']
        }),
        taskManager.createTask({
          name: 'Generate Review Summary',
          description: 'Summarize product reviews',
          promptTemplate: 'Summarize the key points from product reviews: {{reviews}}',
          websitePatterns: ['.*'],
          outputFormat: OutputFormat.PLAIN_TEXT,
          isEnabled: true,
          tags: ['summary', 'reviews']
        })
      ]);

      expect(tasks).toHaveLength(3);

      // Step 2: User creates a task sequence workflow
      const ecommercePageContent = createTestPageContent('https://amazon.com/product/123');
      const websiteContext = await patternEngine.analyzeWebsite(
        ecommercePageContent.url, 
        ecommercePageContent
      );

      // Step 3: Execute tasks in sequence
      const executionContext: ExecutionContext = {
        websiteContext,
        pageContent: ecommercePageContent,
        taskId: tasks[0], // Start with extraction
        userInput: {}
      };

      const sequenceResults = await taskManager.executeTaskSequence(tasks, executionContext);

      expect(sequenceResults).toHaveLength(3);
      expect(sequenceResults.every(r => r.success)).toBe(true);

      // Step 4: User exports task configuration for sharing
      const exportData = await storageService.exportAllData();
      expect(exportData.customTasks).toBeDefined();
      expect(Object.keys(exportData.customTasks)).toHaveLength(3);

      // Step 5: User analyzes usage statistics
      const allStats = await storageService.getAllUsageStats();
      expect(Object.keys(allStats)).toHaveLength(3);
    });

    it('should handle task library management and organization', async () => {
      // Step 1: Create tasks with different categories and tags
      const taskCategories = [
        { category: 'productivity', tags: ['summary', 'notes'] },
        { category: 'social', tags: ['content', 'engagement'] },
        { category: 'research', tags: ['analysis', 'data'] },
        { category: 'automation', tags: ['forms', 'workflow'] }
      ];

      const createdTasks = [];
      for (const { category, tags } of taskCategories) {
        const taskId = await taskManager.createTask({
          name: `${category} Task`,
          description: `Task for ${category} workflows`,
          promptTemplate: `Handle ${category} task for {{domain}}`,
          websitePatterns: ['.*'],
          outputFormat: OutputFormat.PLAIN_TEXT,
          isEnabled: true,
          tags
        });
        createdTasks.push(taskId);
      }

      // Step 2: User organizes tasks by tags and usage
      const allTasks = await taskManager.getAllTasks();
      expect(Object.keys(allTasks)).toHaveLength(4);

      // Step 3: User searches and filters tasks
      const productivityTasks = Object.values(allTasks).filter(task => 
        task.tags.includes('summary')
      );
      expect(productivityTasks).toHaveLength(1);

      // Step 4: User duplicates and modifies existing tasks
      const duplicatedTaskId = await taskManager.duplicateTask(
        createdTasks[0], 
        'Modified Productivity Task'
      );
      
      await taskManager.updateTask(duplicatedTaskId, {
        promptTemplate: 'Enhanced productivity task for {{domain}} with {{context}}'
      });

      const duplicatedTask = await taskManager.getTask(duplicatedTaskId);
      expect(duplicatedTask?.name).toBe('Modified Productivity Task');

      // Step 5: User validates all tasks
      const testResults = await taskManager.testAllTasks();
      expect(Object.keys(testResults)).toHaveLength(5); // 4 original + 1 duplicated
      expect(Object.values(testResults).every(r => r.success)).toBe(true);
    });
  });

  describe('Error Recovery Workflow', () => {
    it('should handle AI service failures gracefully', async () => {
      // Setup: Create unreliable AI service
      const unreliableAI = new MockAIService({ successRate: 0.3 });
      const unreliableTaskManager = createTaskManager(storageService, unreliableAI);

      const taskId = await unreliableTaskManager.createTask({
        name: 'Unreliable Task',
        description: 'Task that may fail',
        promptTemplate: 'Process content from {{domain}}',
        websitePatterns: ['.*'],
        outputFormat: OutputFormat.PLAIN_TEXT,
        isEnabled: true,
        tags: ['test']
      });

      const pageContent = createTestPageContent();
      const websiteContext = await patternEngine.analyzeWebsite(pageContent.url, pageContent);

      const executionContext: ExecutionContext = {
        websiteContext,
        pageContent,
        taskId,
        userInput: {}
      };

      // Step 1: Attempt task execution multiple times
      let successCount = 0;
      let failureCount = 0;

      for (let i = 0; i < 10; i++) {
        const result = await unreliableTaskManager.executeTask(taskId, executionContext);
        if (result.success) {
          successCount++;
        } else {
          failureCount++;
          expect(result.error).toBeDefined();
        }
      }

      // Step 2: Verify error handling and statistics
      expect(failureCount).toBeGreaterThan(0);
      expect(successCount).toBeGreaterThan(0);

      const stats = await storageService.getTaskUsageStats(taskId);
      expect(stats?.errorCount).toBeGreaterThan(0);
      expect(stats?.successRate).toBeLessThan(1.0);
    });

    it('should handle storage corruption and recovery', async () => {
      // Step 1: Create and store tasks normally
      const taskId = await taskManager.createTask({
        name: 'Test Task',
        description: 'Task for corruption test',
        promptTemplate: 'Test prompt',
        websitePatterns: ['.*'],
        outputFormat: OutputFormat.PLAIN_TEXT,
        isEnabled: true,
        tags: ['test']
      });

      // Step 2: Simulate storage corruption
      await chromeMocks.storage.local.set({
        'custom-tasks': 'corrupted-json-data'
      });

      // Step 3: Attempt to retrieve tasks (should handle corruption)
      const tasks = await taskManager.getAllTasks();
      expect(tasks).toEqual({}); // Should return empty object, not crash

      // Step 4: Verify system can recover and create new tasks
      const newTaskId = await taskManager.createTask({
        name: 'Recovery Task',
        description: 'Task created after corruption',
        promptTemplate: 'Recovery prompt',
        websitePatterns: ['.*'],
        outputFormat: OutputFormat.PLAIN_TEXT,
        isEnabled: true,
        tags: ['recovery']
      });

      expect(newTaskId).toBeDefined();

      const recoveredTask = await taskManager.getTask(newTaskId);
      expect(recoveredTask?.name).toBe('Recovery Task');
    });
  });

  describe('Performance and Scale Workflow', () => {
    it('should handle large numbers of tasks efficiently', async () => {
      // Step 1: Create many tasks
      const taskPromises = Array.from({ length: 50 }, (_, i) => 
        taskManager.createTask({
          name: `Task ${i + 1}`,
          description: `Description for task ${i + 1}`,
          promptTemplate: `Prompt for task ${i + 1}: {{domain}}`,
          websitePatterns: [`site${i}\\.com`],
          outputFormat: OutputFormat.PLAIN_TEXT,
          isEnabled: true,
          tags: [`tag${i % 5}`, 'performance']
        })
      );

      const taskIds = await Promise.all(taskPromises);
      expect(taskIds).toHaveLength(50);

      // Step 2: Retrieve all tasks efficiently
      const startTime = Date.now();
      const allTasks = await taskManager.getAllTasks();
      const retrievalTime = Date.now() - startTime;

      expect(Object.keys(allTasks)).toHaveLength(50);
      expect(retrievalTime).toBeLessThan(1000); // Should complete within 1 second

      // Step 3: Test task filtering performance
      const pageContent = createTestPageContent('https://site25.com/test');
      const websiteContext = await patternEngine.analyzeWebsite(pageContent.url, pageContent);

      const matchingTasks = await taskManager.getTasksForWebsite(websiteContext);
      expect(matchingTasks).toHaveLength(1);
      expect(matchingTasks[0].name).toBe('Task 26'); // site25.com matches Task 26

      // Step 4: Test bulk operations
      const testResults = await taskManager.testAllTasks();
      expect(Object.keys(testResults)).toHaveLength(50);
    });

    it('should handle concurrent task executions', async () => {
      // Step 1: Create task for concurrent testing
      const taskId = await taskManager.createTask({
        name: 'Concurrent Task',
        description: 'Task for concurrent execution testing',
        promptTemplate: 'Process {{requestId}} for {{domain}}',
        websitePatterns: ['.*'],
        outputFormat: OutputFormat.PLAIN_TEXT,
        isEnabled: true,
        tags: ['concurrent']
      });

      const pageContent = createTestPageContent();
      const websiteContext = await patternEngine.analyzeWebsite(pageContent.url, pageContent);

      // Step 2: Execute multiple tasks concurrently
      const concurrentExecutions = Array.from({ length: 10 }, (_, i) => {
        const executionContext: ExecutionContext = {
          websiteContext,
          pageContent,
          taskId,
          userInput: { requestId: `request-${i}` }
        };
        return taskManager.executeTask(taskId, executionContext);
      });

      const results = await Promise.all(concurrentExecutions);

      // Step 3: Verify all executions completed successfully
      expect(results).toHaveLength(10);
      expect(results.every(r => r.success)).toBe(true);

      // Step 4: Verify AI service handled concurrent requests
      expect(mockAI.getRequestCount()).toBe(10);

      // Step 5: Verify usage statistics are accurate
      const stats = await storageService.getTaskUsageStats(taskId);
      expect(stats?.usageCount).toBe(10);
    });
  });
});