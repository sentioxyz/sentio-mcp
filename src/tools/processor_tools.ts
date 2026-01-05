import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ProcessorService, ProcessorExtService } from "@sentio/api";
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

    server.tool("getProcessorSourceFiles", "Get processor source files", {
        owner: z.string().describe("Project owner"),
        slug: z.string().describe("Project slug"),
        version: z.number().describe("Version of the processor").optional(),
        paths: z.array(z.string()).describe("Optional list of file paths to include").optional()
    },
        async ({ owner, slug, version, paths }) => {
            const response = await ProcessorExtService.getProcessorSourceFiles({
                path: {
                    owner,
                    slug
                },
                query: {
                    version
                },
                client
            })
            if (response.error) {
                throw response.error
            }
            let result = response.data
            if (paths && paths.length) {
                const files = result?.sourceFiles ?? []
                const filtered = files.filter(f => f.path && paths.includes(f.path as string))
                result = { sourceFiles: filtered }
            }
            return {
                content: [{
                    type: "text",
                    text: JSON.stringify(result)
                }]
            }
        }
    )

    server.tool("listProcessorSourceFilePaths", "List all processor source file paths", {
        owner: z.string().describe("Project owner"),
        slug: z.string().describe("Project slug"),
        version: z.number().describe("Version of the processor").optional()
    },
        async ({ owner, slug, version }) => {
            const response = await ProcessorExtService.getProcessorSourceFiles({
                path: {
                    owner,
                    slug
                },
                query: {
                    version
                },
                client
            })
            if (response.error) {
                throw response.error
            }
            const paths = (response.data?.sourceFiles ?? [])
                .map(f => f.path)
                .filter((p): p is string => Boolean(p))
            return {
                content: [{
                    type: "text",
                    text: JSON.stringify(paths)
                }]
            }
        }
    )
}

 