// MCP (Model Context Protocol) Service for structured context management
import {
  MCPContext,
  MCPResource,
  MCPTool,
  MCPPrompt,
  MCPMetadata,
  MCPCapability,
  MCPContextConfig,
  MCPServerConfig,
  WebsiteContext,
  PageContent,
  UserPreferences,
  CustomTask,
  ValidationUtils
} from '../types/index.js';

/**
 * MCP Service handles creation and management of MCP-compliant contexts
 */
export class MCPService {
  private static instance: MCPService;
  private contextConfig: MCPContextConfig;
  private serverConfigs: MCPServerConfig[] = [];

  private constructor() {
    // Default configuration
    this.contextConfig = {
      includePageContent: true,
      includeUserPreferences: true,
      includeTaskHistory: false,
      maxResourceSize: 1024 * 1024, // 1MB
      enabledTools: ['text-extraction', 'page-analysis', 'task-execution'],
      serverConfigs: []
    };
  }

  public static getInstance(): MCPService {
    if (!MCPService.instance) {
      MCPService.instance = new MCPService();
    }
    return MCPService.instance;
  }

  /**
   * Build MCP context from current page and extension state
   */
  public async buildMCPContext(
    websiteContext: WebsiteContext,
    pageContent?: PageContent,
    userPreferences?: UserPreferences,
    customTasks?: CustomTask[]
  ): Promise<MCPContext> {
    try {
      // Validate input website context first
      ValidationUtils.validateWebsiteContext(websiteContext);
      
      const resources = await this.buildResources(websiteContext, pageContent, userPreferences);
      const tools = await this.buildTools();
      const prompts = await this.buildPrompts(customTasks);
      const metadata = this.buildMetadata();

      const context: MCPContext = {
        resources,
        tools,
        prompts,
        metadata,
        sessionId: this.generateSessionId(),
        parentContext: undefined
      };

      // Validate the context before returning
      ValidationUtils.validateMCPContext(context);
      
      return context;
    } catch (error) {
      console.error('Failed to build MCP context:', error);
      throw new Error(`MCP context building failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Build MCP resources from available data
   */
  private async buildResources(
    websiteContext: WebsiteContext,
    pageContent?: PageContent,
    userPreferences?: UserPreferences
  ): Promise<MCPResource[]> {
    const resources: MCPResource[] = [];

    // Website context resource
    resources.push({
      uri: `mcp://website-context/${websiteContext.domain}`,
      name: 'Website Context',
      description: 'Current website analysis and categorization',
      mimeType: 'application/json',
      content: JSON.stringify(websiteContext),
      metadata: {
        domain: websiteContext.domain,
        category: websiteContext.category,
        securityLevel: websiteContext.securityLevel
      },
      lastModified: websiteContext.timestamp,
      size: JSON.stringify(websiteContext).length
    });

    // Page content resource (if available and enabled)
    if (pageContent && this.contextConfig.includePageContent) {
      const contentSize = JSON.stringify(pageContent).length;
      if (contentSize <= this.contextConfig.maxResourceSize) {
        resources.push({
          uri: `mcp://page-content/${pageContent.url}`,
          name: 'Page Content',
          description: 'Extracted page content and metadata',
          mimeType: 'application/json',
          content: JSON.stringify(pageContent),
          metadata: {
            url: pageContent.url,
            title: pageContent.title,
            extractedAt: pageContent.extractedAt
          },
          lastModified: pageContent.extractedAt,
          size: contentSize
        });
      }
    }

    // User preferences resource (if available and enabled)
    if (userPreferences && this.contextConfig.includeUserPreferences) {
      // Sanitize preferences to remove sensitive data
      const sanitizedPreferences = {
        enabledCategories: userPreferences.enabledCategories,
        customPatterns: userPreferences.customPatterns,
        privacySettings: userPreferences.privacySettings,
        automationPermissions: userPreferences.automationPermissions,
        theme: userPreferences.theme
        // Exclude API keys and sensitive configuration
      };

      resources.push({
        uri: 'mcp://user-preferences',
        name: 'User Preferences',
        description: 'User configuration and preferences',
        mimeType: 'application/json',
        content: JSON.stringify(sanitizedPreferences),
        metadata: {
          sanitized: true,
          excludedFields: ['aiConfig', 'aiConfigurations']
        },
        lastModified: new Date(),
        size: JSON.stringify(sanitizedPreferences).length
      });
    }

    return resources;
  }

  /**
   * Build available MCP tools
   */
  private async buildTools(): Promise<MCPTool[]> {
    const tools: MCPTool[] = [];

    // Text extraction tool
    if (this.contextConfig.enabledTools.includes('text-extraction')) {
      tools.push({
        name: 'extract-text',
        description: 'Extract and clean text content from web pages',
        inputSchema: {
          type: 'object',
          properties: {
            selector: {
              type: 'string',
              description: 'CSS selector for content to extract'
            },
            cleanHtml: {
              type: 'boolean',
              description: 'Whether to remove HTML tags',
              default: true
            }
          },
          required: ['selector']
        },
        handler: async (args: unknown) => {
          // Implementation would be handled by content script
          return { success: true, extracted: true, args };
        },
        metadata: {
          category: 'content-extraction',
          requiresContentScript: true
        }
      });
    }

    // Page analysis tool
    if (this.contextConfig.enabledTools.includes('page-analysis')) {
      tools.push({
        name: 'analyze-page',
        description: 'Analyze current page structure and content',
        inputSchema: {
          type: 'object',
          properties: {
            includeMetadata: {
              type: 'boolean',
              description: 'Include page metadata in analysis',
              default: true
            },
            analyzeForms: {
              type: 'boolean',
              description: 'Analyze form elements on the page',
              default: false
            }
          }
        },
        handler: async (args: unknown) => {
          // Implementation would be handled by pattern engine
          return { success: true, analyzed: true, args };
        },
        metadata: {
          category: 'page-analysis',
          requiresPermissions: ['activeTab']
        }
      });
    }

    // Task execution tool
    if (this.contextConfig.enabledTools.includes('task-execution')) {
      tools.push({
        name: 'execute-task',
        description: 'Execute a custom task with given parameters',
        inputSchema: {
          type: 'object',
          properties: {
            taskId: {
              type: 'string',
              description: 'ID of the task to execute'
            },
            parameters: {
              type: 'object',
              description: 'Task-specific parameters'
            }
          },
          required: ['taskId']
        },
        handler: async (args: unknown) => {
          // Implementation would be handled by task manager
          return { success: true, executed: true, args };
        },
        metadata: {
          category: 'task-management',
          requiresStorage: true
        }
      });
    }

    return tools;
  }

  /**
   * Build MCP prompts from custom tasks
   */
  private async buildPrompts(customTasks?: CustomTask[]): Promise<MCPPrompt[]> {
    const prompts: MCPPrompt[] = [];

    if (customTasks) {
      for (const task of customTasks) {
        prompts.push({
          name: `custom-task-${task.id}`,
          description: task.description,
          template: task.promptTemplate,
          variables: [
            {
              name: 'domain',
              type: 'string',
              description: 'Current website domain',
              required: true
            },
            {
              name: 'pageTitle',
              type: 'string',
              description: 'Current page title',
              required: false
            },
            {
              name: 'selectedText',
              type: 'string',
              description: 'User-selected text content',
              required: false
            },
            {
              name: 'pageContent',
              type: 'string',
              description: 'Extracted page content',
              required: false
            }
          ],
          metadata: {
            taskId: task.id,
            websitePatterns: task.websitePatterns,
            outputFormat: task.outputFormat,
            usageCount: task.usageCount
          }
        });
      }
    }

    // Add default system prompts
    prompts.push({
      name: 'system-analyze-content',
      description: 'Analyze and summarize page content',
      template: 'Analyze the following content from {{domain}}: {{pageContent}}. Provide a concise summary and key insights.',
      variables: [
        {
          name: 'domain',
          type: 'string',
          description: 'Website domain',
          required: true
        },
        {
          name: 'pageContent',
          type: 'string',
          description: 'Page content to analyze',
          required: true
        }
      ],
      metadata: {
        category: 'system',
        builtIn: true
      }
    });

    return prompts;
  }

  /**
   * Build MCP metadata
   */
  private buildMetadata(): MCPMetadata {
    const capabilities: MCPCapability[] = [
      {
        name: 'resource-management',
        version: '1.0.0',
        description: 'Manage and provide structured resources',
        enabled: true
      },
      {
        name: 'tool-execution',
        version: '1.0.0',
        description: 'Execute tools with structured input/output',
        enabled: this.contextConfig.enabledTools.length > 0
      },
      {
        name: 'prompt-templating',
        version: '1.0.0',
        description: 'Process prompt templates with variable injection',
        enabled: true
      },
      {
        name: 'context-chaining',
        version: '1.0.0',
        description: 'Chain contexts for complex workflows',
        enabled: false // Not implemented yet
      }
    ];

    return {
      version: '1.0.0',
      timestamp: new Date(),
      source: 'agentic-chrome-extension',
      capabilities,
      extensions: {
        chromeExtension: true,
        manifestVersion: 3,
        permissions: ['storage', 'activeTab', 'sidePanel']
      }
    };
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `mcp-session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Update MCP context configuration
   */
  public updateConfig(config: Partial<MCPContextConfig>): void {
    this.contextConfig = { ...this.contextConfig, ...config };
  }

  /**
   * Get current MCP context configuration
   */
  public getConfig(): MCPContextConfig {
    return { ...this.contextConfig };
  }

  /**
   * Add MCP server configuration
   */
  public addServerConfig(config: MCPServerConfig): void {
    this.serverConfigs.push(config);
    this.contextConfig.serverConfigs = [...this.serverConfigs];
  }

  /**
   * Remove MCP server configuration
   */
  public removeServerConfig(name: string): void {
    this.serverConfigs = this.serverConfigs.filter(config => config.name !== name);
    this.contextConfig.serverConfigs = [...this.serverConfigs];
  }

  /**
   * Get available MCP servers
   */
  public getServerConfigs(): MCPServerConfig[] {
    return [...this.serverConfigs];
  }

  /**
   * Validate MCP context structure
   */
  public validateContext(context: unknown): boolean {
    try {
      return ValidationUtils.validateMCPContext(context);
    } catch (error) {
      console.error('MCP context validation failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const mcpService = MCPService.getInstance();