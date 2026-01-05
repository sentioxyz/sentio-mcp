import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DataService, common, WebService } from "@sentio/api";
import z from "zod";
import { Client } from "@hey-api/client-fetch";
export function registerDataTools(server: McpServer, client: Client, options: any) {
    server.tool("executeSql", "Execute SQL in a project", {
        owner: z.string().describe("Project owner"),
        slug: z.string().describe("Project slug"),
        query: z.string().describe("SQL query to execute"),
        version: z.number().default(0).describe("Version of the project"),
        cursor: z.string().optional().describe("Cursor to paginate results"),
        size: z.number().default(100).describe("Number of results to return"),
        parameters: z.record(z.string(), z.any()).optional().describe("Parameters to pass to the query")
    }, async ({ owner, slug, query, version, cursor, size, parameters }) => {
        const response = await DataService.executeSql({
            path: {
                owner,
                slug
            },
            body: {
                sqlQuery: {
                    sql: query,
                    size,
                    parameters: toRichStruct(parameters)
                },
                version,
                cursor,
            },
            client
        });
        if (response.error) {
            throw response.error;
        }
        return {
            content: [{
                type: "text",
                text: JSON.stringify(response.data),
            }]
        };
    });

    server.tool("queryEventLog", "Query event logs", {
        owner: z.string().describe("Project owner"),
        slug: z.string().describe("Project slug"),
        query: z.object({
            from: z.string().optional(),
            to: z.string().optional(),
            limit: z.number().optional(),
            offset: z.number().optional(),
            filters: z.array(z.object({
                field: z.string(),
                operator: z.string(),
                value: z.string()
            })).optional()
        })
    }, async ({ owner, slug, query }) => {
        const response = await DataService.queryLog({
            path: {
                owner,
                slug
            },
            body: query,
            client
        });
        if (response.error) {
            throw response.error;
        }
        return {
            content: [{
                type: "text",
                text: JSON.stringify(response.data),
            }]
        };
    });

    server.tool("getMetrics", "Get a list of metrics in a project", {
        version: z.number().describe("Version of the project").default(0)

    }, async ({ version }) => {
        const response = await DataService.getMetrics({
            query: {
                version: version
            },
            client
        });
        if (response.error) {
            throw response.error;
        }
        return {
            content: [{
                type: "text",
                text: JSON.stringify(response.data),
            }]
        };
    });

    server.tool("queryRange", "Query metrics range", {
        owner: z.string().describe("Project owner"),
        slug: z.string().describe("Project slug"),
        timeRange: z.object({
            start: z.string().default("now-30d").describe("Start time"),
            end: z.string().default("now").describe("End time"),
            step: z.number().describe("Step"),
            timezone: z.string().default("UTC").optional().describe("Timezone")
        }),
        queries: z.array(z.object({
            query: z.string().optional(),
            alias: z.string().optional(),
            id: z.string().optional(),
            labelSelector: z.record(z.string()).optional(),
            aggregate: z.any().optional(),
            functions: z.array(z.object({
                name: z.string(),
                parameters: z.record(z.any()).optional()
            })).optional(),
            color: z.string().optional(),
            disabled: z.boolean().optional()
        })).describe("Array of metric queries"),
        version: z.number().optional().describe("Version of the project").default(0)
    }, async ({ owner, slug, queries, timeRange, version }) => {
 
        const response = await DataService.queryRange({
            path: {
                owner,
                slug
            },
            body: {
                timeRange,
                queries,  
                version: version ?? 0
            },
            client
        })
        if (response.error) {
            throw response.error;
        }
        return {
            content: [{
                type: "text",
                text: JSON.stringify(response.data),
            }]
        }

    })

}

function toRichStruct(parameters?: Record<string, any>): common.RichStruct | undefined {
    if (!parameters) {
        return undefined;
    }
    return {
        fields: Object.fromEntries(Object.entries(parameters).map(([key, value]) => [key, toRichValue(value)]))
    }
}

function toRichValue(value: any): common.RichValue {
    if (value === null) {
        return {
            nullValue: "NULL_VALUE"
        }
    }

    switch (typeof value) {
        case "number":
            if (Number.isInteger(value)) {
                return {
                    intValue: value
                }
            }
            return {
                floatValue: value
            }
        case "bigint":
            return {
                bigintValue: toBigInteger(value)
            }
        case "string":
            return {
                stringValue: value
            }
        case "boolean":
            return {
                boolValue: value
            }
        case "object":
            if (value instanceof Date) {
                return {
                    timestampValue: value.toISOString()
                }
            }
            if (Array.isArray(value)) {
                return {
                    listValue: {
                        values: value.map(v => toRichValue(v))
                    }
                }
            }
            return {
                structValue: toRichStruct(value)
            }
        default:
            throw new Error(`Unsupported value type: ${typeof value}`);
    }
}

function toBigInteger(value: bigint): common.BigInteger {
    return {
        negative: value < 0n,
        data: value.toString(16)
    }
}