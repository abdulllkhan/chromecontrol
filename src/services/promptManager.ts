/**
 * Prompt Management System
 * 
 * Handles custom task prompt template processing, variable injection,
 * validation, and debugging capabilities for the Agentic Chrome Extension.
 */

import {
  CustomTask,
  ExecutionContext,
  TemplateContext,
  CleanTextContent,
  TextBlock,
  ListBlock,
  ContentMetadata,
  TemplateValidationResult,
  TemplateValidationError,
  TemplateVariable,
  PageContent,
  WebsiteContext
} from '../types/index.js';

// ============================================================================
// PROMPT MANAGER INTERFACES
// ============================================================================

export interface PromptManagerConfig {
  enableDebugLogging: boolean;
  maxTemplateLength: number;
  maxVariableLength: number;
  allowedVariables: string[];
  enableValidation: boolean;
}

export interface PromptProcessingResult {
  processedPrompt: string;
  variables: Record<string, unknown>;
  processingTime: number;
  debugInfo?: PromptDebugInfo;
}

export interface PromptDebugInfo {
  originalTemplate: string;
  detectedVariables: string[];
  injectedVariables: Record<string, unknown>;
  processingSteps: string[];
  warnings: string[];
}

// ============================================================================
// PROMPT MANAGER IMPLEMENTATION
// ============================================================================

export class PromptManager {
  private config: PromptManagerConfig;
  private debugHistory: Map<string, PromptDebugInfo[]> = new Map();

  constructor(config: Partial<PromptManagerConfig> = {}) {
    this.config = {
      enableDebugLogging: true,
      maxTemplateLength: 10000,
      maxVariableLength: 2000,
      allowedVariables: [
        'domain',
        'pageTitle',
        'title', // Alias for pageTitle for user convenience
        'selectedText',
        'mainText',
        'headings',
        'url',
        'category',
        'pageType',
        'textContent',
        'formCount',
        'linkCount',
        'userInput'
      ],
      enableValidation: true,
      ...config
    };
  }

  // ============================================================================
  // MAIN PROCESSING METHODS
  // ============================================================================

  /**
   * Processes a custom task prompt template with context injection
   */
  async processCustomTaskPrompt(
    task: CustomTask, 
    context: ExecutionContext
  ): Promise<string> {
    const startTime = Date.now();
    
    try {
      // Validate the template if validation is enabled
      if (this.config.enableValidation) {
        const validationResult = this.validatePromptTemplate(task.promptTemplate);
        if (!validationResult.isValid) {
          const errors = validationResult.errors.map(e => e.message).join(', ');
          throw new Error(`Template validation failed: ${errors}`);
        }
      }

      // Build template context from execution context
      const templateContext = await this.buildTemplateContext(context);

      // Inject template variables
      const processedPrompt = this.injectTemplateVariables(
        task.promptTemplate, 
        templateContext
      );

      const processingTime = Date.now() - startTime;

      // Enhanced debug logging with full context
      if (this.config.enableDebugLogging) {
        this.debugPromptExecutionWithContext(
          task.id,
          task.promptTemplate,
          processedPrompt,
          templateContext,
          processingTime
        );
      }

      console.log(`[PromptManager] Processed prompt for task ${task.id} in ${processingTime}ms`);

      return processedPrompt;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`[PromptManager] Failed to process prompt for task ${task.id}:`, error);
      
      // Log the error for debugging
      if (this.config.enableDebugLogging) {
        const errorDebugInfo: PromptDebugInfo = {
          originalTemplate: task.promptTemplate,
          detectedVariables: this.extractVariableNames(task.promptTemplate),
          injectedVariables: {},
          processingSteps: [
            `Processing started`,
            `Error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`,
            `Falling back to original template`
          ],
          warnings: [`Processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
          timestamp: new Date(),
          executionTime: processingTime
        };

        const history = this.debugHistory.get(task.id) || [];
        history.push(errorDebugInfo);
        if (history.length > 10) {
          history.shift();
        }
        this.debugHistory.set(task.id, history);
      }
      
      // Return original template as fallback
      return task.promptTemplate;
    }
  }

  /**
   * Injects template variables into a prompt template
   */
  injectTemplateVariables(template: string, context: TemplateContext): string {
    let processedTemplate = template;
    const processingSteps: string[] = [];
    const injectedVariables: Record<string, unknown> = {};

    // Define variable injection mappings
    const variableMap: Record<string, () => string> = {
      domain: () => context.domain,
      pageTitle: () => context.pageTitle,
      title: () => context.pageTitle, // Alias for pageTitle for user convenience
      selectedText: () => context.selectedText || '',
      mainText: () => context.extractedContent.mainText,
      headings: () => context.extractedContent.headings.map(h => h.content).join('\n'),
      url: () => context.pageContent.url,
      category: () => context.websiteContext.category,
      pageType: () => context.websiteContext.pageType,
      textContent: () => this.truncateText(context.pageContent.textContent, this.config.maxVariableLength),
      formCount: () => String(context.pageContent.forms?.length || 0),
      linkCount: () => String(context.pageContent.links?.length || 0),
      userInput: () => JSON.stringify(context.userInput || {})
    };

    // Process each variable
    for (const [variableName, valueGetter] of Object.entries(variableMap)) {
      const regex = new RegExp(`\\{\\{\\s*${variableName}\\s*\\}\\}`, 'g');
      const matches = processedTemplate.match(regex);
      
      if (matches) {
        try {
          const value = valueGetter();
          const truncatedValue = this.truncateText(value, this.config.maxVariableLength);
          
          processedTemplate = processedTemplate.replace(regex, truncatedValue);
          injectedVariables[variableName] = truncatedValue;
          processingSteps.push(`Injected ${variableName}: ${truncatedValue.substring(0, 50)}...`);
          
        } catch (error) {
          console.warn(`[PromptManager] Failed to inject variable ${variableName}:`, error);
          processingSteps.push(`Failed to inject ${variableName}: ${error}`);
        }
      }
    }

    // Handle any remaining unrecognized variables
    const remainingVariables = processedTemplate.match(/\{\{[^}]+\}\}/g);
    if (remainingVariables) {
      for (const variable of remainingVariables) {
        const variableName = variable.replace(/[{}]/g, '').trim();
        console.warn(`[PromptManager] Unrecognized template variable: ${variableName}`);
        processingSteps.push(`Warning: Unrecognized variable ${variableName}`);
        
        // Replace with empty string or placeholder
        processedTemplate = processedTemplate.replace(variable, `[${variableName}]`);
      }
    }

    return processedTemplate;
  }

  /**
   * Validates a prompt template for syntax and variable usage
   */
  validatePromptTemplate(template: string): TemplateValidationResult {
    const errors: TemplateValidationError[] = [];
    const warnings: string[] = [];
    const variables: TemplateVariable[] = [];

    // Basic template validation
    if (!template || typeof template !== 'string') {
      errors.push({
        message: 'Template must be a non-empty string',
        severity: 'error'
      });
      return { isValid: false, errors, warnings, variables };
    }

    if (template.length > this.config.maxTemplateLength) {
      errors.push({
        message: `Template exceeds maximum length of ${this.config.maxTemplateLength} characters`,
        severity: 'error'
      });
    }

    // Extract and validate template variables
    const variableMatches = template.match(/\{\{[^}]+\}\}/g) || [];
    const detectedVariables = new Set<string>();

    for (const match of variableMatches) {
      const variableName = match.replace(/[{}]/g, '').trim();
      
      if (detectedVariables.has(variableName)) {
        continue; // Skip duplicates
      }
      
      detectedVariables.add(variableName);

      // Check if variable is allowed
      if (!this.config.allowedVariables.includes(variableName)) {
        errors.push({
          message: `Unknown template variable: ${variableName}`,
          variable: variableName,
          severity: 'error'
        });
      }

      // Add to variables list
      variables.push({
        name: variableName,
        type: 'string',
        required: true,
        description: this.getVariableDescription(variableName)
      });
    }

    // Check for malformed variables (single braces that are not part of double braces)
    // First, remove all valid {{variable}} patterns to avoid false positives
    const templateWithoutValidVars = template.replace(/\{\{[^}]+\}\}/g, '');
    
    // Now look for malformed patterns in the remaining text
    const malformedPatterns = [
      /\{[^{}]+\}/g, // Single braces like {variable}
    ];
    
    for (const pattern of malformedPatterns) {
      const matches = templateWithoutValidVars.match(pattern);
      if (matches) {
        for (const match of matches) {
          errors.push({
            message: `Malformed template variable: ${match}. Use {{variableName}} format.`,
            severity: 'error'
          });
        }
      }
    }

    // Warnings for best practices
    if (template.length < 20) {
      warnings.push('Template is very short and may not provide enough context for AI');
    }

    if (variableMatches.length === 0) {
      warnings.push('Template contains no variables. Consider using {{domain}}, {{pageTitle}}, or {{selectedText}} for better context');
    }

    if (template.includes('{{selectedText}}') && !template.includes('{{pageTitle}}')) {
      warnings.push('Using selectedText without pageTitle may provide incomplete context');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      variables
    };
  }

  /**
   * Creates debugging information for prompt execution
   */
  debugPromptExecution(taskId: string, finalPrompt: string, originalTemplate?: string): void {
    if (!this.config.enableDebugLogging) {
      return;
    }

    console.log(`[PromptManager Debug] Task ${taskId} final prompt:`);
    console.log('='.repeat(50));
    console.log(finalPrompt);
    console.log('='.repeat(50));

    // Create debug info entry
    const debugInfo: PromptDebugInfo = {
      originalTemplate: originalTemplate || 'Unknown template',
      detectedVariables: originalTemplate ? this.extractVariableNames(originalTemplate) : [],
      injectedVariables: {
        finalPromptLength: finalPrompt.length,
        timestamp: new Date().toISOString()
      },
      processingSteps: [
        `Final prompt generated with ${finalPrompt.length} characters`,
        `Debug logged at ${new Date().toLocaleString()}`
      ],
      warnings: [],
      timestamp: new Date(),
      executionTime: 0
    };

    // Store debug history
    const history = this.debugHistory.get(taskId) || [];
    history.push(debugInfo);
    
    // Keep only last 10 entries
    if (history.length > 10) {
      history.shift();
    }
    
    this.debugHistory.set(taskId, history);
  }

  /**
   * Enhanced debugging with full execution context
   */
  debugPromptExecutionWithContext(
    taskId: string,
    originalTemplate: string,
    finalPrompt: string,
    context: TemplateContext,
    executionTime: number
  ): void {
    if (!this.config.enableDebugLogging) {
      return;
    }

    const debugInfo: PromptDebugInfo = {
      originalTemplate,
      detectedVariables: this.extractVariableNames(originalTemplate),
      injectedVariables: {
        domain: context.domain,
        pageTitle: context.pageTitle,
        selectedText: context.selectedText ? 'Present' : 'Not provided',
        mainTextLength: context.extractedContent.mainText.length,
        headingsCount: context.extractedContent.headings.length,
        finalPromptLength: finalPrompt.length
      },
      processingSteps: [
        `Template processing started`,
        `Detected ${this.extractVariableNames(originalTemplate).length} variables`,
        `Injected context from ${context.domain}`,
        `Generated final prompt with ${finalPrompt.length} characters`,
        `Processing completed in ${executionTime}ms`
      ],
      warnings: this.validatePromptTemplate(originalTemplate).warnings,
      timestamp: new Date(),
      executionTime
    };

    // Store debug history
    const history = this.debugHistory.get(taskId) || [];
    history.push(debugInfo);
    
    // Keep only last 10 entries
    if (history.length > 10) {
      history.shift();
    }
    
    this.debugHistory.set(taskId, history);

    console.log(`[PromptManager Debug] Enhanced debug info for task ${taskId}:`, debugInfo);
  }

  // ============================================================================
  // CONTEXT BUILDING METHODS
  // ============================================================================

  /**
   * Builds template context from execution context
   */
  private async buildTemplateContext(context: ExecutionContext): Promise<TemplateContext> {
    // Extract clean text content from page content
    const extractedContent = await this.extractCleanContent(context.pageContent);

    return {
      domain: context.websiteContext.domain,
      pageTitle: context.pageContent.title,
      selectedText: context.userInput?.selectedText as string,
      extractedContent,
      userInput: context.userInput,
      websiteContext: context.websiteContext,
      pageContent: context.pageContent
    };
  }

  /**
   * Extracts clean, structured content from page content
   */
  private async extractCleanContent(pageContent: PageContent): Promise<CleanTextContent> {
    // For now, provide a basic implementation
    // This will be enhanced by the TextExtractionEngine in task 28
    
    const headings: TextBlock[] = pageContent.headings.map((heading, index) => ({
      content: heading,
      level: 1, // Default level, could be enhanced
      context: `Heading ${index + 1}`
    }));

    const paragraphs: TextBlock[] = this.extractParagraphs(pageContent.textContent);
    const lists: ListBlock[] = []; // Will be enhanced in future implementation

    const metadata: ContentMetadata = {
      wordCount: this.countWords(pageContent.textContent),
      readingTime: Math.ceil(this.countWords(pageContent.textContent) / 200), // Assume 200 WPM
      extractedAt: new Date(),
      source: pageContent.url
    };

    return {
      mainText: this.cleanText(pageContent.textContent),
      headings,
      paragraphs,
      lists,
      metadata
    };
  }

  /**
   * Extracts paragraphs from text content
   */
  private extractParagraphs(textContent: string): TextBlock[] {
    if (!textContent) return [];

    const sentences = textContent.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const paragraphs: TextBlock[] = [];
    
    // Group sentences into paragraphs (simple heuristic)
    let currentParagraph = '';
    let sentenceCount = 0;

    for (const sentence of sentences) {
      currentParagraph += sentence.trim() + '. ';
      sentenceCount++;

      // Create paragraph after 3-5 sentences or if sentence is very long
      if (sentenceCount >= 3 || sentence.length > 200) {
        if (currentParagraph.trim().length > 0) {
          paragraphs.push({
            content: currentParagraph.trim(),
            context: `Paragraph ${paragraphs.length + 1}`
          });
        }
        currentParagraph = '';
        sentenceCount = 0;
      }
    }

    // Add remaining content as final paragraph
    if (currentParagraph.trim().length > 0) {
      paragraphs.push({
        content: currentParagraph.trim(),
        context: `Paragraph ${paragraphs.length + 1}`
      });
    }

    return paragraphs.slice(0, 10); // Limit to first 10 paragraphs
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Cleans text content by removing extra whitespace and formatting
   */
  private cleanText(text: string): string {
    if (!text) return '';

    return text
      .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
      .replace(/\n\s*\n/g, '\n') // Remove empty lines
      .trim()
      .substring(0, 2000); // Limit length
  }

  /**
   * Counts words in text
   */
  private countWords(text: string): number {
    if (!text) return 0;
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  /**
   * Truncates text to specified length
   */
  private truncateText(text: string, maxLength: number): string {
    if (!text || text.length <= maxLength) {
      return text || '';
    }

    return text.substring(0, maxLength - 3) + '...';
  }

  /**
   * Gets description for a template variable
   */
  private getVariableDescription(variableName: string): string {
    const descriptions: Record<string, string> = {
      domain: 'Current website domain (e.g., example.com)',
      pageTitle: 'Title of the current web page',
      title: 'Title of the current web page (alias for pageTitle)',
      selectedText: 'Text selected by the user on the page',
      mainText: 'Main text content extracted from the page',
      headings: 'All headings found on the page',
      url: 'Full URL of the current page',
      category: 'Detected category of the website',
      pageType: 'Type of the current page (home, article, etc.)',
      textContent: 'Raw text content from the page',
      formCount: 'Number of forms found on the page',
      linkCount: 'Number of links found on the page',
      userInput: 'Additional input provided by the user'
    };

    return descriptions[variableName] || 'Custom template variable';
  }

  /**
   * Logs prompt processing for debugging
   */
  private logPromptProcessing(
    taskId: string,
    originalTemplate: string,
    processedPrompt: string,
    context: TemplateContext
  ): void {
    const debugInfo: PromptDebugInfo = {
      originalTemplate,
      detectedVariables: this.extractVariableNames(originalTemplate),
      injectedVariables: {
        domain: context.domain,
        pageTitle: context.pageTitle,
        selectedText: context.selectedText,
        mainTextLength: context.extractedContent.mainText.length
      },
      processingSteps: [
        `Original template length: ${originalTemplate.length}`,
        `Processed template length: ${processedPrompt.length}`,
        `Variables detected: ${this.extractVariableNames(originalTemplate).length}`
      ],
      warnings: []
    };

    // Store debug info
    const history = this.debugHistory.get(taskId) || [];
    history.push(debugInfo);
    this.debugHistory.set(taskId, history);

    console.log(`[PromptManager Debug] Task ${taskId}:`, debugInfo);
  }

  /**
   * Extracts variable names from template
   */
  private extractVariableNames(template: string): string[] {
    const matches = template.match(/\{\{([^}]+)\}\}/g) || [];
    return matches.map(match => match.replace(/[{}]/g, '').trim());
  }

  // ============================================================================
  // PUBLIC UTILITY METHODS
  // ============================================================================

  /**
   * Gets debug history for a task
   */
  getDebugHistory(taskId: string): PromptDebugInfo[] {
    return this.debugHistory.get(taskId) || [];
  }

  /**
   * Clears debug history for a task
   */
  clearDebugHistory(taskId: string): void {
    this.debugHistory.delete(taskId);
  }

  /**
   * Gets all supported template variables
   */
  getSupportedVariables(): TemplateVariable[] {
    return this.config.allowedVariables.map(name => ({
      name,
      type: 'string',
      required: false,
      description: this.getVariableDescription(name)
    }));
  }

  /**
   * Tests template variable injection with sample data
   */
  async testTemplateVariables(template: string): Promise<{
    processedTemplate: string;
    variables: Record<string, string>;
    errors: string[];
  }> {
    const errors: string[] = [];
    
    try {
      // Create sample template context
      const sampleContext: TemplateContext = {
        domain: 'example.com',
        pageTitle: 'Sample Page Title',
        selectedText: 'Sample selected text',
        extractedContent: {
          mainText: 'This is sample main text content from the page.',
          headings: [{ content: 'Sample Heading', level: 1, context: 'Main heading' }],
          paragraphs: [{ content: 'Sample paragraph content.', context: 'First paragraph' }],
          lists: [],
          metadata: {
            wordCount: 10,
            readingTime: 1,
            extractedAt: new Date(),
            source: 'https://example.com'
          }
        },
        userInput: { testInput: 'sample value' },
        websiteContext: {
          domain: 'example.com',
          category: 'productivity' as any,
          pageType: 'article' as any,
          extractedData: {},
          securityLevel: 'public' as any,
          timestamp: new Date()
        },
        pageContent: {
          url: 'https://example.com',
          title: 'Sample Page Title',
          headings: ['Sample Heading'],
          textContent: 'This is sample text content.',
          forms: [],
          links: [],
          metadata: {},
          extractedAt: new Date()
        }
      };

      const processedTemplate = this.injectTemplateVariables(template, sampleContext);
      
      const variables: Record<string, string> = {};
      for (const varName of this.config.allowedVariables) {
        const regex = new RegExp(`\\{\\{\\s*${varName}\\s*\\}\\}`, 'g');
        if (template.match(regex)) {
          variables[varName] = 'injected';
        }
      }

      return {
        processedTemplate,
        variables,
        errors
      };

    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Unknown error');
      return {
        processedTemplate: template,
        variables: {},
        errors
      };
    }
  }

  /**
   * Analyzes an error to determine if it's a prompt issue or system processing issue
   */
  analyzeExecutionError(error: Error, taskId: string, originalTemplate: string): {
    errorType: 'prompt' | 'system' | 'validation' | 'network';
    userFriendlyMessage: string;
    technicalDetails: string;
    suggestedFix?: string;
  } {
    const errorMessage = error.message.toLowerCase();
    
    // Prompt-related errors
    if (errorMessage.includes('template validation failed') || 
        errorMessage.includes('unknown template variable') ||
        errorMessage.includes('malformed template variable')) {
      return {
        errorType: 'prompt',
        userFriendlyMessage: 'There is an issue with your custom prompt template.',
        technicalDetails: error.message,
        suggestedFix: 'Check your template syntax and ensure all variables use the {{variableName}} format.'
      };
    }

    // Validation errors
    if (errorMessage.includes('validation') || errorMessage.includes('invalid')) {
      return {
        errorType: 'validation',
        userFriendlyMessage: 'The prompt template failed validation checks.',
        technicalDetails: error.message,
        suggestedFix: 'Use the template validator to identify and fix syntax issues.'
      };
    }

    // Network/API errors
    if (errorMessage.includes('network') || 
        errorMessage.includes('timeout') ||
        errorMessage.includes('api') ||
        errorMessage.includes('connection')) {
      return {
        errorType: 'network',
        userFriendlyMessage: 'Unable to connect to the AI service.',
        technicalDetails: error.message,
        suggestedFix: 'Check your internet connection and AI service configuration.'
      };
    }

    // System processing errors (default)
    return {
      errorType: 'system',
      userFriendlyMessage: 'An unexpected system error occurred during processing.',
      technicalDetails: error.message,
      suggestedFix: 'Try again, or contact support if the issue persists.'
    };
  }

  /**
   * Gets comprehensive debugging information for a task
   */
  getTaskDebuggingInfo(taskId: string): {
    debugHistory: PromptDebugInfo[];
    recentErrors: Array<{
      timestamp: Date;
      error: string;
      errorType: string;
    }>;
    executionStats: {
      totalExecutions: number;
      successfulExecutions: number;
      averageExecutionTime: number;
      lastExecution?: Date;
    };
  } {
    const history = this.debugHistory.get(taskId) || [];
    
    // Extract error information
    const recentErrors = history
      .filter(entry => entry.warnings.length > 0)
      .slice(-5) // Last 5 errors
      .map(entry => ({
        timestamp: entry.timestamp || new Date(),
        error: entry.warnings.join(', '),
        errorType: entry.warnings.some(w => w.includes('template')) ? 'prompt' : 'system'
      }));

    // Calculate execution statistics
    const totalExecutions = history.length;
    const successfulExecutions = history.filter(entry => entry.warnings.length === 0).length;
    const executionTimes = history
      .filter(entry => entry.executionTime && entry.executionTime > 0)
      .map(entry => entry.executionTime!);
    const averageExecutionTime = executionTimes.length > 0 
      ? executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length 
      : 0;
    const lastExecution = history.length > 0 ? history[history.length - 1].timestamp : undefined;

    return {
      debugHistory: history,
      recentErrors,
      executionStats: {
        totalExecutions,
        successfulExecutions,
        averageExecutionTime,
        lastExecution
      }
    };
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

// Create default instance
export const promptManager = new PromptManager();

// Export class for custom configurations
export default PromptManager;