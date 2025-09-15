// MCP Server Manager for handling external MCP server connections
import {
  MCPServerConfig,
  MCPTool,
  MCPResource,
  MCPContext,
  UserPreferences,
  ValidationUtils
} from '../types/index.js';
import { ChromeStorageService } from './storage.js';

/**
 * Connection status for MCP servers
 */
export enum MCPServerStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error'
}

/**
 * MCP Server connection information
 */
export interface MCPServerConnection {
  config: MCPServerConfig;
  status: MCPServerStatus;
  lastConnected?: Date;
  lastError?: string;
  availableTools: MCPTool[];
  availableResources: MCPResource[];
}

/**
 * MCP Tool execution result
 */
export interface MCPToolResult {
  success: boolean;
  result?: unknown;
  error?: string;
  executionTime: number;
}

/**
 * MCP Server Manager handles connections to external MCP servers
 */
export class MCPServerManager {
  private static instance: MCPServerManager;
  private storageService: ChromeStorageService;
  private connections: Map<string, MCPServerConnection> = new Map();
  private discoveryInterval?: number;

  private constructor() {
    this.storageService = new ChromeStorageService();
  }

  public static getInstance(): MCPServerManager {
    if (!MCPServerManager.instance) {
      MCPServerManager.instance = new MCPServerManager();
    }
    return MCPServerManager.instance;
  }

  /**
   * Initialize the MCP server manager
   */
  public async initialize(): Promise<void> {
    try {
      await this.storageService.initialize();
      await this.loadServerConfigurations();
      await this.startServerDiscovery();
    } catch (error) {
      console.error('Failed to initialize MCP Server Manager:', error);
      throw error;
    }
  }

  /**
   * Load server configurations from user preferences
   */
  private async loadServerConfigurations(): Promise<void> {
    try {
      const preferences = await this.storageService.getUserPreferences();
      const serverConfigs = preferences?.mcpServers || [];

      // Initialize connections for all configured servers
      for (const config of serverConfigs) {
        if (config.enabled) {
          await this.addServerConnection(config);
        }
      }
    } catch (error) {
      console.error('Failed to load MCP server configurations:', error);
    }
  }

  /**
   * Add a new MCP server connection
   */
  public async addServerConnection(config: MCPServerConfig): Promise<void> {
    try {
      // Validate server configuration
      this.validateServerConfig(config);

      const connection: MCPServerConnection = {
        config,
        status: MCPServerStatus.DISCONNECTED,
        availableTools: [],
        availableResources: []
      };

      this.connections.set(config.name, connection);

      // Attempt to connect if enabled
      if (config.enabled) {
        await this.connectToServer(config.name);
      }
    } catch (error) {
      console.error(`Failed to add MCP server connection for ${config.name}:`, error);
      throw error;
    }
  }

  /**
   * Remove an MCP server connection
   */
  public async removeServerConnection(serverName: string): Promise<void> {
    try {
      const connection = this.connections.get(serverName);
      if (connection) {
        // Disconnect if connected
        if (connection.status === MCPServerStatus.CONNECTED) {
          await this.disconnectFromServer(serverName);
        }

        this.connections.delete(serverName);
      }
    } catch (error) {
      console.error(`Failed to remove MCP server connection for ${serverName}:`, error);
    }
  }

  /**
   * Connect to an MCP server
   */
  public async connectToServer(serverName: string): Promise<void> {
    const connection = this.connections.get(serverName);
    if (!connection) {
      throw new Error(`MCP server ${serverName} not found`);
    }

    try {
      connection.status = MCPServerStatus.CONNECTING;
      this.connections.set(serverName, connection);

      // Simulate connection process (in real implementation, this would use WebSocket or HTTP)
      const isConnected = await this.attemptServerConnection(connection.config);

      if (isConnected) {
        connection.status = MCPServerStatus.CONNECTED;
        connection.lastConnected = new Date();
        connection.lastError = undefined;

        // Discover available tools and resources
        await this.discoverServerCapabilities(serverName);
      } else {
        throw new Error('Failed to establish connection');
      }
    } catch (error) {
      connection.status = MCPServerStatus.ERROR;
      connection.lastError = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Failed to connect to MCP server ${serverName}:`, error);
      throw error;
    } finally {
      this.connections.set(serverName, connection);
    }
  }

  /**
   * Disconnect from an MCP server
   */
  public async disconnectFromServer(serverName: string): Promise<void> {
    const connection = this.connections.get(serverName);
    if (!connection) {
      return;
    }

    try {
      // Perform cleanup and disconnection
      connection.status = MCPServerStatus.DISCONNECTED;
      connection.availableTools = [];
      connection.availableResources = [];
      this.connections.set(serverName, connection);
    } catch (error) {
      console.error(`Failed to disconnect from MCP server ${serverName}:`, error);
    }
  }

  /**
   * Attempt to connect to an MCP server
   */
  private async attemptServerConnection(config: MCPServerConfig): Promise<boolean> {
    try {
      // Create connection timeout
      const timeout = config.timeout || 5000;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        // Attempt to connect to the server
        const response = await fetch(`${config.url}/health`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(config.apiKey && { 'Authorization': `Bearer ${config.apiKey}` })
          },
          signal: controller.signal
        });

        clearTimeout(timeoutId);
        return response.ok;
      } catch (error) {
        clearTimeout(timeoutId);
        
        // If it's an abort error, it's a timeout
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error(`Connection timeout after ${timeout}ms`);
        }
        
        throw error;
      }
    } catch (error) {
      console.error('MCP server connection attempt failed:', error);
      return false;
    }
  }

  /**
   * Discover server capabilities (tools and resources)
   */
  private async discoverServerCapabilities(serverName: string): Promise<void> {
    const connection = this.connections.get(serverName);
    if (!connection || connection.status !== MCPServerStatus.CONNECTED) {
      return;
    }

    try {
      // Discover available tools
      const tools = await this.discoverServerTools(connection.config);
      connection.availableTools = tools;

      // Discover available resources
      const resources = await this.discoverServerResources(connection.config);
      connection.availableResources = resources;

      this.connections.set(serverName, connection);
    } catch (error) {
      console.error(`Failed to discover capabilities for ${serverName}:`, error);
    }
  }

  /**
   * Discover available tools from MCP server
   */
  private async discoverServerTools(config: MCPServerConfig): Promise<MCPTool[]> {
    try {
      const response = await fetch(`${config.url}/tools`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(config.apiKey && { 'Authorization': `Bearer ${config.apiKey}` })
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to discover tools: ${response.statusText}`);
      }

      const data = await response.json();
      return data.tools || [];
    } catch (error) {
      console.error('Failed to discover server tools:', error);
      return [];
    }
  }

  /**
   * Discover available resources from MCP server
   */
  private async discoverServerResources(config: MCPServerConfig): Promise<MCPResource[]> {
    try {
      const response = await fetch(`${config.url}/resources`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(config.apiKey && { 'Authorization': `Bearer ${config.apiKey}` })
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to discover resources: ${response.statusText}`);
      }

      const data = await response.json();
      return data.resources || [];
    } catch (error) {
      console.error('Failed to discover server resources:', error);
      return [];
    }
  }

  /**
   * Execute a tool on an MCP server
   */
  public async executeTool(
    serverName: string,
    toolName: string,
    args: Record<string, unknown>,
    context?: MCPContext
  ): Promise<MCPToolResult> {
    const startTime = Date.now();
    
    try {
      const connection = this.connections.get(serverName);
      if (!connection) {
        throw new Error(`MCP server ${serverName} not found`);
      }

      if (connection.status !== MCPServerStatus.CONNECTED) {
        throw new Error(`MCP server ${serverName} is not connected`);
      }

      // Find the tool
      const tool = connection.availableTools.find(t => t.name === toolName);
      if (!tool) {
        throw new Error(`Tool ${toolName} not found on server ${serverName}`);
      }

      // Execute the tool
      const result = await this.executeServerTool(connection.config, toolName, args, context);
      
      return {
        success: true,
        result,
        executionTime: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Execute a tool on the MCP server
   */
  private async executeServerTool(
    config: MCPServerConfig,
    toolName: string,
    args: Record<string, unknown>,
    context?: MCPContext
  ): Promise<unknown> {
    const response = await fetch(`${config.url}/tools/${toolName}/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey && { 'Authorization': `Bearer ${config.apiKey}` })
      },
      body: JSON.stringify({
        args,
        context: context ? this.sanitizeContextForTransmission(context) : undefined
      })
    });

    if (!response.ok) {
      throw new Error(`Tool execution failed: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Get all available tools from connected servers
   */
  public getAllAvailableTools(): MCPTool[] {
    const allTools: MCPTool[] = [];
    
    for (const connection of this.connections.values()) {
      if (connection.status === MCPServerStatus.CONNECTED) {
        allTools.push(...connection.availableTools);
      }
    }

    return allTools;
  }

  /**
   * Get all available resources from connected servers
   */
  public getAllAvailableResources(): MCPResource[] {
    const allResources: MCPResource[] = [];
    
    for (const connection of this.connections.values()) {
      if (connection.status === MCPServerStatus.CONNECTED) {
        allResources.push(...connection.availableResources);
      }
    }

    return allResources;
  }

  /**
   * Get server connection status
   */
  public getServerStatus(serverName: string): MCPServerStatus {
    const connection = this.connections.get(serverName);
    return connection?.status || MCPServerStatus.DISCONNECTED;
  }

  /**
   * Get all server connections
   */
  public getAllConnections(): MCPServerConnection[] {
    return Array.from(this.connections.values());
  }

  /**
   * Start automatic server discovery and health checks
   */
  private async startServerDiscovery(): Promise<void> {
    // Check server health every 30 seconds
    this.discoveryInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, 30000);
  }

  /**
   * Stop automatic server discovery
   */
  public stopServerDiscovery(): void {
    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval);
      this.discoveryInterval = undefined;
    }
  }

  /**
   * Perform health checks on all connected servers
   */
  private async performHealthChecks(): Promise<void> {
    for (const [serverName, connection] of this.connections.entries()) {
      if (connection.status === MCPServerStatus.CONNECTED) {
        try {
          const isHealthy = await this.attemptServerConnection(connection.config);
          if (!isHealthy) {
            connection.status = MCPServerStatus.ERROR;
            connection.lastError = 'Health check failed';
            this.connections.set(serverName, connection);
          }
        } catch (error) {
          connection.status = MCPServerStatus.ERROR;
          connection.lastError = error instanceof Error ? error.message : 'Health check error';
          this.connections.set(serverName, connection);
        }
      }
    }
  }

  /**
   * Validate MCP server configuration
   */
  private validateServerConfig(config: MCPServerConfig): void {
    if (!config.name || typeof config.name !== 'string') {
      throw new Error('Server name is required and must be a string');
    }

    if (!config.url || typeof config.url !== 'string') {
      throw new Error('Server URL is required and must be a string');
    }

    try {
      new URL(config.url);
    } catch (error) {
      throw new Error('Server URL must be a valid URL');
    }

    if (config.timeout && (typeof config.timeout !== 'number' || config.timeout < 0)) {
      throw new Error('Timeout must be a positive number');
    }

    if (config.retryAttempts && (typeof config.retryAttempts !== 'number' || config.retryAttempts < 0)) {
      throw new Error('Retry attempts must be a positive number');
    }

    if (!Array.isArray(config.capabilities)) {
      throw new Error('Capabilities must be an array');
    }
  }

  /**
   * Sanitize MCP context for transmission to external servers
   */
  private sanitizeContextForTransmission(context: MCPContext): Partial<MCPContext> {
    return {
      resources: context.resources.map(resource => ({
        ...resource,
        // Limit content size for transmission
        content: typeof resource.content === 'string' && resource.content.length > 10000
          ? resource.content.substring(0, 10000) + '...[truncated]'
          : resource.content
      })),
      tools: [], // Don't send tools to external servers
      prompts: [], // Don't send prompts to external servers
      metadata: {
        ...context.metadata,
        // Remove sensitive extensions data
        extensions: undefined
      },
      sessionId: context.sessionId
    };
  }

  /**
   * Update server configuration
   */
  public async updateServerConfig(serverName: string, updates: Partial<MCPServerConfig>): Promise<void> {
    try {
      const preferences = await this.storageService.getUserPreferences();
      if (!preferences?.mcpServers) {
        throw new Error('No MCP servers configured');
      }

      const serverIndex = preferences.mcpServers.findIndex(s => s.name === serverName);
      if (serverIndex === -1) {
        throw new Error(`Server ${serverName} not found`);
      }

      // Update the configuration
      const updatedConfig = { ...preferences.mcpServers[serverIndex], ...updates };
      preferences.mcpServers[serverIndex] = updatedConfig;

      // Save to storage
      await this.storageService.updateUserPreferences(preferences);

      // Update the connection
      const connection = this.connections.get(serverName);
      if (connection) {
        connection.config = updatedConfig;
        this.connections.set(serverName, connection);

        // Reconnect if the server was connected and is still enabled
        if (connection.status === MCPServerStatus.CONNECTED && updatedConfig.enabled) {
          await this.disconnectFromServer(serverName);
          await this.connectToServer(serverName);
        } else if (!updatedConfig.enabled) {
          await this.disconnectFromServer(serverName);
        }
      }
    } catch (error) {
      console.error(`Failed to update server config for ${serverName}:`, error);
      throw error;
    }
  }

  /**
   * Get fallback suggestions when MCP servers are unavailable
   */
  public getFallbackSuggestions(): string[] {
    return [
      'Analyze page content',
      'Extract key information',
      'Summarize main points',
      'Generate action items',
      'Create task list'
    ];
  }

  /**
   * Cleanup resources
   */
  public cleanup(): void {
    this.stopServerDiscovery();
    
    // Disconnect all servers
    for (const serverName of this.connections.keys()) {
      this.disconnectFromServer(serverName).catch(console.error);
    }
    
    this.connections.clear();
  }
}

// Export singleton instance
export const mcpServerManager = MCPServerManager.getInstance();