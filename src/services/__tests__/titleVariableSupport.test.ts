/**
 * Test for {{title}} variable support in PromptManager
 * 
 * Verifies that the {{title}} variable is now supported as an alias for {{pageTitle}}
 */

import { describe, it, expect } from 'vitest';
import { PromptManager } from '../promptManager.js';
import {
  CustomTask,
  ExecutionContext,
  WebsiteContext,
  PageContent,
  WebsiteCategory,
  PageType,
  SecurityLevel,
  OutputFormat
} from '../../types/index.js';

describe('Title Variable Support', () => {
  let promptManager: PromptManager;

  beforeEach(() => {
    promptManager = new PromptManager();
  });

  const createMockTask = (template: string): CustomTask => ({
    id: 'test-task-1',
    name: 'Test Task',
    description: 'Test task for title variable',
    websitePatterns: ['example.com'],
    promptTemplate: template,
    outputFormat: OutputFormat.PLAIN_TEXT,
    automationSteps: [],
    usageCount: 0,
    isEnabled: true,
    tags: []
  });

  const createMockContext = (): ExecutionContext => ({
    websiteContext: {
      domain: 'example.com',
      category: WebsiteCategory.PRODUCTIVITY,
      pageType: PageType.ARTICLE,
      extractedData: {},
      securityLevel: SecurityLevel.PUBLIC,
      timestamp: new Date()
    },
    pageContent: {
      url: 'https://example.com/test',
      title: 'Test Page Title',
      headings: ['Main Heading'],
      textContent: 'Test content',
      forms: [],
      links: [],
      metadata: {},
      extractedAt: new Date()
    },
    taskId: 'test-task-1',
    userInput: {}
  });

  it('should support {{title}} variable as alias for {{pageTitle}}', async () => {
    const task = createMockTask('Page title is: {{title}}');
    const context = createMockContext();

    const result = await promptManager.processCustomTaskPrompt(task, context);

    expect(result).toContain('Page title is: Test Page Title');
  });

  it('should validate {{title}} as a valid template variable', () => {
    const template = 'Analyze {{title}} on {{domain}}';
    
    const validationResult = promptManager.validatePromptTemplate(template);

    expect(validationResult.isValid).toBe(true);
    expect(validationResult.errors).toHaveLength(0);
    expect(validationResult.variables.some(v => v.name === 'title')).toBe(true);
    expect(validationResult.variables.some(v => v.name === 'domain')).toBe(true);
  });

  it('should include {{title}} in supported variables list', () => {
    const supportedVariables = promptManager.getSupportedVariables();
    
    const titleVariable = supportedVariables.find(v => v.name === 'title');
    expect(titleVariable).toBeDefined();
    expect(titleVariable?.description).toContain('alias for pageTitle');
  });

  it('should work with both {{title}} and {{pageTitle}} in the same template', async () => {
    const task = createMockTask('Title: {{title}}, Page Title: {{pageTitle}}');
    const context = createMockContext();

    const result = await promptManager.processCustomTaskPrompt(task, context);

    expect(result).toContain('Title: Test Page Title, Page Title: Test Page Title');
  });

  it('should test {{title}} variable injection correctly', async () => {
    const template = 'Current page: {{title}}';
    
    const testResult = await promptManager.testTemplateVariables(template);

    expect(testResult.errors).toHaveLength(0);
    expect(testResult.variables.title).toBe('injected');
    expect(testResult.processedTemplate).toContain('Current page: Sample Page Title');
  });
});