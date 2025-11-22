import { Client, createClient } from "@hey-api/client-fetch";
import { FastMCP } from "fastmcp";
import { z } from "zod";
import { registerWebTools } from "./tools/web_tools.js";
import { registerDataTools } from "./tools/data_tools.js";
import { registerPriceTools } from "./tools/price_tools.js";
import { registerAlertsTools } from "./tools/alerts_tools.js";
import { registerProcessorTools } from "./tools/processor_tools.js";
import { registerDebugSimulationTools } from "./tools/debug_simulation_tools.js";

// Create an adapter object to bridge between FastMCP and McpServer interfaces
class ServerAdapter<T extends Record<string, unknown> | undefined> {
    private server: FastMCP<T>;
    private client: Client;

    constructor(server: FastMCP<T>, client: Client) {
        this.server = server;
        this.client = client;
    }

    // Implement the `tool` method used by the tools
    tool(name: string, description: string, parameters: any, execute: any) {
        this.server.addTool({
            name: name,
            description: description,
            parameters: z.object(parameters),
            execute: async (args: any, { session }) => {
                console.log(`[serve] Executing tool: ${name}, session:`, {
                    hasToken: !!session?.token,
                    hasApiKey: !!session?.apiKey
                });
                
                this.client.interceptors.request.use((request) => {
                    if (session?.token) {
                        request.headers.set("Authorization", `${session.token}`);
                        console.log(`[serve] Set Authorization from session for tool: ${name}`);
                    } else if (session?.apiKey) {
                        request.headers.set("api-key", `${session.apiKey}`);
                        console.log(`[serve] Set api-key from session for tool: ${name}`);
                    }
                    return request;
                })
                // Pass the context to tools so they can access auth
                try {
                    const result = await execute(args);
                    console.log(`[serve] Tool ${name} executed successfully`);
                    return result;
                } catch (error) {
                    console.error(`[serve] Tool ${name} execution failed:`, error);
                    throw error;
                }
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
    
    console.log("[serve] Starting server with options:", { 
        port, 
        hasApiKey: !!options.apiKey,
        hasToken: !!options.token,
        host: options.host || "https://app.sentio.xyz"
    });

    // Create FastMCP server instance
    const server = new FastMCP({
        name: "Sentio MCP Server",
        version: "1.1.4",
        authenticate: async (request) => {
            console.log("[serve] Authenticating request, headers:", {
                hasAuth: !!request.headers["authorization"],
                hasApiKey: !!request.headers["api-key"],
                hasOptionsApiKey: !!options.apiKey
            });
            
            // Extract auth from headers
            const authHeader = request.headers["authorization"];
            const apiKeyHeader = request.headers["api-key"];
            
            if (authHeader) {
                // JWT authentication
                console.log("[serve] Using JWT authentication");
                const { sub } = decodeJWT(authHeader);
                return { sub, token: authHeader.startsWith('Bearer ') ? authHeader : `Bearer ${authHeader}` };
            } else if (apiKeyHeader) {
                // API Key authentication
                console.log("[serve] Using API Key from header");
                return { sub: apiKeyHeader, apiKey: apiKeyHeader };
            } else if (options.apiKey) {
                // Fallback to options.apiKey
                console.log("[serve] Using API Key from options");
                return { sub: options.apiKey, apiKey: options.apiKey };
            }
            
            console.error("[serve] Authentication failed - no credentials provided");
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
    
    console.log("[serve] Created API client with baseUrl:", options.host || "https://app.sentio.xyz");
    
    // We'll set up the auth interceptor using the context
    client.interceptors.request.use((request, context: any) => {
        console.log("[serve] Request interceptor - setting auth headers");
        if (options.apiKey) {
            request.headers.set("api-key", options.apiKey);
            console.log("[serve] Set api-key header from options");
        } else if (options.token) {
            request.headers.set("Authorization", `Bearer ${options.token}`);
            console.log("[serve] Set Authorization header from options");
        }
        return request;
    });

    // Create an adapter to make the tools work with FastMCP
    const adapter = new ServerAdapter(server, client);
    
    console.log("[serve] Registering tools...");
    // Register all tools from tools directory using the adapter
    registerWebTools(adapter as any, client, options);
    registerDataTools(adapter as any, client, options);
    registerPriceTools(adapter as any, client, options);
    registerAlertsTools(adapter as any, client, options);
    registerProcessorTools(adapter as any, client, options);
    registerDebugSimulationTools(adapter as any, client, options);
    console.log("[serve] All tools registered");

    // Track connections and disconnections
    server.on("connect", (event) => {
        const session = event.session;
        console.log("[serve] Client connected, session:", {
            hasToken: !!(session as any).token,
            hasApiKey: !!(session as any).apiKey,
            roots: session.roots
        });
      
        // Access the current roots
        console.log("Initial roots:", session.roots);
      
        // Listen for changes to the roots
        session.on("rootsChanged", (event) => {
          console.log("Roots changed:", event.roots);
        });
    });

    server.on("disconnect", (event) => {
        console.log(`[serve] Client disconnected: ${event.session}`);
    });

    // Start the server with HTTP transport
    await server.start({
        transportType: "sse",
        sse: {
            endpoint: "/sse",
            port,
        }
    });

    console.error(`MCP Server running at http://localhost:${port}`);
}