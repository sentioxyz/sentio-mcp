import { createClient } from "@hey-api/client-fetch";
import { FastMCP } from "fastmcp";
import { z } from "zod";
import { registerWebTools } from "./tools/web_tools.js";
import { registerDataTools } from "./tools/data_tools.js";
import { registerPriceTools } from "./tools/price_tools.js";
import { registerAlertsTools } from "./tools/alerts_tools.js";
import { registerProcessorTools } from "./tools/processor_tools.js";

// Create an adapter object to bridge between FastMCP and McpServer interfaces
class ServerAdapter<T extends Record<string, unknown> | undefined> {
    private server: FastMCP<T>;

    constructor(server: FastMCP<T>) {
        this.server = server;
    }

    // Implement the `tool` method used by the tools
    tool(name: string, description: string, parameters: any, execute: any) {
        this.server.addTool({
            name: name,
            description: description,
            parameters: z.object(parameters),
            execute: async (args: any, context: any) => {
                return await execute(args);
            }
        });
    }
}

function decodeJWT(token: string) {
    const parts = token.split('.');
    const json = Buffer.from(parts[1], 'base64').toString();
    return JSON.parse(json);
}

export async function runServe(options: any) {
    const port = options.port || 3000;

    // Create FastMCP server instance
    const server = new FastMCP({
        name: "Sentio MCP Server",
        version: "1.0.0",
        authenticate: async (request) => {
            // Extract auth from headers
            const authHeader = request.headers["authorization"];
            const apiKeyHeader = request.headers["api-key"];
            if (authHeader) {
                // JWT authentication
                const { sub } = decodeJWT(authHeader);
                return { sub, token: authHeader };
            } else if (apiKeyHeader) {
                // API Key authentication
                return { sub: apiKeyHeader, apiKey: apiKeyHeader };
            } else if (options.apiKey) {
                // Fallback to options.apiKey
                return { sub: options.apiKey, apiKey: options.apiKey };
            }
            
            throw new Response(null, {
                status: 401,
                statusText: "Unauthorized"
            });
        }
    });

    // Create API client for tools
    const client = createClient({
        baseUrl: options.host || "https://app.sentio.xyz",
    });
    client.interceptors.request.use((request) => {
        if (options.apiKey) {
            request.headers.set("api-key", options.apiKey);
        } else if (options.token) {
            request.headers.set("Authorization", `Bearer ${options.token}`);
        }
        return request;
    });

    // Create an adapter to make the tools work with FastMCP
    const adapter = new ServerAdapter(server);
    
    // Register all tools from tools directory using the adapter
    registerWebTools(adapter as any, client, options);
    registerDataTools(adapter as any, client, options);
    registerPriceTools(adapter as any, client, options);
    registerAlertsTools(adapter as any, client, options);
    registerProcessorTools(adapter as any, client, options);

    // Start the server with HTTP transport
    await server.start({
        transportType: "sse",
        sse: {
            endpoint: "/sse",
            port,
        }
    });

    // Track connections and disconnections
    server.on("connect", (event) => {
        console.log(`Client connected: ${event.session}`);
    });

    console.error(`MCP Server running at http://localhost:${port}`);
}