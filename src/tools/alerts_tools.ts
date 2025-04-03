import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { AlertsService } from "@sentio/api";
import z from "zod";
import { getProjectId } from "./web_tools.js";
import { Client } from "@hey-api/client-fetch";

export function registerAlertsTools(server: McpServer, client: Client, options: any) {
    server.tool("getAlertRules", "Get alert rules", {
        owner: z.string().describe("Project owner"),
        slug: z.string().describe("Project slug"),
    },
        async ({ owner, slug }) => {
            const projectId = await getProjectId(client, owner, slug)
            const response = await AlertsService.getAlertRules({
                path: {
                    projectId
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
    
    server.tool("deleteAlertRule", "Delete an alert rule", {
        id: z.string().describe("Alert rule ID"),
    },
        async ({ id }) => {
            const response = await AlertsService.deleteAlertRule({
                path: {
                    id
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

    server.tool("saveAlertRule", "Save an alert rule", {
        id: z.string().describe("Alert rule ID"),
        rule: z.object({}).passthrough().describe("Alert rule configuration"),
    },
        async ({ id, rule }) => {
            const response = await AlertsService.saveAlertRule2({
                path: {
                    id
                },
                body: rule,
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

    server.tool("getAlert", "Get alerts for a specific rule", {
        ruleId: z.string().describe("Alert rule ID"),
    },
        async ({ ruleId }) => {
            const response = await AlertsService.getAlert({
                path: {
                    ruleId
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