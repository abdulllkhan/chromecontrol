/**
 * PromptManager Tests
 * 
 * Tests for the prompt template processing and variable injection system
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PromptManager } from '../promptManager.js';
import {
  CustomTask,
  ExecutionContext,
  TemplateContext,
  WebsiteContext,
  PageContent,
  OutputFormat,
  SecurityLevel,
  WebsiteCategory,
  PageType
} from '../../types/index.js';

describe('PromptManager', () => {
  let promptManager: PromptManager;
  let sampleTask: CustomTask;
  let sampleContext: ExecutionContext;

  beforeEach(() => {
    promptManager = new PromptManager({
      enableDebugLogging: false, // Disable for tests
      enableValidation: true
    });

    sampleTask = {
      id: 'test-task-1',
      name: 'Test Task',
      description: 'A test task for prompt processing',
      websitePatterns: ['example.com'],
      promptTemplate: 'Analyze the content on {{domain}} with title "{{pageTitle}}". Selected text: {{selectedText}}',
      outputFormat: OutputFormat.PLAIN_TEXT,
      usageCount: 0,
      isEnabled: true,
      tags: ['test']
    };

    sampleContext = {
      websiteContext: {
        domain: 'example.com',
        category: WebsiteCategory.PRODUCTIVITY,
        pageType: PageType.ARTICLE,
        extractedData: {},
        securityLevel: SecurityLevel.PUBLIC,
        timestamp: new Date()
      },
      pageContent: {
        url: 'https://example.com/article',
        title: 'Sample Article Title',
        headings: ['Introduction', 'Main Content', 'Conclusion'],
        textContent: 'This is the main text content of the article. It contains useful information about the topic.',
        forms: [],
        links: [
          { href: 'https://example.com/link1', text: 'Link 1' },
          { href: 'https://example.com/link2', text: 'Link 2' }
        ],
        metadata: { author: 'Test Author' },
        extractedAt: new Date()
      },
      userInput: {
        selectedText: 'important information'
      },
      taskId: 'test-task-1'
    };
  });

  describe('processCustomTaskPrompt', () => {
    it('should process a simple template with basic variables', async () => {
      const result = await promptManager.processCustomTaskPrompt(sampleTask, sampleContext);
      
      expect(result).toContain('example.com');
      expect(result).toContain('Sample Article Title');
      expect(result).toContain('important information');
      expect(result).not.toContain('{{domain}}');
      expect(result).not.toContain('{{pageTitle}}');
      expect(result).not.toContain('{{selectedText}}');
    });

    it('should handle missing selectedText gracefully', async () => {
      const contextWithoutSelection = {
        ...sampleContext,
        userInput: {}
      };

      const result = await promptManager.processCustomTaskPrompt(sampleTask, contextWithoutSelection);
      
      expect(result).toContain('example.com');
      expect(result).toContain('Sample Article Title');
      // Should replace {{selectedText}} with empty string
      expect(result).toContain('Selected text: ');
    });

    it('should process all supported template variables', async () => {
      const complexTask = {
        ...sampleTask,
        promptTemplate: `
          Domain: {{domain}}
          Title: {{pageTitle}}
          URL: {{url}}
          Category: {{category}}
          Page Type: {{pageType}}
          Main Text: {{mainText}}
          Headings: {{headings}}
          Text Content: {{textContent}}
          Form Count: {{formCount}}
          Link Count: {{linkCount}}
          User Input: {{userInput}}
        `
      };

      const result = await promptManager.processCustomTaskPrompt(complexTask, sampleContext);
      
      expect(result).toContain('Domain: example.com');
      expect(result).toContain('Title: Sample Article Title');
      expect(result).toContain('URL: https://example.com/article');
      expect(result).toContain('Category: productivity');
      expect(result).toContain('Page Type: article');
      expect(result).toContain('Form Count: 0');
      expect(result).toContain('Link Count: 2');
      expect(result).toContain('User Input: {"selectedText":"important information"}');
    });

    it('should handle template validation errors', async () => {
      const invalidTask = {
        ...sampleTask,
        promptTemplate: '' // Empty template
      };

      // Should return original template as fallback
      const result = await promptManager.processCustomTaskPrompt(invalidTask, sampleContext);
      expect(result).toBe('');
    });

    it('should truncate long content appropriately', async () => {
      const longContentContext = {
        ...sampleContext,
        pageContent: {
          ...sampleContext.pageContent,
          textContent: 'A'.repeat(5000) // Very long content
        }
      };

      const taskWithTextContent = {
        ...sampleTask,
        promptTemplate: 'Content: {{textContent}}'
      };

      const result = await promptManager.processCustomTaskPrompt(taskWithTextContent, longContentContext);
      
      // Should be truncated to max length (2000 chars by default) + '...'
      expect(result.length).toBeLessThan(2100);
      expect(result).toContain('...');
    });
  });

  describe('injectTemplateVariables', () => {
    it('should inject variables with proper formatting', () => {
      const template = 'Hello {{domain}}, your page is {{pageTitle}}';
      const templateContext: TemplateContext = {
        domain: 'test.com',
        pageTitle: 'Test Page',
        selectedText: '',
        extractedContent: {
          mainText: 'Test content',
          headings: [],
          paragraphs: [],
          lists: [],
          metadata: {
            wordCount: 2,
            readingTime: 1,
            extractedAt: new Date(),
            source: 'test.com'
          }
        },
        userInput: {},
        websiteContext: sampleContext.websiteContext,
        pageContent: sampleContext.pageContent
      };

      const result = promptManager.injectTemplateVariables(template, templateContext);
      expect(result).toBe('Hello test.com, your page is Test Page');
    });

    it('should handle variables with whitespace', () => {
      const template = 'Domain: {{ domain }} Title: {{  pageTitle  }}';
      const templateContext: TemplateContext = {
        domain: 'test.com',
        pageTitle: 'Test Page',
        selectedText: '',
        extractedContent: {
          mainText: 'Test content',
          headings: [],
          paragraphs: [],
          lists: [],
          metadata: {
            wordCount: 2,
            readingTime: 1,
            extractedAt: new Date(),
            source: 'test.com'
          }
        },
        userInput: {},
        websiteContext: sampleContext.websiteContext,
        pageContent: sampleContext.pageContent
      };

      const result = promptManager.injectTemplateVariables(template, templateContext);
      expect(result).toBe('Domain: test.com Title: Test Page');
    });

    it('should replace unrecognized variables with placeholders', () => {
      const template = 'Known: {{domain}} Unknown: {{unknownVariable}}';
      const templateContext: TemplateContext = {
        domain: 'test.com',
        pageTitle: 'Test Page',
        selectedText: '',
        extractedContent: {
          mainText: 'Test content',
          headings: [],
          paragraphs: [],
          lists: [],
          metadata: {
            wordCount: 2,
            readingTime: 1,
            extractedAt: new Date(),
            source: 'test.com'
          }
        },
        userInput: {},
        websiteContext: sampleContext.websiteContext,
        pageContent: sampleContext.pageContent
      };

      const result = promptManager.injectTemplateVariables(template, templateContext);
      expect(result).toBe('Known: test.com Unknown: [unknownVariable]');
    });
  });

  describe('validatePromptTemplate', () => {
    it('should validate a correct template', () => {
      const template = 'Analyze {{domain}} with title {{pageTitle}}';
      const result = promptManager.validatePromptTemplate(template);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.variables).toHaveLength(2);
      expect(result.variables[0].name).toBe('domain');
      expect(result.variables[1].name).toBe('pageTitle');
    });

    it('should detect invalid variables', () => {
      const template = 'Invalid variable: {{invalidVar}}';
      const result = promptManager.validatePromptTemplate(template);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Unknown template variable: invalidVar');
    });

    it('should detect malformed variables', () => {
      const template = 'Malformed: {domain} or {pageTitle}}';
      const result = promptManager.validatePromptTemplate(template);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.message.includes('Malformed'))).toBe(true);
    });

    it('should provide warnings for best practices', () => {
      const shortTemplate = 'Short';
      const result = promptManager.validatePromptTemplate(shortTemplate);
      
      expect(result.warnings).toContain('Template is very short and may not provide enough context for AI');
    });

    it('should handle empty or invalid templates', () => {
      const result = promptManager.validatePromptTemplate('');
      
      expect(result.isValid).toBe(false);
      expect(result.errors[0].message).toBe('Template must be a non-empty string');
    });

    it('should detect duplicate variables correctly', () => {
      const template = 'Domain {{domain}} and again {{domain}}';
      const result = promptManager.validatePromptTemplate(template);
      
      expect(result.isValid).toBe(true);
      expect(result.variables).toHaveLength(1); // Should not duplicate
      expect(result.variables[0].name).toBe('domain');
    });
  });

  describe('testTemplateVariables', () => {
    it('should test template with sample data', async () => {
      const template = 'Test {{domain}} and {{pageTitle}}';
      const result = await promptManager.testTemplateVariables(template);
      
      expect(result.processedTemplate).toContain('example.com');
      expect(result.processedTemplate).toContain('Sample Page Title');
      expect(result.variables.domain).toBe('injected');
      expect(result.variables.pageTitle).toBe('injected');
      expect(result.errors).toHaveLength(0);
    });

    it('should handle errors in template testing', async () => {
      // Test with invalid template that might cause errors
      const template = null as any;
      const result = await promptManager.testTemplateVariables(template);
      
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('getSupportedVariables', () => {
    it('should return all supported variables with descriptions', () => {
      const variables = promptManager.getSupportedVariables();
      
      expect(variables.length).toBeGreaterThan(0);
      expect(variables.every(v => v.name && v.description)).toBe(true);
      
      const domainVar = variables.find(v => v.name === 'domain');
      expect(domainVar).toBeDefined();
      expect(domainVar?.description).toContain('domain');
    });
  });

  describe('debugPromptExecution', () => {
    it('should log debug information when enabled', () => {
      const debugManager = new PromptManager({ enableDebugLogging: true });
      
      // Should not throw error
      expect(() => {
        debugManager.debugPromptExecution('test-task', 'final prompt content');
      }).not.toThrow();
    });

    it('should not log when debugging is disabled', () => {
      const debugManager = new PromptManager({ enableDebugLogging: false });
      
      // Should not throw error
      expect(() => {
        debugManager.debugPromptExecution('test-task', 'final prompt content');
      }).not.toThrow();
    });
  });

  describe('debug history management', () => {
    it('should store and retrieve debug history', () => {
      const debugManager = new PromptManager({ enableDebugLogging: true });
      
      debugManager.debugPromptExecution('test-task', 'prompt 1');
      debugManager.debugPromptExecution('test-task', 'prompt 2');
      
      const history = debugManager.getDebugHistory('test-task');
      expect(history).toHaveLength(2); // Debug history is stored by debugPromptExecution calls
    });

    it('should clear debug history', () => {
      const debugManager = new PromptManager({ enableDebugLogging: true });
      
      debugManager.clearDebugHistory('test-task');
      const history = debugManager.getDebugHistory('test-task');
      expect(history).toHaveLength(0);
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle null or undefined context gracefully', async () => {
      const nullContext = null as any;
      
      // Should not throw, but return original template
      const result = await promptManager.processCustomTaskPrompt(sampleTask, nullContext);
      expect(result).toBe(sampleTask.promptTemplate);
    });

    it('should handle missing page content', async () => {
      const contextWithoutPageContent = {
        ...sampleContext,
        pageContent: null as any
      };
      
      const result = await promptManager.processCustomTaskPrompt(sampleTask, contextWithoutPageContent);
      expect(result).toBe(sampleTask.promptTemplate); // Should fallback to original
    });

    it('should handle very long templates', () => {
      const longTemplate = 'A'.repeat(15000); // Exceeds max length
      const result = promptManager.validatePromptTemplate(longTemplate);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.message.includes('exceeds maximum length'))).toBe(true);
    });

    it('should handle templates with no variables', () => {
      const staticTemplate = 'This is a static template with no variables';
      const result = promptManager.validatePromptTemplate(staticTemplate);
      
      expect(result.isValid).toBe(true);
      expect(result.variables).toHaveLength(0);
      expect(result.warnings).toContain('Template contains no variables. Consider using {{domain}}, {{pageTitle}}, or {{selectedText}} for better context');
    });
  });

  describe('integration with custom task execution', () => {
    it('should properly process a real-world task template', async () => {
      const realWorldTask = {
        ...sampleTask,
        promptTemplate: `
          Please analyze the content on {{domain}} ({{url}}).
          
          Page Title: {{pageTitle}}
          Category: {{category}}
          
          Main content to analyze:
          {{mainText}}
          
          Key headings:
          {{headings}}
          
          ${sampleContext.userInput?.selectedText ? 'User selected text: {{selectedText}}' : ''}
          
          Please provide insights about this content and suggest improvements.
        `
      };

      const result = await promptManager.processCustomTaskPrompt(realWorldTask, sampleContext);
      
      expect(result).toContain('example.com');
      expect(result).toContain('https://example.com/article');
      expect(result).toContain('Sample Article Title');
      expect(result).toContain('productivity');
      expect(result).toContain('important information');
      expect(result).not.toContain('{{');
      expect(result).not.toContain('}}');
    });
  });
});