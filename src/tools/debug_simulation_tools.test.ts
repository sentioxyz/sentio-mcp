import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@hey-api/client-fetch";
import { DebugAndSimulationService } from "@sentio/api";
import { registerDebugSimulationTools } from './debug_simulation_tools.js';
import mockCallTraceResponse from './__mocks__/call_trace_response.json';

describe('Debug Simulation Tools', () => {
  let mockServer: any;
  let mockClient: Client;
  let registeredTool: any;
  let toolCallCount: number;
  let getCallTraceSpy: any;

  beforeEach(() => {
    toolCallCount = 0;

    // Create a mock server that captures tool registrations
    mockServer = {
      tool: (name: any, description: any, schema: any, handler: any) => {
        toolCallCount++;
        registeredTool = { name, description, schema, handler };
      }
    } as unknown as McpServer;

    // Create a mock client
    mockClient = {} as Client;

    // Mock the API service method
    getCallTraceSpy = (DebugAndSimulationService.getCallTraceByTransaction as any) = function(this: any, ...args: any[]) {
      return getCallTraceSpy._mockReturnValue || Promise.resolve({ data: mockCallTraceResponse, error: null });
    };
    getCallTraceSpy.mockResolvedValue = (value: any) => {
      getCallTraceSpy._mockReturnValue = Promise.resolve(value);
      return getCallTraceSpy;
    };
    getCallTraceSpy._calls = [];

    // Register the tools
    registerDebugSimulationTools(mockServer, mockClient, {});
  });

  describe('exploreCallTrace - Root Level', () => {
    it('should fetch and return root call', async () => {
      getCallTraceSpy.mockResolvedValue({ data: mockCallTraceResponse, error: null });

      const result = await registeredTool.handler({
        owner: 'test-owner',
        slug: 'test-slug',
        chainId: '1',
        txHash: '0x123',
        callPath: 'root'
      });

      const content = JSON.parse(result.content[0].text);

      // The root should have the top-level structure
      expect(content.calls).toBeDefined();
      expect(Array.isArray(content.calls)).toBe(true);
      expect(content.calls).toHaveLength(2);
    });

    it('should default to root when callPath is not provided', async () => {
      getCallTraceSpy.mockResolvedValue({ data: mockCallTraceResponse, error: null });

      const result = await registeredTool.handler({
        owner: 'test-owner',
        slug: 'test-slug',
        chainId: '1',
        txHash: '0x123'
        // callPath not provided
      });

      const content = JSON.parse(result.content[0].text);

      // Should return root level with calls array
      expect(content.calls).toBeDefined();
      expect(Array.isArray(content.calls)).toBe(true);
    });
  });

  describe('exploreCallTrace - Nested Levels', () => {
    it('should navigate to nested call using path', async () => {
      getCallTraceSpy.mockResolvedValue({ data: mockCallTraceResponse, error: null });

      const result = await registeredTool.handler({
        owner: 'test-owner',
        slug: 'test-slug',
        chainId: '1',
        txHash: '0x123',
        callPath: 'root/dispatch_0'
      });

      const content = JSON.parse(result.content[0].text);
      // First child is dispatch_0
      expect(content.functionName).toBe('dispatch');
      expect(content.type).toBe('JUMP');
      expect(content.calls).toHaveLength(5);
    });

    it('should navigate to deeply nested call', async () => {
      getCallTraceSpy.mockResolvedValue({ data: mockCallTraceResponse, error: null });

      const result = await registeredTool.handler({
        owner: 'test-owner',
        slug: 'test-slug',
        chainId: '1',
        txHash: '0x123',
        callPath: 'root/dispatch_1'
      });

      const content = JSON.parse(result.content[0].text);

      expect(content.functionName).toBe('dispatch');
      expect(content.type).toBe('JUMP');
      expect(Array.isArray(content.calls)).toBe(true);
      expect(content.calls[1].subCallsCount).toBe(3);
    });

    it('should throw error for invalid path', async () => {
      getCallTraceSpy.mockResolvedValue({ data: mockCallTraceResponse, error: null });

      await expect(
        registeredTool.handler({
          owner: 'test-owner',
          slug: 'test-slug',
          chainId: '1',
          txHash: '0x123',
          callPath: 'root/invalid_path'
        })
      ).rejects.toThrow("Call path 'root/invalid_path' not found in trace");
    });

    it('should throw error for non-root starting path', async () => {
      getCallTraceSpy.mockResolvedValue({ data: mockCallTraceResponse, error: null });

      await expect(
        registeredTool.handler({
          owner: 'test-owner',
          slug: 'test-slug',
          chainId: '1',
          txHash: '0x123',
          callPath: 'invalid/transfer_0'
        })
      ).rejects.toThrow("Call path 'invalid/transfer_0' not found in trace");
    });
  });

  describe('exploreCallTrace - Error Handling', () => {
    it('should throw error when API returns error', async () => {
      const apiError = new Error('API Error');
      getCallTraceSpy.mockResolvedValue({ data: null, error: apiError });

      await expect(
        registeredTool.handler({
          owner: 'test-owner',
          slug: 'test-slug',
          chainId: '1',
          txHash: '0x123'
        })
      ).rejects.toThrow('API Error');
    });
  });

  describe('Call Result Structure', () => {
    it('should return the complete call structure with all fields', async () => {
      getCallTraceSpy.mockResolvedValue({ data: mockCallTraceResponse, error: null });

      const result = await registeredTool.handler({
        owner: 'test-owner',
        slug: 'test-slug',
        chainId: '1',
        txHash: '0x123',
        callPath: 'root'
      });

      const content = JSON.parse(result.content[0].text);

      expect(content).toHaveProperty('calls');
      expect(Array.isArray(content.calls)).toBe(true);
    });

    it('should include nested calls array', async () => {
      getCallTraceSpy.mockResolvedValue({ data: mockCallTraceResponse, error: null });

      const result = await registeredTool.handler({
        owner: 'test-owner',
        slug: 'test-slug',
        chainId: '1',
        txHash: '0x123',
        callPath: 'root'
      });

      const content = JSON.parse(result.content[0].text);

      expect(Array.isArray(content.calls)).toBe(true);
      expect(content.calls.length).toBeGreaterThan(0);
    });
  });
});
