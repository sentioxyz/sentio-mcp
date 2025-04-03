import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ProcessorService } from "@sentio/api";
import z from "zod";
import { Client } from "@hey-api/client-fetch";

export function registerProcessorTools(server: McpServer, client: Client, options: any) {
    server.tool("getProcessorStatus", "Get processor status", {
        owner: z.string().describe("Project owner"),
        slug: z.string().describe("Project slug"),
    },
        async ({ owner, slug }) => {
            const response = await ProcessorService.getProcessorStatusV2({
                path: {
                    owner,
                    slug
                },
                client
            })
            if (response.error) {
                throw response.error
            }
            return {
                content: [{
                    type: "text",
                    text: JSON.stringify(response.data)
                }]
            }
        }
    )
}

 