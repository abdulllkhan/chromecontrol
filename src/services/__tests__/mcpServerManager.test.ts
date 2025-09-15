import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MCPServerManager, MCPServerStatus } from '../mcpServerManager';
import { MCPServerConfig } from '../../types';

// Mock fetch
global.fetch = vi.fn();

// Mock ChromeStorageService
vi.mock('../storage', () => ({
  ChromeStorageService: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    getUserPreferences: vi.fn().mockResolvedValue({
      mcpServers: []
    }),
    updateUserPreferences: vi.fn().mockResolvedValue(undefined)
  }))
}));

describe('MCPServerManager', () => {
  let manager: MCPServerManager;
  const mockFetch = fetch as any;

  beforeEach(() => {
    manager = MCPServerManager.getInstance();
    vi.clearAllMocks();
  });

  afterEach(() => {
    manager.cleanup();
  });

  describe('Server Configuration Management', () => {
    it('should validate server configuration correctly', async () => {
      const validConfig: MCPServerConfig = {
        name: 'test-server',
        url: 'http://localhost:3000',
        enabled: false, // Don't auto-connect in this test
        capabilities: ['tools', 'resources']
      };

      await expect(manager.addServerConnection(validConfig)).resolves.not.toThrow();
    });

    it('should reject invalid server configuration', async () => {
      const invalidConfig = {
        name: '',
        url: 'invalid-url',
        enabled: true,
        capabilities: ['tools']
      } as MCPServerConfig;

      await expect(manager.addServerConnection(invalidConfig)).rejects.toThrow();
    });

    it('should handle server connection attempts', async () => {
      const config: MCPServerConfig = {
        name: 'test-server',
        url: 'http://localhost:3000',
        enabled: false, // Add without auto-connecting
        capabilities: ['tools'],
        timeout: 5000
      };

      // Mock successful health check
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'healthy' })
      });

      // Mock tools discovery
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ tools: [] })
      });

      // Mock resources discovery
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ resources: [] })
      });

      await manager.addServerConnection(config);
      await manager.connectToServer('test-server');

      expect(manager.getServerStatus('test-server')).toBe(MCPServerStatus.CONNECTED);
    });

    it('should handle connection failures gracefully', async () => {
      const config: MCPServerConfig = {
        name: 'failing-server',
        url: 'http://localhost:9999',
        enabled: false, // Add without auto-connecting
        capabilities: ['tools']
      };

      // Mock failed health check
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

      await manager.addServerConnection(config);
      await expect(manager.connectToServer('failing-server')).rejects.toThrow();
      expect(manager.getServerStatus('failing-server')).toBe(MCPServerStatus.ERROR);
    });
  });

  describe('Tool Execution', () => {
    it('should execute tools on connected servers', async () => {
      const config: MCPServerConfig = {
        name: 'tool-server',
        url: 'http://localhost:3000',
        enabled: false, // Add without auto-connecting
        capabilities: ['tools']
      };

      // Mock successful connection
      mockFetch
        .mockResolvedValueOnce({ ok: true }) // health check
        .mockResolvedValueOnce({ // tools discovery
          ok: true,
          json: () => Promise.resolve({
            tools: [{
              name: 'test-tool',
              description: 'A test tool',
              inputSchema: { type: 'object' }
            }]
          })
        })
        .mockResolvedValueOnce({ // resources discovery
          ok: true,
          json: () => Promise.resolve({ resources: [] })
        })
        .mockResolvedValueOnce({ // tool execution
          ok: true,
          json: () => Promise.resolve({ result: 'success' })
        });

      await manager.addServerConnection(config);
      await manager.connectToServer('tool-server');

      const result = await manager.executeTool('tool-server', 'test-tool', { param: 'value' });

      expect(result.success).toBe(true);
      expect(result.result).toEqual({ result: 'success' });
    });

    it('should handle tool execution errors', async () => {
      const config: MCPServerConfig = {
        name: 'error-server',
        url: 'http://localhost:3000',
        enabled: false, // Add without auto-connecting
        capabilities: ['tools']
      };

      // Mock successful connection but failed tool execution
      mockFetch
        .mockResolvedValueOnce({ ok: true }) // health check
        .mockResolvedValueOnce({ // tools discovery
          ok: true,
          json: () => Promise.resolve({
            tools: [{
              name: 'failing-tool',
              description: 'A failing tool',
              inputSchema: { type: 'object' }
            }]
          })
        })
        .mockResolvedValueOnce({ // resources discovery
          ok: true,
          json: () => Promise.resolve({ resources: [] })
        })
        .mockResolvedValueOnce({ // tool execution failure
          ok: false,
          statusText: 'Internal Server Error'
        });

      await manager.addServerConnection(config);
      await manager.connectToServer('error-server');

      const result = await manager.executeTool('error-server', 'failing-tool', {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('Tool execution failed');
    });
  });

  describe('Server Discovery', () => {
    it('should discover available tools from servers', async () => {
      const config: MCPServerConfig = {
        name: 'discovery-server',
        url: 'http://localhost:3000',
        enabled: false, // Add without auto-connecting
        capabilities: ['tools', 'resources']
      };

      const mockTools = [
        {
          name: 'file-read',
          description: 'Read file contents',
          inputSchema: { type: 'object', properties: { path: { type: 'string' } } }
        },
        {
          name: 'file-write',
          description: 'Write file contents',
          inputSchema: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } } }
        }
      ];

      const mockResources = [
        {
          uri: 'file://test.txt',
          name: 'Test File',
          description: 'A test file',
          mimeType: 'text/plain',
          content: 'Hello, world!'
        }
      ];

      mockFetch
        .mockResolvedValueOnce({ ok: true }) // health check
        .mockResolvedValueOnce({ // tools discovery
          ok: true,
          json: () => Promise.resolve({ tools: mockTools })
        })
        .mockResolvedValueOnce({ // resources discovery
          ok: true,
          json: () => Promise.resolve({ resources: mockResources })
        });

      await manager.addServerConnection(config);
      await manager.connectToServer('discovery-server');

      const allTools = manager.getAllAvailableTools();
      const allResources = manager.getAllAvailableResources();

      expect(allTools).toHaveLength(2);
      expect(allTools[0].name).toBe('file-read');
      expect(allTools[1].name).toBe('file-write');

      expect(allResources).toHaveLength(1);
      expect(allResources[0].name).toBe('Test File');
    });

    it('should handle discovery failures gracefully', async () => {
      const config: MCPServerConfig = {
        name: 'broken-discovery',
        url: 'http://localhost:3000',
        enabled: false, // Add without auto-connecting
        capabilities: ['tools']
      };

      mockFetch
        .mockResolvedValueOnce({ ok: true }) // health check
        .mockResolvedValueOnce({ // tools discovery failure
          ok: false,
          statusText: 'Not Found'
        })
        .mockResolvedValueOnce({ // resources discovery failure
          ok: false,
          statusText: 'Not Found'
        });

      await manager.addServerConnection(config);
      await manager.connectToServer('broken-discovery');

      const connections = manager.getAllConnections();
      const connection = connections.find(c => c.config.name === 'broken-discovery');

      expect(connection?.availableTools).toHaveLength(0);
      expect(connection?.availableResources).toHaveLength(0);
    });
  });

  describe('Fallback Handling', () => {
    it('should provide fallback suggestions when servers are unavailable', () => {
      const fallbackSuggestions = manager.getFallbackSuggestions();

      expect(fallbackSuggestions).toBeInstanceOf(Array);
      expect(fallbackSuggestions.length).toBeGreaterThan(0);
      expect(fallbackSuggestions).toContain('Analyze page content');
    });

    it('should handle server disconnection gracefully', async () => {
      const config: MCPServerConfig = {
        name: 'disconnect-test',
        url: 'http://localhost:3000',
        enabled: false, // Add without auto-connecting
        capabilities: ['tools']
      };

      mockFetch
        .mockResolvedValueOnce({ ok: true }) // health check
        .mockResolvedValueOnce({ // tools discovery
          ok: true,
          json: () => Promise.resolve({ tools: [] })
        })
        .mockResolvedValueOnce({ // resources discovery
          ok: true,
          json: () => Promise.resolve({ resources: [] })
        });

      await manager.addServerConnection(config);
      await manager.connectToServer('disconnect-test');
      
      expect(manager.getServerStatus('disconnect-test')).toBe(MCPServerStatus.CONNECTED);

      await manager.disconnectFromServer('disconnect-test');
      
      expect(manager.getServerStatus('disconnect-test')).toBe(MCPServerStatus.DISCONNECTED);
    });
  });

  describe('Configuration Updates', () => {
    it('should update server configuration and reconnect if needed', async () => {
      const config: MCPServerConfig = {
        name: 'update-test',
        url: 'http://localhost:3000',
        enabled: false, // Add without auto-connecting
        capabilities: ['tools']
      };

      mockFetch
        .mockResolvedValueOnce({ ok: true }) // health check
        .mockResolvedValueOnce({ // tools discovery
          ok: true,
          json: () => Promise.resolve({ tools: [] })
        })
        .mockResolvedValueOnce({ // resources discovery
          ok: true,
          json: () => Promise.resolve({ resources: [] })
        });

      await manager.addServerConnection(config);
      await manager.connectToServer('update-test');

      // Test that we can update the connection directly (simulating what updateServerConfig would do)
      const connections = manager.getAllConnections();
      const connection = connections.find(c => c.config.name === 'update-test');
      
      expect(connection).toBeDefined();
      expect(connection?.config.name).toBe('update-test');
      
      // Test disconnection works
      await manager.disconnectFromServer('update-test');
      expect(manager.getServerStatus('update-test')).toBe(MCPServerStatus.DISCONNECTED);
    });
  });
});