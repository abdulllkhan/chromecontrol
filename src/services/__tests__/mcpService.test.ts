// Tests for MCP Service
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MCPService } from '../mcpService.js';
import {
  WebsiteContext,
  WebsiteCategory,
  PageType,
  SecurityLevel,
  PageContent,
  UserPreferences,
  CustomTask,
  OutputFormat,
  MCPContext,
  MCPContextConfig
} from '../../types/index.js';

describe('MCPService', () => {
  let mcpService: MCPService;
  let mockWebsiteContext: WebsiteContext;
  let mockPageContent: PageContent;
  let mockUserPreferences: UserPreferences;
  let mockCustomTasks: CustomTask[];

  beforeEach(() => {
    mcpService = MCPService.getInstance();
    
    mockWebsiteContext = {
      domain: 'example.com',
      category: WebsiteCategory.PRODUCTIVITY,
      pageType: PageType.ARTICLE,
      extractedData: { title: 'Test Article' },
      securityLevel: SecurityLevel.PUBLIC,
      timestamp: new Date()
    };

    mockPageContent = {
      url: 'https://example.com/article',
      title: 'Test Article',
      headings: ['Introduction', 'Main Content'],
      textContent: 'This is test content for the article.',
      forms: [],
      links: [],
      metadata: { author: 'Test Author' },
      extractedAt: new Date()
    };

    mockUserPreferences = {
      enabledCategories: [WebsiteCategory.PRODUCTIVITY],
      customPatterns: [],
      privacySettings: {
        sharePageContent: true,
        shareFormData: false,
        allowAutomation: true,
        securityLevel: SecurityLevel.PUBLIC,
        excludedDomains: []
      },
      automationPermissions: {},
      aiProvider: 'openai',
      theme: 'light'
    };

    mockCustomTasks = [
      {
        id: 'test-task-1',
        name: 'Test Task',
        description: 'A test task for MCP',
        websitePatterns: ['example.com'],
        promptTemplate: 'Analyze {{domain}} content: {{pageContent}}',
        outputFormat: OutputFormat.MARKDOWN,
        automationSteps: [],
        usageCount: 5,
        isEnabled: true,
        tags: ['test', 'mcp']
      }
    ];
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = MCPService.getInstance();
      const instance2 = MCPService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('buildMCPContext', () => {
    it('should build a valid MCP context with all components', async () => {
      const context = await mcpService.buildMCPContext(
        mockWebsiteContext,
        mockPageContent,
        mockUserPreferences,
        mockCustomTasks
      );

      expect(context).toBeDefined();
      expect(context.resources).toBeDefined();
      expect(context.tools).toBeDefined();
      expect(context.prompts).toBeDefined();
      expect(context.metadata).toBeDefined();
      expect(context.sessionId).toBeDefined();
    });

    it('should include website context resource', async () => {
      const context = await mcpService.buildMCPContext(mockWebsiteContext);

      const websiteResource = context.resources.find(r => 
        r.name === 'Website Context'
      );
      
      expect(websiteResource).toBeDefined();
      expect(websiteResource?.uri).toContain('website-context');
      expect(websiteResource?.content).toContain('example.com');
    });

    it('should include page content resource when provided', async () => {
      const context = await mcpService.buildMCPContext(
        mockWebsiteContext,
        mockPageContent
      );

      const pageResource = context.resources.find(r => 
        r.name === 'Page Content'
      );
      
      expect(pageResource).toBeDefined();
      expect(pageResource?.uri).toContain('page-content');
      expect(pageResource?.content).toContain('Test Article');
    });

    it('should include user preferences resource when provided', async () => {
      const context = await mcpService.buildMCPContext(
        mockWebsiteContext,
        undefined,
        mockUserPreferences
      );

      const prefsResource = context.resources.find(r => 
        r.name === 'User Preferences'
      );
      
      expect(prefsResource).toBeDefined();
      expect(prefsResource?.uri).toBe('mcp://user-preferences');
    });

    it('should include custom task prompts', async () => {
      const context = await mcpService.buildMCPContext(
        mockWebsiteContext,
        undefined,
        undefined,
        mockCustomTasks
      );

      const customPrompt = context.prompts.find(p => 
        p.name === 'custom-task-test-task-1'
      );
      
      expect(customPrompt).toBeDefined();
      expect(customPrompt?.template).toBe('Analyze {{domain}} content: {{pageContent}}');
      expect(customPrompt?.variables).toBeDefined();
    });

    it('should include default tools', async () => {
      const context = await mcpService.buildMCPContext(mockWebsiteContext);

      expect(context.tools.length).toBeGreaterThan(0);
      
      const extractTool = context.tools.find(t => t.name === 'extract-text');
      expect(extractTool).toBeDefined();
      
      const analyzeTool = context.tools.find(t => t.name === 'analyze-page');
      expect(analyzeTool).toBeDefined();
      
      const executeTool = context.tools.find(t => t.name === 'execute-task');
      expect(executeTool).toBeDefined();
    });

    it('should include system prompts', async () => {
      const context = await mcpService.buildMCPContext(mockWebsiteContext);

      const systemPrompt = context.prompts.find(p => 
        p.name === 'system-analyze-content'
      );
      
      expect(systemPrompt).toBeDefined();
      expect(systemPrompt?.template).toContain('{{domain}}');
      expect(systemPrompt?.template).toContain('{{pageContent}}');
    });

    it('should generate valid metadata', async () => {
      const context = await mcpService.buildMCPContext(mockWebsiteContext);

      expect(context.metadata.version).toBe('1.0.0');
      expect(context.metadata.source).toBe('agentic-chrome-extension');
      expect(context.metadata.capabilities).toBeDefined();
      expect(context.metadata.capabilities.length).toBeGreaterThan(0);
      expect(context.metadata.timestamp).toBeInstanceOf(Date);
    });

    it('should handle errors gracefully', async () => {
      // Test with invalid website context
      const invalidContext = {} as WebsiteContext;
      
      await expect(
        mcpService.buildMCPContext(invalidContext)
      ).rejects.toThrow();
    });
  });

  describe('Configuration Management', () => {
    it('should update configuration', () => {
      const newConfig: Partial<MCPContextConfig> = {
        includePageContent: false,
        maxResourceSize: 500000
      };

      mcpService.updateConfig(newConfig);
      const config = mcpService.getConfig();

      expect(config.includePageContent).toBe(false);
      expect(config.maxResourceSize).toBe(500000);
    });

    it('should manage server configurations', () => {
      const serverConfig = {
        name: 'test-server',
        url: 'http://localhost:3000',
        enabled: true,
        capabilities: ['tool-execution'],
        timeout: 5000,
        retryAttempts: 3
      };

      mcpService.addServerConfig(serverConfig);
      const configs = mcpService.getServerConfigs();
      
      expect(configs).toHaveLength(1);
      expect(configs[0].name).toBe('test-server');

      mcpService.removeServerConfig('test-server');
      const updatedConfigs = mcpService.getServerConfigs();
      
      expect(updatedConfigs).toHaveLength(0);
    });
  });

  describe('Context Validation', () => {
    it('should validate valid MCP context', async () => {
      const context = await mcpService.buildMCPContext(mockWebsiteContext);
      const isValid = mcpService.validateContext(context);
      
      expect(isValid).toBe(true);
    });

    it('should reject invalid MCP context', () => {
      const invalidContext = { invalid: 'context' };
      const isValid = mcpService.validateContext(invalidContext);
      
      expect(isValid).toBe(false);
    });
  });

  describe('Resource Size Limits', () => {
    it('should respect max resource size limits', async () => {
      // Create large page content
      const largeContent: PageContent = {
        ...mockPageContent,
        textContent: 'x'.repeat(2000000) // 2MB of text
      };

      // Set small limit
      mcpService.updateConfig({ maxResourceSize: 1000 });

      const context = await mcpService.buildMCPContext(
        mockWebsiteContext,
        largeContent
      );

      // Should not include the large page content resource
      const pageResource = context.resources.find(r => 
        r.name === 'Page Content'
      );
      
      expect(pageResource).toBeUndefined();
    });
  });

  describe('Tool Configuration', () => {
    it('should respect enabled tools configuration', async () => {
      mcpService.updateConfig({ 
        enabledTools: ['text-extraction'] 
      });

      const context = await mcpService.buildMCPContext(mockWebsiteContext);

      expect(context.tools).toHaveLength(1);
      expect(context.tools[0].name).toBe('extract-text');
    });

    it('should include no tools when none are enabled', async () => {
      mcpService.updateConfig({ 
        enabledTools: [] 
      });

      const context = await mcpService.buildMCPContext(mockWebsiteContext);

      expect(context.tools).toHaveLength(0);
    });
  });

  describe('Session Management', () => {
    it('should generate unique session IDs', async () => {
      const context1 = await mcpService.buildMCPContext(mockWebsiteContext);
      const context2 = await mcpService.buildMCPContext(mockWebsiteContext);

      expect(context1.sessionId).toBeDefined();
      expect(context2.sessionId).toBeDefined();
      expect(context1.sessionId).not.toBe(context2.sessionId);
    });

    it('should include session ID in proper format', async () => {
      const context = await mcpService.buildMCPContext(mockWebsiteContext);

      expect(context.sessionId).toMatch(/^mcp-session-\d+-[a-z0-9]+$/);
    });
  });
});