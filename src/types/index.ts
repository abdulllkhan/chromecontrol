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
}

export interface AIConfiguration {
  id: string;
  name: string;
  provider: 'openai' | 'claude' | 'local';
  apiKey: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  baseUrl?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
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
  aiConfigurations?: AIConfiguration[];
  activeAIConfigId?: string;
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
  },

  /**
   * Validates an MCPContext object
   */
  validateMCPContext(context: unknown): context is MCPContext {
    if (!context || typeof context !== 'object') {
      throw new ValidationError('MCPContext must be an object');
    }

    const ctx = context as Record<string, unknown>;

    if (!Array.isArray(ctx.resources)) {
      throw new ValidationError('resources must be an array', 'resources');
    }

    if (!Array.isArray(ctx.tools)) {
      throw new ValidationError('tools must be an array', 'tools');
    }

    if (!Array.isArray(ctx.prompts)) {
      throw new ValidationError('prompts must be an array', 'prompts');
    }

    if (!ctx.metadata || !this.validateMCPMetadata(ctx.metadata)) {
      throw new ValidationError('metadata must be a valid MCPMetadata object', 'metadata');
    }

    // Validate each resource
    for (let i = 0; i < ctx.resources.length; i++) {
      if (!this.validateMCPResource(ctx.resources[i])) {
        throw new ValidationError(`Invalid resource at index ${i}`, 'resources');
      }
    }

    // Validate each tool
    for (let i = 0; i < ctx.tools.length; i++) {
      if (!this.validateMCPTool(ctx.tools[i])) {
        throw new ValidationError(`Invalid tool at index ${i}`, 'tools');
      }
    }

    // Validate each prompt
    for (let i = 0; i < ctx.prompts.length; i++) {
      if (!this.validateMCPPrompt(ctx.prompts[i])) {
        throw new ValidationError(`Invalid prompt at index ${i}`, 'prompts');
      }
    }

    return true;
  },

  /**
   * Validates an MCPResource object
   */
  validateMCPResource(resource: unknown): resource is MCPResource {
    if (!resource || typeof resource !== 'object') {
      throw new ValidationError('MCPResource must be an object');
    }

    const r = resource as Record<string, unknown>;

    if (!r.uri || typeof r.uri !== 'string' || r.uri.trim().length === 0) {
      throw new ValidationError('uri must be a non-empty string', 'uri');
    }

    if (!r.name || typeof r.name !== 'string' || r.name.trim().length === 0) {
      throw new ValidationError('name must be a non-empty string', 'name');
    }

    if (r.description !== undefined && typeof r.description !== 'string') {
      throw new ValidationError('description must be a string if provided', 'description');
    }

    if (r.mimeType !== undefined && typeof r.mimeType !== 'string') {
      throw new ValidationError('mimeType must be a string if provided', 'mimeType');
    }

    if (!r.content || (typeof r.content !== 'string' && !(r.content instanceof ArrayBuffer))) {
      throw new ValidationError('content must be a string or ArrayBuffer', 'content');
    }

    return true;
  },

  /**
   * Validates an MCPTool object
   */
  validateMCPTool(tool: unknown): tool is MCPTool {
    if (!tool || typeof tool !== 'object') {
      throw new ValidationError('MCPTool must be an object');
    }

    const t = tool as Record<string, unknown>;

    if (!t.name || typeof t.name !== 'string' || t.name.trim().length === 0) {
      throw new ValidationError('name must be a non-empty string', 'name');
    }

    if (!t.description || typeof t.description !== 'string') {
      throw new ValidationError('description must be a string', 'description');
    }

    if (!t.inputSchema || !this.validateJSONSchema(t.inputSchema)) {
      throw new ValidationError('inputSchema must be a valid JSONSchema', 'inputSchema');
    }

    if (typeof t.handler !== 'function') {
      throw new ValidationError('handler must be a function', 'handler');
    }

    return true;
  },

  /**
   * Validates an MCPPrompt object
   */
  validateMCPPrompt(prompt: unknown): prompt is MCPPrompt {
    if (!prompt || typeof prompt !== 'object') {
      throw new ValidationError('MCPPrompt must be an object');
    }

    const p = prompt as Record<string, unknown>;

    if (!p.name || typeof p.name !== 'string' || p.name.trim().length === 0) {
      throw new ValidationError('name must be a non-empty string', 'name');
    }

    if (!p.template || typeof p.template !== 'string' || p.template.trim().length === 0) {
      throw new ValidationError('template must be a non-empty string', 'template');
    }

    if (p.variables !== undefined) {
      if (!Array.isArray(p.variables)) {
        throw new ValidationError('variables must be an array if provided', 'variables');
      }

      for (let i = 0; i < p.variables.length; i++) {
        if (!this.validateMCPPromptVariable(p.variables[i])) {
          throw new ValidationError(`Invalid variable at index ${i}`, 'variables');
        }
      }
    }

    return true;
  },

  /**
   * Validates an MCPPromptVariable object
   */
  validateMCPPromptVariable(variable: unknown): variable is MCPPromptVariable {
    if (!variable || typeof variable !== 'object') {
      throw new ValidationError('MCPPromptVariable must be an object');
    }

    const v = variable as Record<string, unknown>;

    if (!v.name || typeof v.name !== 'string' || v.name.trim().length === 0) {
      throw new ValidationError('name must be a non-empty string', 'name');
    }

    const validTypes = ['string', 'number', 'boolean', 'object', 'array'];
    if (!v.type || validTypes.indexOf(v.type as string) === -1) {
      throw new ValidationError('type must be one of: string, number, boolean, object, array', 'type');
    }

    if (v.required !== undefined && typeof v.required !== 'boolean') {
      throw new ValidationError('required must be a boolean if provided', 'required');
    }

    return true;
  },

  /**
   * Validates an MCPMetadata object
   */
  validateMCPMetadata(metadata: unknown): metadata is MCPMetadata {
    if (!metadata || typeof metadata !== 'object') {
      throw new ValidationError('MCPMetadata must be an object');
    }

    const m = metadata as Record<string, unknown>;

    if (!m.version || typeof m.version !== 'string' || m.version.trim().length === 0) {
      throw new ValidationError('version must be a non-empty string', 'version');
    }

    if (!(m.timestamp instanceof Date) && typeof m.timestamp !== 'string') {
      throw new ValidationError('timestamp must be a Date or ISO string', 'timestamp');
    }

    if (!m.source || typeof m.source !== 'string' || m.source.trim().length === 0) {
      throw new ValidationError('source must be a non-empty string', 'source');
    }

    if (!Array.isArray(m.capabilities)) {
      throw new ValidationError('capabilities must be an array', 'capabilities');
    }

    for (let i = 0; i < m.capabilities.length; i++) {
      if (!this.validateMCPCapability(m.capabilities[i])) {
        throw new ValidationError(`Invalid capability at index ${i}`, 'capabilities');
      }
    }

    return true;
  },

  /**
   * Validates an MCPCapability object
   */
  validateMCPCapability(capability: unknown): capability is MCPCapability {
    if (!capability || typeof capability !== 'object') {
      throw new ValidationError('MCPCapability must be an object');
    }

    const c = capability as Record<string, unknown>;

    if (!c.name || typeof c.name !== 'string' || c.name.trim().length === 0) {
      throw new ValidationError('name must be a non-empty string', 'name');
    }

    if (!c.version || typeof c.version !== 'string' || c.version.trim().length === 0) {
      throw new ValidationError('version must be a non-empty string', 'version');
    }

    if (typeof c.enabled !== 'boolean') {
      throw new ValidationError('enabled must be a boolean', 'enabled');
    }

    return true;
  },

  /**
   * Validates a JSONSchema object
   */
  validateJSONSchema(schema: unknown): schema is JSONSchema {
    if (!schema || typeof schema !== 'object') {
      throw new ValidationError('JSONSchema must be an object');
    }

    const s = schema as Record<string, unknown>;

    if (!s.type || typeof s.type !== 'string') {
      throw new ValidationError('type must be a string', 'type');
    }

    const validTypes = ['string', 'number', 'integer', 'boolean', 'object', 'array', 'null'];
    if (validTypes.indexOf(s.type as string) === -1) {
      throw new ValidationError('type must be a valid JSON Schema type', 'type');
    }

    return true;
  }
};

// ============================================================================
// MCP (MODEL CONTEXT PROTOCOL) TYPES
// ============================================================================

/**
 * JSON Schema type for MCP tool input validation
 */
export interface JSONSchema {
  type: string;
  properties?: Record<string, JSONSchema>;
  required?: string[];
  items?: JSONSchema;
  enum?: unknown[];
  description?: string;
  default?: unknown;
}

/**
 * MCP Resource represents external data or content that can be referenced
 */
export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
  content: string | ArrayBuffer;
  metadata?: Record<string, unknown>;
  lastModified?: Date;
  size?: number;
}

/**
 * MCP Tool represents a callable function with structured input/output
 */
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: JSONSchema;
  handler: (args: unknown) => Promise<unknown>;
  metadata?: Record<string, unknown>;
  version?: string;
}

/**
 * MCP Prompt represents a structured prompt template
 */
export interface MCPPrompt {
  name: string;
  description?: string;
  template: string;
  variables?: MCPPromptVariable[];
  metadata?: Record<string, unknown>;
}

/**
 * MCP Prompt Variable defines template variables and their types
 */
export interface MCPPromptVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description?: string;
  required?: boolean;
  default?: unknown;
}

/**
 * MCP Metadata contains structured information about the context
 */
export interface MCPMetadata {
  version: string;
  timestamp: Date;
  source: string;
  capabilities: MCPCapability[];
  extensions?: Record<string, unknown>;
}

/**
 * MCP Capability describes what the context can do
 */
export interface MCPCapability {
  name: string;
  version: string;
  description?: string;
  enabled: boolean;
}

/**
 * Main MCP Context structure that contains all MCP-compliant data
 */
export interface MCPContext {
  resources: MCPResource[];
  tools: MCPTool[];
  prompts: MCPPrompt[];
  metadata: MCPMetadata;
  sessionId?: string;
  parentContext?: string;
}

/**
 * MCP Message format for structured communication
 */
export interface MCPMessage {
  id: string;
  type: 'request' | 'response' | 'notification';
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: MCPError;
  timestamp: Date;
}

/**
 * MCP Error structure for standardized error handling
 */
export interface MCPError {
  code: number;
  message: string;
  data?: unknown;
}

/**
 * MCP Server Configuration for external MCP server connections
 */
export interface MCPServerConfig {
  name: string;
  url: string;
  apiKey?: string;
  timeout?: number;
  retryAttempts?: number;
  enabled: boolean;
  capabilities: string[];
}

/**
 * MCP Context Builder configuration
 */
export interface MCPContextConfig {
  includePageContent: boolean;
  includeUserPreferences: boolean;
  includeTaskHistory: boolean;
  maxResourceSize: number;
  enabledTools: string[];
  serverConfigs: MCPServerConfig[];
}

// ============================================================================
// PROMPT MANAGEMENT TYPES
// ============================================================================

/**
 * Template context for variable injection in custom task prompts
 */
export interface TemplateContext {
  domain: string;
  pageTitle: string;
  selectedText?: string;
  extractedContent: CleanTextContent;
  userInput?: Record<string, unknown>;
  websiteContext: WebsiteContext;
  pageContent: PageContent;
}

/**
 * Clean text content extracted from web pages
 */
export interface CleanTextContent {
  mainText: string;
  headings: TextBlock[];
  paragraphs: TextBlock[];
  lists: ListBlock[];
  metadata: ContentMetadata;
}

/**
 * Text block with context information
 */
export interface TextBlock {
  content: string;
  level?: number;
  context: string;
}

/**
 * List block structure
 */
export interface ListBlock {
  type: 'ordered' | 'unordered';
  items: string[];
  context: string;
}

/**
 * Content metadata for extracted text
 */
export interface ContentMetadata {
  wordCount: number;
  readingTime: number;
  language?: string;
  extractedAt: Date;
  source?: string;
  paragraphCount: number;
  hasStructuredContent: boolean;
}

/**
 * Template validation result
 */
export interface TemplateValidationResult {
  isValid: boolean;
  errors: TemplateValidationError[];
  warnings: string[];
  variables: TemplateVariable[];
}

/**
 * Prompt debugging information for task execution
 */
export interface PromptDebugInfo {
  originalTemplate: string;
  detectedVariables: string[];
  injectedVariables: Record<string, unknown>;
  processingSteps: string[];
  warnings: string[];
  timestamp?: Date;
  executionTime?: number;
}

/**
 * Prompt preview result for testing templates
 */
export interface PromptPreviewResult {
  processedPrompt: string;
  variables: Record<string, string>;
  errors: string[];
  warnings: string[];
  validationResult: TemplateValidationResult;
}

/**
 * Template validation error
 */
export interface TemplateValidationError {
  message: string;
  position?: number;
  variable?: string;
  severity: 'error' | 'warning';
}

/**
 * Template variable definition
 */
export interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object';
  required: boolean;
  description?: string;
  defaultValue?: unknown;
}

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
  },

  isMCPContext(value: unknown): value is MCPContext {
    try {
      return ValidationUtils.validateMCPContext(value);
    } catch {
      return false;
    }
  },

  isMCPResource(value: unknown): value is MCPResource {
    try {
      return ValidationUtils.validateMCPResource(value);
    } catch {
      return false;
    }
  },

  isMCPTool(value: unknown): value is MCPTool {
    try {
      return ValidationUtils.validateMCPTool(value);
    } catch {
      return false;
    }
  },

  isMCPPrompt(value: unknown): value is MCPPrompt {
    try {
      return ValidationUtils.validateMCPPrompt(value);
    } catch {
      return false;
    }
  },

  isMCPMetadata(value: unknown): value is MCPMetadata {
    try {
      return ValidationUtils.validateMCPMetadata(value);
    } catch {
      return false;
    }
  }
};