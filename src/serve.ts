import { AsyncLocalStorage } from "node:async_hooks";
import { readFileSync } from "node:fs";
import { Client, createClient } from "@hey-api/client-fetch";
import { FastMCP } from "fastmcp";
import { z } from "zod";
import { registerWebTools } from "./tools/web_tools.js";
import { registerDataTools } from "./tools/data_tools.js";
import { registerPriceTools } from "./tools/price_tools.js";
import { registerAlertsTools } from "./tools/alerts_tools.js";
import { registerProcessorTools } from "./tools/processor_tools.js";
import { registerDebugSimulationTools } from "./tools/debug_simulation_tools.js";

export interface SessionAuth {
    token?: string;
    apiKey?: string;
}

// Credentials of the session whose tool call is currently executing. The client is shared by
// all sessions, so auth must be resolved per request rather than by mutating the client.
const sessionAuth = new AsyncLocalStorage<SessionAuth>();

// Install the single auth interceptor on the shared client: the calling session's credentials
// win, and the server's own options are used outside a session (or when it has none).
export function installAuthInterceptor(client: Client, options: any) {
    client.interceptors.request.use((request) => {
        const session = sessionAuth.getStore();
        if (session?.token) {
            request.headers.set("Authorization", session.token);
        } else if (session?.apiKey) {
            request.headers.set("api-key", session.apiKey);
        } else if (options.apiKey) {
            request.headers.set("api-key", options.apiKey);
        } else if (options.token) {
            request.headers.set("Authorization", `Bearer ${options.token}`);
        }
        return request;
    });
}

// Create an adapter object to bridge between FastMCP and McpServer interfaces
export class ServerAdapter<T extends Record<string, unknown> | undefined> {
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
            execute: async (args: any, { session }) => {
                const auth = (session ?? {}) as SessionAuth;
                console.log(`[serve] Executing tool: ${name}, session:`, {
                    hasToken: !!auth.token,
                    hasApiKey: !!auth.apiKey
                });

                try {
                    const result = await sessionAuth.run(
                        { token: auth.token, apiKey: auth.apiKey },
                        () => execute(args)
                    );
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

function packageVersion(): string {
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
    return pkg.version;
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
        version: packageVersion() as `${number}.${number}.${number}`,
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
    
    installAuthInterceptor(client, options);

    // Create an adapter to make the tools work with FastMCP
    const adapter = new ServerAdapter(server);
    
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