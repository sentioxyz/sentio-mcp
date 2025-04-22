import {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
import {StdioServerTransport} from "@modelcontextprotocol/sdk/server/stdio.js";
import {createClient} from "@hey-api/client-fetch";
import {getCurrentUserOrOrg, getProjectList, registerWebTools} from "./tools/web_tools.js";
import {registerDataTools} from "./tools/data_tools.js";
import {registerPriceTools} from "./tools/price_tools.js";
import {registerProcessorTools} from "./tools/processor_tools.js";
import {registerAlertsTools} from "./tools/alerts_tools.js";

export async function setupServer(options: any) {
    const client = createClient({
        baseUrl: options.host,
    })
    client.interceptors.request.use((request) => {
        if (options.apiKey) {
            request.headers.set("api-key", options.apiKey)
        } else if (options.token) {
            request.headers.set("Authorization", `Bearer ${options.token}`)
        }
        return request
    })

    const server = new McpServer({
        name: "sentio-api",
        version: "1.0.0",
        capabilities: {
            resources: {},
            tools: {},
        },
    });

    registerWebTools(server, client, options);
    registerDataTools(server, client, options);
    registerPriceTools(server, client, options);
    registerAlertsTools(server, client, options);
    registerProcessorTools(server, client, options);

    const { user, org } = await getCurrentUserOrOrg(client);
    console.error("Logged in as", user?.username ?? org?.name)
    const userId = user?.id
    const orgId = org?.id

    const projects = await getProjectList(userId, orgId, client);
    for (const project of projects) {
        server.resource(
            project.slug!,
            `${options.host}/${project.ownerName}/${project.slug}`,
            async (uri: URL) => {
                return {
                    contents: [{
                        uri: uri.toString(),
                        mimeType: "application/json",
                        text: JSON.stringify(project)
                    }]
                }
            }
        )
    }

    return { server, userId, orgId };
}

export async function runStart(argv: string[], options: any) {
    const { server } = await setupServer(options);

    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("MCP Server running on stdio");
}

