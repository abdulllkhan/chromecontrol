// Core type definitions for the Agentic Chrome Extension

// ============================================================================
// ENUMS
// ============================================================================

export enum WebsiteCategory {
  SOCIAL_MEDIA = 'social_media',
  ECOMMERCE = 'ecommerce',
  PROFESSIONAL = 'professional',
  NEWS_CONTENT = 'news_content',
  PRODUCTIVITY = 'productivity',
  CUSTOM = 'custom'
}

export enum PageType {
  HOME = 'home',
  PRODUCT = 'product',
  ARTICLE = 'article',
  PROFILE = 'profile',
  FORM = 'form',
  OTHER = 'other'
}

export enum SecurityLevel {
  PUBLIC = 'public',
  CAUTIOUS = 'cautious',
  RESTRICTED = 'restricted'
}

export enum OutputFormat {
  PLAIN_TEXT = 'plain_text',
  HTML = 'html',
  MARKDOWN = 'markdown',
  JSON = 'json'
}

export enum TaskType {
  GENERATE_TEXT = 'generate_text',
  ANALYZE_CONTENT = 'analyze_content',
  AUTOMATE_ACTION = 'automate_action',
  EXTRACT_DATA = 'extract_data'
}

// ============================================================================
// CORE INTERFACES
// ============================================================================

export interface WebsiteContext {
  domain: string;
  category: WebsiteCategory;
  pageType: PageType;
  extractedData: Record<string, unknown>;
  securityLevel: SecurityLevel;
  timestamp: Date;
}

export interface CustomTask {
  id: string;
  name: string;
  description: string;
  websitePatterns: string[];
  promptTemplate: string;
  outputFormat: OutputFormat;
  automationSteps?: AutomationStep[];
  createdAt: Date;
  updatedAt: Date;
  usageCount: number;
  isEnabled: boolean;
  tags: string[];
}

export interface AIRequest {
  prompt: string;
  context: WebsiteContext;
  pageContent?: PageContent; // Add page content for richer context
  taskType: TaskType;
  outputFormat: OutputFormat;
  constraints: SecurityConstraints;
  taskId?: string;
  userInput?: Record<string, unknown>;
  timestamp: Date;
}

export interface AIResponse {
  content: string;
  format: OutputFormat;
  confidence: number;
  suggestions?: string[];
  automationInstructions?: AutomationStep[];
  timestamp: Date;
  requestId: string;
}

// ============================================================================
// SUPPORTING INTERFACES
// ============================================================================

export interface PageContent {
  url: string;
  title: string;
  headings: string[];
  textContent: string;
  forms: FormElement[];
  links: LinkElement[];
  metadata: Record<string, string>;
  extractedAt: Date;
}

export interface FormElement {
  id?: string;
  name?: string;
  type: string;
  placeholder?: string;
  required: boolean;
  value?: string;
}

export interface LinkElement {
  href: string;
  text: string;
  title?: string;
}

export interface AutomationStep {
  type: 'click' | 'type' | 'select' | 'wait' | 'extract';
  selector: string;
  value?: string;
  waitCondition?: WaitCondition;
  description: string;
}

export interface WaitCondition {
  type: 'element' | 'timeout' | 'url_change';
  value: string | number;
}

export interface SecurityConstraints {
  allowSensitiveData: boolean;
  maxContentLength: number;
  allowedDomains: string[];
  restrictedSelectors: string[];
}

export interface ExecutionContext {
  websiteContext: WebsiteContext;
  pageContent: PageContent;
  userInput?: Record<string, unknown>;
  taskId: string;
}

export interface TaskResult {
  success: boolean;
  content?: string;
  format: OutputFormat;
  automationSummary?: string;
  error?: string;
  timestamp: Date;
  executionTime: number;
}

// ============================================================================
// STORAGE SCHEMA TYPES
// ============================================================================

export interface StorageSchema {
  // User-created custom tasks
  customTasks: Record<string, CustomTask>;
  
  // Website-specific patterns and configurations
  websitePatterns: Record<string, WebsitePattern>;
  
  // User preferences and settings
  userPreferences: UserPreferences;
  
  // Cache for AI responses and website analysis
  responseCache: Record<string, CachedResponse>;
  
  // Usage analytics for optimization
  usageStats: Record<string, UsageMetrics>;
}

export interface WebsitePattern {
  id: string;
  pattern: string;
  category: WebsiteCategory;
  customSuggestions: string[];
  isEnabled: boolean;
  createdAt: Date;
}

export interface UserPreferences {
  enabledCategories: WebsiteCategory[];
  customPatterns: CustomPattern[];
  privacySettings: PrivacySettings;
  automationPermissions: Record<string, boolean>;
  aiProvider: string;
  theme: 'light' | 'dark' | 'auto';
  aiConfig?: {
    apiKey: string;
    model?: string;
    maxTokens?: number;
    temperature?: number;
    baseUrl?: string;
  };
}

export interface CustomPattern {
  id: string;
  name: string;
  urlPattern: string;
  category: WebsiteCategory;
  suggestions: string[];
}

export interface PrivacySettings {
  sharePageContent: boolean;
  shareFormData: boolean;
  allowAutomation: boolean;
  securityLevel: SecurityLevel;
  excludedDomains: string[];
}

export interface CachedResponse {
  requestHash: string;
  response: AIResponse;
  expiresAt: Date;
  hitCount: number;
}

export interface UsageMetrics {
  taskId: string;
  usageCount: number;
  successRate: number;
  averageExecutionTime: number;
  lastUsed: Date;
  errorCount: number;
}

// ============================================================================
// SUGGESTION AND UI TYPES
// ============================================================================

export interface Suggestion {
  id: string;
  title: string;
  description: string;
  category: string;
  taskId?: string;
  isCustom: boolean;
  estimatedTime: number;
  requiresPermission: boolean;
  icon?: string;
}

export interface Pattern {
  id: string;
  name: string;
  urlRegex: string;
  category: WebsiteCategory;
  suggestions: Suggestion[];
  isBuiltIn: boolean;
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export const ValidationUtils = {
  /**
   * Validates a WebsiteContext object
   */
  validateWebsiteContext(context: unknown): context is WebsiteContext {
    if (!context || typeof context !== 'object') {
      throw new ValidationError('WebsiteContext must be an object');
    }

    const ctx = context as Record<string, unknown>;

    if (!ctx.domain || typeof ctx.domain !== 'string') {
      throw new ValidationError('domain must be a non-empty string', 'domain');
    }

    if (!TypeGuards.isWebsiteCategory(ctx.category)) {
      throw new ValidationError('category must be a valid WebsiteCategory', 'category');
    }

    if (!TypeGuards.isPageType(ctx.pageType)) {
      throw new ValidationError('pageType must be a valid PageType', 'pageType');
    }

    if (!TypeGuards.isSecurityLevel(ctx.securityLevel)) {
      throw new ValidationError('securityLevel must be a valid SecurityLevel', 'securityLevel');
    }

    if (!ctx.extractedData || typeof ctx.extractedData !== 'object') {
      throw new ValidationError('extractedData must be an object', 'extractedData');
    }

    if (!(ctx.timestamp instanceof Date) && typeof ctx.timestamp !== 'string') {
      throw new ValidationError('timestamp must be a Date or ISO string', 'timestamp');
    }

    return true;
  },

  /**
   * Validates a CustomTask object
   */
  validateCustomTask(task: unknown): task is CustomTask {
    if (!task || typeof task !== 'object') {
      throw new ValidationError('CustomTask must be an object');
    }

    const t = task as Record<string, unknown>;

    if (!t.id || typeof t.id !== 'string' || t.id.trim().length === 0) {
      throw new ValidationError('id must be a non-empty string', 'id');
    }

    if (!t.name || typeof t.name !== 'string' || t.name.trim().length === 0) {
      throw new ValidationError('name must be a non-empty string', 'name');
    }

    if (!t.description || typeof t.description !== 'string') {
      throw new ValidationError('description must be a string', 'description');
    }

    if (!Array.isArray(t.websitePatterns)) {
      throw new ValidationError('websitePatterns must be an array', 'websitePatterns');
    }

    if (t.websitePatterns.some(pattern => typeof pattern !== 'string')) {
      throw new ValidationError('all websitePatterns must be strings', 'websitePatterns');
    }

    if (!t.promptTemplate || typeof t.promptTemplate !== 'string') {
      throw new ValidationError('promptTemplate must be a non-empty string', 'promptTemplate');
    }

    if (!TypeGuards.isOutputFormat(t.outputFormat)) {
      throw new ValidationError('outputFormat must be a valid OutputFormat', 'outputFormat');
    }

    if (t.automationSteps && !Array.isArray(t.automationSteps)) {
      throw new ValidationError('automationSteps must be an array if provided', 'automationSteps');
    }

    // Handle createdAt - allow Date, string, or convertible values
    if (t.createdAt === null || t.createdAt === undefined) {
      throw new ValidationError('createdAt cannot be null or undefined', 'createdAt');
    }
    if (!(t.createdAt instanceof Date) && typeof t.createdAt !== 'string') {
      throw new ValidationError('createdAt must be a Date or ISO string', 'createdAt');
    }
    
    // If it's a string, verify it can be converted to a valid date
    if (typeof t.createdAt === 'string') {
      const testDate = new Date(t.createdAt);
      if (isNaN(testDate.getTime())) {
        throw new ValidationError('createdAt string must be a valid date', 'createdAt');
      }
    }

    // Handle updatedAt - allow Date, string, or convertible values
    if (t.updatedAt === null || t.updatedAt === undefined) {
      throw new ValidationError('updatedAt cannot be null or undefined', 'updatedAt');
    }
    if (!(t.updatedAt instanceof Date) && typeof t.updatedAt !== 'string') {
      throw new ValidationError('updatedAt must be a Date or ISO string', 'updatedAt');
    }
    
    // If it's a string, verify it can be converted to a valid date
    if (typeof t.updatedAt === 'string') {
      const testDate = new Date(t.updatedAt);
      if (isNaN(testDate.getTime())) {
        throw new ValidationError('updatedAt string must be a valid date', 'updatedAt');
      }
    }

    if (typeof t.usageCount !== 'number' || t.usageCount < 0) {
      throw new ValidationError('usageCount must be a non-negative number', 'usageCount');
    }

    if (typeof t.isEnabled !== 'boolean') {
      throw new ValidationError('isEnabled must be a boolean', 'isEnabled');
    }

    if (!Array.isArray(t.tags)) {
      throw new ValidationError('tags must be an array', 'tags');
    }

    if (t.tags.some(tag => typeof tag !== 'string')) {
      throw new ValidationError('all tags must be strings', 'tags');
    }

    return true;
  },

  /**
   * Validates an AIRequest object
   */
  validateAIRequest(request: unknown): request is AIRequest {
    if (!request || typeof request !== 'object') {
      throw new ValidationError('AIRequest must be an object');
    }

    const req = request as Record<string, unknown>;

    if (!req.prompt || typeof req.prompt !== 'string' || req.prompt.trim().length === 0) {
      throw new ValidationError('prompt must be a non-empty string', 'prompt');
    }

    if (!req.context || !this.validateWebsiteContext(req.context)) {
      throw new ValidationError('context must be a valid WebsiteContext', 'context');
    }

    if (!TypeGuards.isTaskType(req.taskType)) {
      throw new ValidationError('taskType must be a valid TaskType', 'taskType');
    }

    if (!TypeGuards.isOutputFormat(req.outputFormat)) {
      throw new ValidationError('outputFormat must be a valid OutputFormat', 'outputFormat');
    }

    if (!req.constraints || !this.validateSecurityConstraints(req.constraints)) {
      throw new ValidationError('constraints must be a valid SecurityConstraints object', 'constraints');
    }

    if (req.taskId && typeof req.taskId !== 'string') {
      throw new ValidationError('taskId must be a string if provided', 'taskId');
    }

    if (req.userInput && typeof req.userInput !== 'object') {
      throw new ValidationError('userInput must be an object if provided', 'userInput');
    }

    if (!(req.timestamp instanceof Date) && typeof req.timestamp !== 'string') {
      throw new ValidationError('timestamp must be a Date or ISO string', 'timestamp');
    }

    return true;
  },

  /**
   * Validates a SecurityConstraints object
   */
  validateSecurityConstraints(constraints: unknown): constraints is SecurityConstraints {
    if (!constraints || typeof constraints !== 'object') {
      throw new ValidationError('SecurityConstraints must be an object');
    }

    const c = constraints as Record<string, unknown>;

    if (typeof c.allowSensitiveData !== 'boolean') {
      throw new ValidationError('allowSensitiveData must be a boolean', 'allowSensitiveData');
    }

    if (typeof c.maxContentLength !== 'number' || c.maxContentLength < 0) {
      throw new ValidationError('maxContentLength must be a non-negative number', 'maxContentLength');
    }

    if (!Array.isArray(c.allowedDomains)) {
      throw new ValidationError('allowedDomains must be an array', 'allowedDomains');
    }

    if (c.allowedDomains.some(domain => typeof domain !== 'string')) {
      throw new ValidationError('all allowedDomains must be strings', 'allowedDomains');
    }

    if (!Array.isArray(c.restrictedSelectors)) {
      throw new ValidationError('restrictedSelectors must be an array', 'restrictedSelectors');
    }

    if (c.restrictedSelectors.some(selector => typeof selector !== 'string')) {
      throw new ValidationError('all restrictedSelectors must be strings', 'restrictedSelectors');
    }

    return true;
  },

  /**
   * Validates an AutomationStep object
   */
  validateAutomationStep(step: unknown): step is AutomationStep {
    if (!step || typeof step !== 'object') {
      throw new ValidationError('AutomationStep must be an object');
    }

    const s = step as Record<string, unknown>;

    const validTypes = ['click', 'type', 'select', 'wait', 'extract'];
    if (validTypes.indexOf(s.type as string) === -1) {
      throw new ValidationError('type must be one of: click, type, select, wait, extract', 'type');
    }

    // Selector can be empty for wait steps that use waitCondition
    if (s.type !== 'wait' && (!s.selector || typeof s.selector !== 'string' || s.selector.trim().length === 0)) {
      throw new ValidationError('selector must be a non-empty string', 'selector');
    }
    
    if (s.type === 'wait' && typeof s.selector !== 'string') {
      throw new ValidationError('selector must be a string for wait steps', 'selector');
    }

    if (s.value !== undefined && typeof s.value !== 'string') {
      throw new ValidationError('value must be a string if provided', 'value');
    }

    if (!s.description || typeof s.description !== 'string') {
      throw new ValidationError('description must be a non-empty string', 'description');
    }

    if (s.waitCondition && !this.validateWaitCondition(s.waitCondition)) {
      throw new ValidationError('waitCondition must be a valid WaitCondition if provided', 'waitCondition');
    }

    return true;
  },

  /**
   * Validates a WaitCondition object
   */
  validateWaitCondition(condition: unknown): condition is WaitCondition {
    if (!condition || typeof condition !== 'object') {
      throw new ValidationError('WaitCondition must be an object');
    }

    const c = condition as Record<string, unknown>;

    const validTypes = ['element', 'timeout', 'url_change'];
    if (validTypes.indexOf(c.type as string) === -1) {
      throw new ValidationError('type must be one of: element, timeout, url_change', 'type');
    }

    if (c.value === undefined || (typeof c.value !== 'string' && typeof c.value !== 'number')) {
      throw new ValidationError('value must be a string or number', 'value');
    }

    return true;
  },

  /**
   * Validates URL patterns
   */
  validateUrlPattern(pattern: string): boolean {
    if (!pattern || typeof pattern !== 'string') {
      throw new ValidationError('URL pattern must be a non-empty string');
    }

    // Allow simple domain names without requiring regex escaping
    const simpleDomainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?$/;
    if (simpleDomainRegex.test(pattern)) {
      return true;
    }

    try {
      // Test if it's a valid regex pattern for more complex patterns
      new RegExp(pattern);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new ValidationError(`Invalid URL pattern: must be a valid domain name or regex pattern. Error: ${errorMessage}`);
    }
  },

  /**
   * Validates domain names
   */
  validateDomain(domain: string): boolean {
    if (!domain || typeof domain !== 'string') {
      throw new ValidationError('Domain must be a non-empty string');
    }

    // Basic domain validation regex
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    
    if (!domainRegex.test(domain)) {
      throw new ValidationError('Invalid domain format');
    }

    return true;
  },

  /**
   * Sanitizes and validates user input
   */
  sanitizeUserInput(input: unknown): Record<string, unknown> {
    if (!input || typeof input !== 'object') {
      return {};
    }

    const sanitized: Record<string, unknown> = {};
    const inputObj = input as Record<string, unknown>;

    for (const key in inputObj) {
      if (!inputObj.hasOwnProperty(key)) continue;
      const value = inputObj[key];
      // Skip functions and undefined values
      if (typeof value === 'function' || value === undefined) {
        continue;
      }

      // Sanitize strings
      if (typeof value === 'string') {
        sanitized[key] = value.trim().slice(0, 1000); // Limit string length
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        sanitized[key] = value;
      } else if (Array.isArray(value)) {
        sanitized[key] = value.slice(0, 100); // Limit array length
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeUserInput(value);
      }
    }

    return sanitized;
  }
};

// ============================================================================
// TYPE GUARDS
// ============================================================================

export const TypeGuards = {
  isWebsiteCategory(value: unknown): value is WebsiteCategory {
    if (typeof value !== 'string') return false;
    for (const key in WebsiteCategory) {
      if (WebsiteCategory[key as keyof typeof WebsiteCategory] === value) return true;
    }
    return false;
  },

  isPageType(value: unknown): value is PageType {
    if (typeof value !== 'string') return false;
    for (const key in PageType) {
      if (PageType[key as keyof typeof PageType] === value) return true;
    }
    return false;
  },

  isSecurityLevel(value: unknown): value is SecurityLevel {
    if (typeof value !== 'string') return false;
    for (const key in SecurityLevel) {
      if (SecurityLevel[key as keyof typeof SecurityLevel] === value) return true;
    }
    return false;
  },

  isOutputFormat(value: unknown): value is OutputFormat {
    if (typeof value !== 'string') return false;
    for (const key in OutputFormat) {
      if (OutputFormat[key as keyof typeof OutputFormat] === value) return true;
    }
    return false;
  },

  isTaskType(value: unknown): value is TaskType {
    if (typeof value !== 'string') return false;
    for (const key in TaskType) {
      if (TaskType[key as keyof typeof TaskType] === value) return true;
    }
    return false;
  },

  isValidDate(value: unknown): value is Date {
    return value instanceof Date && !isNaN(value.getTime());
  },

  isValidISOString(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    const date = new Date(value);
    return !isNaN(date.getTime()) && date.toISOString() === value;
  }
};