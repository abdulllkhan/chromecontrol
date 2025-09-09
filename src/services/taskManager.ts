/**
 * Task Management System
 * 
 * Provides comprehensive task management functionality including CRUD operations,
 * website association logic, execution engine with context injection, and
 * validation/testing capabilities.
 */

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
  ValidationUtils,
  ValidationError,
  AutomationStep
} from '../types/index.js';

import { ChromeStorageService } from './storage.js';
import { AIService, AIError } from './aiService.js';

// ============================================================================
// TASK MANAGER INTERFACES
// ============================================================================

export interface TaskManagerConfig {
  storageService: ChromeStorageService;
  aiService: AIService;
  enableValidation: boolean;
  enableTesting: boolean;
  maxExecutionTime: number;
  defaultSecurityConstraints: {
    allowSensitiveData: boolean;
    maxContentLength: number;
    allowedDomains: string[];
    restrictedSelectors: string[];
  };
}

export interface TaskExecutionOptions {
  validateBeforeExecution?: boolean;
  timeoutMs?: number;
  dryRun?: boolean;
  includeDebugInfo?: boolean;
}

export interface TaskValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: string[];
  suggestions: string[];
}

export interface TaskTestResult {
  success: boolean;
  executionTime: number;
  result?: TaskResult;
  error?: string;
  validationResult: TaskValidationResult;
}

export interface TaskAssociationRule {
  id: string;
  name: string;
  urlPattern: string;
  domainPattern?: string;
  pathPattern?: string;
  contentPattern?: string;
  priority: number;
  isEnabled: boolean;
}

// ============================================================================
// TASK MANAGER IMPLEMENTATION
// ============================================================================

export class TaskManager {
  private config: TaskManagerConfig;
  private executionCache = new Map<string, TaskResult>();
  private associationRules: TaskAssociationRule[] = [];

  constructor(config: TaskManagerConfig) {
    this.config = config;
    this.initializeAssociationRules();
  }

  // ============================================================================
  // TASK CRUD OPERATIONS
  // ============================================================================

  /**
   * Creates a new custom task with validation
   */
  async createTask(taskData: Omit<CustomTask, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>): Promise<string> {
    try {
      // Validate task data before creation
      if (this.config.enableValidation) {
        const validationResult = await this.validateTaskData(taskData);
        if (!validationResult.isValid) {
          throw new ValidationError(
            `Task validation failed: ${validationResult.errors.map(e => e.message).join(', ')}`
          );
        }
      }

      // Create the task using storage service
      const taskId = await this.config.storageService.createCustomTask(taskData);

      console.log(`Task created successfully: ${taskId}`);
      return taskId;
    } catch (error) {
      console.error('Failed to create task:', error);
      throw error;
    }
  }

  /**
   * Retrieves a task by ID
   */
  async getTask(taskId: string): Promise<CustomTask | null> {
    try {
      return await this.config.storageService.getCustomTask(taskId);
    } catch (error) {
      console.error(`Failed to get task ${taskId}:`, error);
      return null;
    }
  }

  /**
   * Retrieves all tasks
   */
  async getAllTasks(): Promise<Record<string, CustomTask>> {
    try {
      return await this.config.storageService.getAllCustomTasks();
    } catch (error) {
      console.error('Failed to get all tasks:', error);
      return {};
    }
  }

  /**
   * Updates an existing task
   */
  async updateTask(taskId: string, updates: Partial<Omit<CustomTask, 'id' | 'createdAt'>>): Promise<boolean> {
    try {
      // Validate updates if validation is enabled
      if (this.config.enableValidation && Object.keys(updates).length > 0) {
        const existingTask = await this.getTask(taskId);
        if (!existingTask) {
          throw new Error(`Task ${taskId} not found`);
        }

        const updatedTask = { ...existingTask, ...updates };
        const validationResult = await this.validateTaskData(updatedTask);
        if (!validationResult.isValid) {
          throw new ValidationError(
            `Task update validation failed: ${validationResult.errors.map(e => e.message).join(', ')}`
          );
        }
      }

      const success = await this.config.storageService.updateCustomTask(taskId, updates);
      
      if (success) {
        // Clear execution cache for this task
        this.clearTaskExecutionCache(taskId);
        console.log(`Task updated successfully: ${taskId}`);
      }

      return success;
    } catch (error) {
      console.error(`Failed to update task ${taskId}:`, error);
      throw error;
    }
  }

  /**
   * Deletes a task
   */
  async deleteTask(taskId: string): Promise<boolean> {
    try {
      const success = await this.config.storageService.deleteCustomTask(taskId);
      
      if (success) {
        // Clear execution cache for this task
        this.clearTaskExecutionCache(taskId);
        console.log(`Task deleted successfully: ${taskId}`);
      }

      return success;
    } catch (error) {
      console.error(`Failed to delete task ${taskId}:`, error);
      throw error;
    }
  }

  /**
   * Duplicates an existing task
   */
  async duplicateTask(taskId: string, newName?: string): Promise<string> {
    try {
      const originalTask = await this.getTask(taskId);
      if (!originalTask) {
        throw new Error(`Task ${taskId} not found`);
      }

      const duplicatedTask = {
        ...originalTask,
        name: newName || `${originalTask.name} (Copy)`,
        usageCount: 0
      };

      // Remove fields that will be auto-generated
      delete (duplicatedTask as any).id;
      delete (duplicatedTask as any).createdAt;
      delete (duplicatedTask as any).updatedAt;

      return await this.createTask(duplicatedTask);
    } catch (error) {
      console.error(`Failed to duplicate task ${taskId}:`, error);
      throw error;
    }
  }

  // ============================================================================
  // TASK-TO-WEBSITE ASSOCIATION LOGIC
  // ============================================================================

  /**
   * Gets tasks associated with a specific website context
   */
  async getTasksForWebsite(context: WebsiteContext): Promise<CustomTask[]> {
    try {
      // Get tasks matching domain patterns
      const domainTasks = await this.config.storageService.getTasksForWebsite(context.domain);
      
      // Apply additional association rules
      const associatedTasks = await this.applyAssociationRules(domainTasks, context);
      
      // Sort by priority and usage
      return this.sortTasksByRelevance(associatedTasks, context);
    } catch (error) {
      console.error(`Failed to get tasks for website ${context.domain}:`, error);
      return [];
    }
  }

  /**
   * Associates a task with website patterns
   */
  async associateTaskWithWebsite(taskId: string, websitePatterns: string[]): Promise<boolean> {
    try {
      // Validate patterns
      for (const pattern of websitePatterns) {
        ValidationUtils.validateUrlPattern(pattern);
      }

      return await this.updateTask(taskId, { websitePatterns });
    } catch (error) {
      console.error(`Failed to associate task ${taskId} with websites:`, error);
      throw error;
    }
  }

  /**
   * Removes task association with specific website patterns
   */
  async removeTaskWebsiteAssociation(taskId: string, patternsToRemove: string[]): Promise<boolean> {
    try {
      const task = await this.getTask(taskId);
      if (!task) {
        throw new Error(`Task ${taskId} not found`);
      }

      const updatedPatterns = task.websitePatterns.filter(
        pattern => !patternsToRemove.includes(pattern)
      );

      return await this.updateTask(taskId, { websitePatterns: updatedPatterns });
    } catch (error) {
      console.error(`Failed to remove website associations for task ${taskId}:`, error);
      throw error;
    }
  }

  /**
   * Gets all website patterns associated with tasks
   */
  async getAllWebsiteAssociations(): Promise<Record<string, string[]>> {
    try {
      const tasks = await this.getAllTasks();
      const associations: Record<string, string[]> = {};

      for (const [taskId, task] of Object.entries(tasks)) {
        if (task.websitePatterns.length > 0) {
          associations[taskId] = task.websitePatterns;
        }
      }

      return associations;
    } catch (error) {
      console.error('Failed to get website associations:', error);
      return {};
    }
  }

  // ============================================================================
  // TASK EXECUTION ENGINE WITH CONTEXT INJECTION
  // ============================================================================

  /**
   * Executes a task with the provided context
   */
  async executeTask(
    taskId: string, 
    context: ExecutionContext, 
    options: TaskExecutionOptions = {}
  ): Promise<TaskResult> {
    const startTime = Date.now();
    
    try {
      // Get the task
      const task = await this.getTask(taskId);
      if (!task) {
        throw new Error(`Task ${taskId} not found`);
      }

      if (!task.isEnabled) {
        throw new Error(`Task ${taskId} is disabled`);
      }

      // Validate before execution if requested
      if (options.validateBeforeExecution) {
        const validationResult = await this.validateTask(taskId);
        if (!validationResult.isValid) {
          throw new ValidationError(
            `Task validation failed: ${validationResult.errors.map(e => e.message).join(', ')}`
          );
        }
      }

      // Check execution cache
      const cacheKey = this.generateExecutionCacheKey(taskId, context);
      if (this.executionCache.has(cacheKey) && !options.dryRun) {
        const cachedResult = this.executionCache.get(cacheKey)!;
        console.log(`Returning cached result for task ${taskId}`);
        return cachedResult;
      }

      // Prepare AI request with context injection
      const aiRequest = await this.buildAIRequestWithContext(task, context);

      // Execute the task
      let result: TaskResult;
      
      if (options.dryRun) {
        result = await this.simulateTaskExecution(task, context);
      } else {
        result = await this.performTaskExecution(task, aiRequest, context, options);
      }

      // Record execution metrics
      const executionTime = Date.now() - startTime;
      result.executionTime = executionTime;

      // Cache the result
      if (!options.dryRun) {
        this.executionCache.set(cacheKey, result);
        
        // Record usage statistics
        await this.config.storageService.recordTaskUsage(taskId, result.success, executionTime);
      }

      console.log(`Task ${taskId} executed in ${executionTime}ms`);
      return result;

    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorResult: TaskResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
        executionTime,
        format: OutputFormat.PLAIN_TEXT
      };

      // Record failed execution
      if (!options.dryRun) {
        await this.config.storageService.recordTaskUsage(taskId, false, executionTime);
      }

      console.error(`Task ${taskId} execution failed:`, error);
      return errorResult;
    }
  }

  /**
   * Executes multiple tasks in sequence
   */
  async executeTaskSequence(
    taskIds: string[], 
    context: ExecutionContext, 
    options: TaskExecutionOptions = {}
  ): Promise<TaskResult[]> {
    const results: TaskResult[] = [];
    
    for (const taskId of taskIds) {
      try {
        const result = await this.executeTask(taskId, context, options);
        results.push(result);
        
        // Stop on first failure unless continuing is explicitly requested
        if (!result.success && !options.dryRun) {
          break;
        }
      } catch (error) {
        const errorResult: TaskResult = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date(),
          executionTime: 0,
          format: OutputFormat.PLAIN_TEXT
        };
        results.push(errorResult);
        break;
      }
    }
    
    return results;
  }

  // ============================================================================
  // TASK VALIDATION AND TESTING CAPABILITIES
  // ============================================================================

  /**
   * Validates a task configuration
   */
  async validateTask(taskId: string): Promise<TaskValidationResult> {
    try {
      const task = await this.getTask(taskId);
      if (!task) {
        return {
          isValid: false,
          errors: [new ValidationError(`Task ${taskId} not found`)],
          warnings: [],
          suggestions: []
        };
      }

      return await this.validateTaskData(task);
    } catch (error) {
      return {
        isValid: false,
        errors: [new ValidationError(error instanceof Error ? error.message : 'Unknown validation error')],
        warnings: [],
        suggestions: []
      };
    }
  }

  /**
   * Tests a task with sample data
   */
  async testTask(taskId: string, sampleContext?: ExecutionContext): Promise<TaskTestResult> {
    const startTime = Date.now();
    
    try {
      // Validate the task first
      const validationResult = await this.validateTask(taskId);
      
      if (!validationResult.isValid) {
        return {
          success: false,
          executionTime: Date.now() - startTime,
          error: `Validation failed: ${validationResult.errors.map(e => e.message).join(', ')}`,
          validationResult
        };
      }

      // Use sample context or create a default one
      const testContext = sampleContext || await this.createSampleExecutionContext();
      
      // Execute the task in dry run mode
      const result = await this.executeTask(taskId, testContext, { 
        dryRun: true, 
        validateBeforeExecution: false,
        includeDebugInfo: true 
      });

      return {
        success: result.success,
        executionTime: Date.now() - startTime,
        result,
        validationResult
      };

    } catch (error) {
      return {
        success: false,
        executionTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown test error',
        validationResult: {
          isValid: false,
          errors: [new ValidationError('Test execution failed')],
          warnings: [],
          suggestions: []
        }
      };
    }
  }

  /**
   * Runs comprehensive tests on all tasks
   */
  async testAllTasks(): Promise<Record<string, TaskTestResult>> {
    const tasks = await this.getAllTasks();
    const results: Record<string, TaskTestResult> = {};
    
    for (const taskId of Object.keys(tasks)) {
      try {
        results[taskId] = await this.testTask(taskId);
      } catch (error) {
        results[taskId] = {
          success: false,
          executionTime: 0,
          error: error instanceof Error ? error.message : 'Unknown error',
          validationResult: {
            isValid: false,
            errors: [new ValidationError('Test failed')],
            warnings: [],
            suggestions: []
          }
        };
      }
    }
    
    return results;
  }

  /**
   * Validates task data structure and content
   */
  private async validateTaskData(taskData: Partial<CustomTask>): Promise<TaskValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    try {
      // For task creation, we don't validate the full CustomTask structure since id, dates, etc. are auto-generated
      // Instead, validate the required fields manually
      if (!taskData.name || typeof taskData.name !== 'string' || taskData.name.trim().length === 0) {
        errors.push(new ValidationError('name must be a non-empty string', 'name'));
      }

      if (!taskData.description || typeof taskData.description !== 'string') {
        errors.push(new ValidationError('description must be a string', 'description'));
      }

      if (!Array.isArray(taskData.websitePatterns)) {
        errors.push(new ValidationError('websitePatterns must be an array', 'websitePatterns'));
      }

      if (!taskData.promptTemplate || typeof taskData.promptTemplate !== 'string') {
        errors.push(new ValidationError('promptTemplate must be a non-empty string', 'promptTemplate'));
      }

      if (taskData.outputFormat && !Object.values(OutputFormat).includes(taskData.outputFormat)) {
        errors.push(new ValidationError('outputFormat must be a valid OutputFormat', 'outputFormat'));
      }

      if (taskData.isEnabled !== undefined && typeof taskData.isEnabled !== 'boolean') {
        errors.push(new ValidationError('isEnabled must be a boolean', 'isEnabled'));
      }

      if (taskData.tags && !Array.isArray(taskData.tags)) {
        errors.push(new ValidationError('tags must be an array', 'tags'));
      }

      if (taskData.tags && taskData.tags.some(tag => typeof tag !== 'string')) {
        errors.push(new ValidationError('all tags must be strings', 'tags'));
      }

      // If this is a complete task (has id), validate the full structure
      if (taskData.id) {
        ValidationUtils.validateCustomTask(taskData as CustomTask);
      }
    } catch (error) {
      if (error instanceof ValidationError) {
        errors.push(error);
      }
    }

    // Validate website patterns
    if (taskData.websitePatterns) {
      for (const pattern of taskData.websitePatterns) {
        try {
          ValidationUtils.validateUrlPattern(pattern);
        } catch (error) {
          if (error instanceof ValidationError) {
            errors.push(new ValidationError(`Invalid website pattern "${pattern}": ${error.message}`));
          }
        }
      }
    }

    // Validate prompt template
    if (taskData.promptTemplate) {
      if (taskData.promptTemplate.length < 10) {
        warnings.push('Prompt template is very short and may not provide enough context');
      }
      
      if (taskData.promptTemplate.length > 2000) {
        warnings.push('Prompt template is very long and may exceed AI model limits');
      }

      // Check for template variables
      const templateVars = taskData.promptTemplate.match(/\{\{[^}]+\}\}/g);
      if (templateVars) {
        suggestions.push(`Template uses variables: ${templateVars.join(', ')}. Ensure these are properly handled.`);
      }
    }

    // Validate automation steps
    if (taskData.automationSteps) {
      for (let i = 0; i < taskData.automationSteps.length; i++) {
        try {
          ValidationUtils.validateAutomationStep(taskData.automationSteps[i]);
        } catch (error) {
          if (error instanceof ValidationError) {
            errors.push(new ValidationError(`Invalid automation step ${i + 1}: ${error.message}`));
          }
        }
      }
    }

    // Performance suggestions
    if (taskData.websitePatterns && taskData.websitePatterns.length > 10) {
      suggestions.push('Consider reducing the number of website patterns for better performance');
    }

    if (taskData.tags && taskData.tags.length === 0) {
      suggestions.push('Adding tags will help with task organization and discovery');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions
    };
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Initializes default association rules
   */
  private initializeAssociationRules(): void {
    this.associationRules = [
      {
        id: 'social-media',
        name: 'Social Media Sites',
        urlPattern: '(facebook|twitter|instagram|linkedin|tiktok|youtube)\\.com',
        priority: 10,
        isEnabled: true
      },
      {
        id: 'ecommerce',
        name: 'E-commerce Sites',
        urlPattern: '(amazon|ebay|shopify|etsy|walmart)\\.com',
        priority: 10,
        isEnabled: true
      },
      {
        id: 'news',
        name: 'News Sites',
        urlPattern: '(cnn|bbc|reuters|nytimes|washingtonpost)\\.com',
        priority: 8,
        isEnabled: true
      }
    ];
  }

  /**
   * Applies association rules to filter and prioritize tasks
   */
  private async applyAssociationRules(tasks: CustomTask[], context: WebsiteContext): Promise<CustomTask[]> {
    const scoredTasks = tasks.map(task => ({
      task,
      score: this.calculateTaskRelevanceScore(task, context)
    }));

    return scoredTasks
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(item => item.task);
  }

  /**
   * Calculates relevance score for a task based on context
   */
  private calculateTaskRelevanceScore(task: CustomTask, context: WebsiteContext): number {
    let score = 0;

    // Base score for enabled tasks
    if (!task.isEnabled) return 0;
    score += 1;

    // Usage-based scoring
    score += Math.min(task.usageCount * 0.1, 5);

    // Pattern matching scoring
    for (const pattern of task.websitePatterns) {
      try {
        const regex = new RegExp(pattern, 'i');
        if (regex.test(context.domain)) {
          score += 10;
        }
        if (regex.test(context.extractedData.url as string || '')) {
          score += 5;
        }
      } catch (error) {
        // Invalid regex, skip
        continue;
      }
    }

    // Category matching
    const categoryKeywords = {
      social_media: ['post', 'share', 'like', 'comment', 'follow'],
      ecommerce: ['buy', 'cart', 'product', 'price', 'order'],
      professional: ['job', 'career', 'resume', 'linkedin', 'work'],
      news_content: ['article', 'news', 'read', 'story', 'report']
    };

    const keywords = categoryKeywords[context.category as keyof typeof categoryKeywords];
    if (keywords) {
      const taskText = `${task.name} ${task.description} ${task.promptTemplate}`.toLowerCase();
      const matchingKeywords = keywords.filter(keyword => taskText.includes(keyword));
      score += matchingKeywords.length * 2;
    }

    return score;
  }

  /**
   * Sorts tasks by relevance to the current context
   */
  private sortTasksByRelevance(tasks: CustomTask[], context: WebsiteContext): CustomTask[] {
    return tasks.sort((a, b) => {
      const scoreA = this.calculateTaskRelevanceScore(a, context);
      const scoreB = this.calculateTaskRelevanceScore(b, context);
      
      if (scoreA !== scoreB) {
        return scoreB - scoreA;
      }
      
      // Secondary sort by usage count
      if (a.usageCount !== b.usageCount) {
        return b.usageCount - a.usageCount;
      }
      
      // Tertiary sort by creation date (newer first)
      return b.createdAt.getTime() - a.createdAt.getTime();
    });
  }

  /**
   * Builds AI request with injected context
   */
  private async buildAIRequestWithContext(task: CustomTask, context: ExecutionContext): Promise<AIRequest> {
    // Inject context variables into prompt template
    const injectedPrompt = this.injectContextIntoPrompt(task.promptTemplate, context);
    
    // Determine task type based on task configuration
    const taskType = this.determineTaskType(task);
    
    // Build security constraints based on website context
    const securityConstraints = this.buildSecurityConstraints(context.websiteContext);

    return {
      prompt: injectedPrompt,
      context: context.websiteContext,
      pageContent: context.pageContent, // Pass page content for richer context
      taskType,
      outputFormat: task.outputFormat,
      constraints: securityConstraints,
      taskId: task.id,
      userInput: context.userInput,
      timestamp: new Date()
    };
  }

  /**
   * Injects context variables into prompt template
   */
  private injectContextIntoPrompt(template: string, context: ExecutionContext): string {
    let injectedPrompt = template;
    
    // Define available context variables with null checks
    const contextVars = {
      domain: context.websiteContext?.domain || 'unknown',
      category: context.websiteContext?.category || 'unknown',
      pageType: context.websiteContext?.pageType || 'unknown',
      title: context.pageContent?.title || 'No title',
      url: context.pageContent?.url || 'unknown',
      headings: context.pageContent?.headings?.join(', ') || 'No headings',
      textContent: (context.pageContent?.textContent || 'No content').slice(0, 1000), // Limit length
      formCount: context.pageContent?.forms?.length || 0,
      linkCount: context.pageContent?.links?.length || 0,
      userInput: JSON.stringify(context.userInput || {})
    };
    
    // Replace template variables
    for (const [key, value] of Object.entries(contextVars)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      injectedPrompt = injectedPrompt.replace(regex, String(value));
    }
    
    return injectedPrompt;
  }

  /**
   * Determines task type based on task configuration
   */
  private determineTaskType(task: CustomTask): TaskType {
    // Analyze task to determine type
    const taskText = `${task.name} ${task.description} ${task.promptTemplate}`.toLowerCase();
    
    if (task.automationSteps && task.automationSteps.length > 0) {
      return TaskType.AUTOMATE_ACTION;
    }
    
    if (taskText.includes('extract') || taskText.includes('data') || taskText.includes('information')) {
      return TaskType.EXTRACT_DATA;
    }
    
    if (taskText.includes('analyze') || taskText.includes('summary') || taskText.includes('review')) {
      return TaskType.ANALYZE_CONTENT;
    }
    
    return TaskType.GENERATE_TEXT;
  }

  /**
   * Builds security constraints based on website context
   */
  private buildSecurityConstraints(context: WebsiteContext) {
    const baseConstraints = this.config.defaultSecurityConstraints;
    
    // Adjust constraints based on security level
    switch (context.securityLevel) {
      case SecurityLevel.RESTRICTED:
        return {
          ...baseConstraints,
          allowSensitiveData: false,
          maxContentLength: Math.min(baseConstraints.maxContentLength, 500)
        };
      
      case SecurityLevel.CAUTIOUS:
        return {
          ...baseConstraints,
          allowSensitiveData: false
        };
      
      case SecurityLevel.PUBLIC:
      default:
        return baseConstraints;
    }
  }

  /**
   * Performs actual task execution
   */
  private async performTaskExecution(
    task: CustomTask, 
    aiRequest: AIRequest, 
    context: ExecutionContext,
    options: TaskExecutionOptions
  ): Promise<TaskResult> {
    try {
      // Execute AI request
      const aiResponse = await this.config.aiService.processRequest(aiRequest);
      
      // Validate AI response
      if (!this.config.aiService.validateResponse(aiResponse)) {
        throw new Error('Invalid AI response format');
      }
      
      // Build task result
      const result: TaskResult = {
        success: true,
        content: aiResponse.content,
        format: aiResponse.format,
        timestamp: new Date(),
        executionTime: 0 // Will be set by caller
      };
      
      // Add automation summary if applicable
      if (aiResponse.automationInstructions && aiResponse.automationInstructions.length > 0) {
        result.automationSummary = `Generated ${aiResponse.automationInstructions.length} automation steps`;
      }
      
      return result;
      
    } catch (error) {
      if (error instanceof AIError) {
        throw new Error(`AI service error: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Simulates task execution for testing
   */
  private async simulateTaskExecution(task: CustomTask, context: ExecutionContext): Promise<TaskResult> {
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return {
      success: true,
      content: `[SIMULATED] Task "${task.name}" would execute with context from ${context.websiteContext?.domain || 'unknown'}`,
      format: task.outputFormat,
      timestamp: new Date(),
      executionTime: 100
    };
  }

  /**
   * Creates a sample execution context for testing
   */
  private async createSampleExecutionContext(): Promise<ExecutionContext> {
    return {
      websiteContext: {
        domain: 'example.com',
        category: 'productivity' as any,
        pageType: 'other' as any,
        extractedData: { title: 'Sample Page' },
        securityLevel: SecurityLevel.PUBLIC,
        timestamp: new Date()
      },
      pageContent: {
        url: 'https://example.com',
        title: 'Sample Page',
        headings: ['Main Heading', 'Sub Heading'],
        textContent: 'This is sample page content for testing purposes.',
        forms: [],
        links: [],
        metadata: {},
        extractedAt: new Date()
      },
      taskId: 'sample-task'
    };
  }

  /**
   * Generates cache key for execution results
   */
  private generateExecutionCacheKey(taskId: string, context: ExecutionContext): string {
    const contextHash = this.hashObject({
      domain: context.websiteContext?.domain || 'unknown',
      url: context.pageContent?.url || 'unknown',
      title: context.pageContent?.title || 'unknown',
      userInput: context.userInput
    });
    
    return `${taskId}_${contextHash}`;
  }

  /**
   * Simple hash function for objects
   */
  private hashObject(obj: any): string {
    const str = JSON.stringify(obj);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Clears execution cache for a specific task
   */
  private clearTaskExecutionCache(taskId: string): void {
    const keysToDelete: string[] = [];
    
    for (const key of this.executionCache.keys()) {
      if (key.startsWith(`${taskId}_`)) {
        keysToDelete.push(key);
      }
    }
    
    for (const key of keysToDelete) {
      this.executionCache.delete(key);
    }
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Creates a task manager instance with default configuration
 */
export function createTaskManager(
  storageService: ChromeStorageService,
  aiService: AIService,
  overrides: Partial<TaskManagerConfig> = {}
): TaskManager {
  const defaultConfig: TaskManagerConfig = {
    storageService,
    aiService,
    enableValidation: true,
    enableTesting: true,
    maxExecutionTime: 30000,
    defaultSecurityConstraints: {
      allowSensitiveData: false,
      maxContentLength: 2000,
      allowedDomains: [],
      restrictedSelectors: ['input[type="password"]', '[data-sensitive]']
    }
  };

  const config = { ...defaultConfig, ...overrides };
  return new TaskManager(config);
}

/**
 * Utility function to create a basic task template
 */
export function createTaskTemplate(
  name: string,
  description: string,
  promptTemplate: string,
  websitePatterns: string[] = [],
  outputFormat: OutputFormat = OutputFormat.PLAIN_TEXT
): Omit<CustomTask, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'> {
  return {
    name,
    description,
    websitePatterns,
    promptTemplate,
    outputFormat,
    isEnabled: true,
    tags: []
  };
}

// ============================================================================
// TASK ADDITION WORKFLOW
// ============================================================================

export class TaskAdditionWorkflow {
  private websiteContext?: WebsiteContext;
  private pageContent?: any;
  private suggestedPatterns: string[] = [];
  private existingTasks: CustomTask[] = [];

  constructor(
    private storageService: ChromeStorageService,
    private patternEngine: any
  ) {}

  async initializeFromCurrentPage(pageContent: any): Promise<{
    success: boolean;
    websiteContext?: WebsiteContext;
    suggestedPatterns?: string[];
    existingTasks?: CustomTask[];
    privacyWarnings?: string[];
    error?: string;
  }> {
    try {
      this.pageContent = pageContent;
      this.websiteContext = await this.patternEngine.analyzeWebsite(pageContent.url, pageContent);
      this.suggestedPatterns = this.patternEngine.generateSuggestedPatterns(this.websiteContext.domain);
      this.existingTasks = await this.storageService.getTasksForWebsite(this.websiteContext.domain);

      const privacyWarnings = [];
      if (this.websiteContext && this.websiteContext.securityLevel === SecurityLevel.RESTRICTED) {
        privacyWarnings.push('This appears to be a sensitive website');
      }

      return {
        success: true,
        websiteContext: this.websiteContext,
        suggestedPatterns: this.suggestedPatterns,
        existingTasks: this.existingTasks,
        privacyWarnings
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async generateTaskSuggestions(context: WebsiteContext): Promise<any[]> {
    const suggestions = [];
    
    switch (context.category) {
      case 'social_media':
        suggestions.push(
          { name: 'Generate Social Media Post', description: 'Create engaging social media content', promptTemplate: 'Create a social media post about: {{title}}' },
          { name: 'Generate Hashtag Suggestions', description: 'Suggest relevant hashtags', promptTemplate: 'Suggest hashtags for: {{title}}' },
          { name: 'Analyze Content Analysis', description: 'Analyze social media content', promptTemplate: 'Analyze the content: {{title}}' }
        );
        break;
      case 'ecommerce':
        suggestions.push(
          { name: 'Analyze Product Analysis', description: 'Analyze product details', promptTemplate: 'Analyze product: {{title}}' },
          { name: 'Compare Price Comparison', description: 'Compare product prices', promptTemplate: 'Compare prices for: {{title}}' },
          { name: 'Summarize Review Summary', description: 'Summarize product reviews', promptTemplate: 'Summarize reviews for: {{title}}' }
        );
        break;
      case 'professional':
        suggestions.push(
          { name: 'Optimize Profile Optimization', description: 'Optimize professional profile', promptTemplate: 'Optimize profile for: {{title}}' },
          { name: 'Generate Connection Message', description: 'Generate connection message', promptTemplate: 'Generate connection message for: {{title}}' },
          { name: 'Create Job Application', description: 'Create job application', promptTemplate: 'Create application for: {{title}}' }
        );
        break;
      default:
        suggestions.push(
          { name: 'Summarize Content Summary', description: 'Summarize page content', promptTemplate: 'Summarize: {{title}}' },
          { name: 'Extract Key Points', description: 'Extract key points', promptTemplate: 'Extract key points from: {{title}}' },
          { name: 'Generate Action Items', description: 'Generate action items', promptTemplate: 'Generate action items for: {{title}}' }
        );
    }
    
    return suggestions;
  }

  async createTaskFromTemplate(template: any): Promise<string> {
    if (!this.websiteContext) {
      throw new Error('Workflow not initialized');
    }

    const taskData = {
      name: template.name,
      description: template.description,
      promptTemplate: template.promptTemplate,
      websitePatterns: this.suggestedPatterns,
      outputFormat: OutputFormat.PLAIN_TEXT,
      isEnabled: true,
      tags: []
    };

    return await this.storageService.createCustomTask(taskData);
  }

  async createCustomTask(taskData: any): Promise<string> {
    if (!this.websiteContext) {
      throw new Error('Workflow not initialized');
    }

    const validation = this.validateTaskData(taskData);
    if (!validation.isValid) {
      throw new ValidationError(validation.errors[0].message);
    }

    const fullTaskData = {
      ...taskData,
      websitePatterns: taskData.websitePatterns || this.suggestedPatterns,
      isEnabled: true
    };

    return await this.storageService.createCustomTask(fullTaskData);
  }

  validateTaskData(taskData: any): { isValid: boolean; errors: ValidationError[]; warnings: string[]; suggestions: string[] } {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    if (!taskData.name || taskData.name.trim() === '') {
      errors.push(new ValidationError('Task name is required'));
    }

    if (!taskData.description || taskData.description.trim() === '') {
      errors.push(new ValidationError('Task description is required'));
    }

    if (!taskData.promptTemplate || taskData.promptTemplate.trim() === '') {
      errors.push(new ValidationError('Prompt template is required'));
    }

    if (taskData.websitePatterns) {
      for (const pattern of taskData.websitePatterns) {
        if (!this.patternEngine.validatePattern(pattern)) {
          errors.push(new ValidationError(`Invalid website pattern: ${pattern}`));
        }
      }
    }

    if (taskData.description && taskData.description.length < 10) {
      warnings.push('Description is quite short');
    }

    if (taskData.promptTemplate && taskData.promptTemplate.length < 20) {
      warnings.push('Prompt template is quite short');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions
    };
  }

  getContextVariables(): Record<string, string> {
    if (!this.websiteContext || !this.pageContent) {
      throw new Error('Workflow not initialized');
    }

    return {
      domain: this.websiteContext.domain,
      url: this.pageContent.url,
      title: this.pageContent.title,
      description: this.pageContent.metadata?.description || '',
      keywords: this.pageContent.metadata?.keywords || '',
      headings: this.pageContent.headings || [],
      pageType: this.websiteContext.pageType,
      category: this.websiteContext.category
    };
  }

  previewTask(taskData: any): { processedPrompt: string; contextVariables: Record<string, string>; estimatedTokens: number; warnings: string[] } {
    const contextVariables = this.getContextVariables();
    const warnings: string[] = [];
    
    let processedPrompt = taskData.promptTemplate;
    const templateVars = processedPrompt.match(/\{\{([^}]+)\}\}/g) || [];
    
    for (const templateVar of templateVars) {
      const varName = templateVar.slice(2, -2).trim();
      if (contextVariables[varName]) {
        processedPrompt = processedPrompt.replace(templateVar, contextVariables[varName]);
      } else {
        warnings.push(`Unknown template variable: ${varName}`);
      }
    }

    return {
      processedPrompt,
      contextVariables,
      estimatedTokens: Math.ceil(processedPrompt.length / 4),
      warnings
    };
  }

  reset(): void {
    this.websiteContext = undefined;
    this.pageContent = undefined;
    this.suggestedPatterns = [];
    this.existingTasks = [];
  }
}