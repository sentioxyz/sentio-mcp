import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebService } from "@sentio/api";
import z from "zod";
import { Client } from "@hey-api/client-fetch";

export async function getProjectList(userId: string, orgId: string, client: Client) {
    const response = await WebService.getProjectList({
        query: {
            userId: userId,
            organizationId: orgId
        },
        client
    })
    if (response.error) {
        throw response.error
    }
    const projects = [...(response.data?.projects ?? []), ...(response.data?.sharedProjects ?? []), ...(response.data?.orgProjects ?? [])]
    return projects
}

export async function getCurrentUserOrOrg(client: Client) {
    const response = await client.get({
        url: "/api/v1/users"
    })
    if (response.error) {
         // if err, it's possible using a org api key
         const response = await client.get({
            url: "/api/v1/organizations"
         })
         if (response.error) {
            throw response.error
         }
         const org = response.data as any
         return { org }
    }
    const user = response.data as any
    return { user }
}

export function registerWebTools(server: McpServer, client: Client, options: any) {
    const host = options.host;

    server.tool("getProjectList", "Get project list", {
        userId: z.string().describe("User ID"),
        orgId: z.string().describe("Organization ID"),
    },
        async ({ userId, orgId }) => {
            const projects = await getProjectList(userId, orgId, client, host);
            return {
                content: projects.map(p => ({
                    type: "resource",
                    resource: {
                        uri: `${host}/${p.ownerName}/${p.slug}`,
                        text: JSON.stringify(p),
                        mimeType: "application/json"
                    }
                }))
            }
        }
    )

    server.tool("getProject", "Get project", {
        owner: z.string().describe("Project owner"),
        slug: z.string().describe("Project slug"),
    },
        async ({ owner, slug }) => {
            const response = await WebService.getProject({
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

    server.tool("listDashboards", "List all dashboards in a project", {
        owner: z.string().describe("Project owner"),
        slug: z.string().describe("Project slug"),
    },
        async ({ owner, slug }) => {
            const response = await WebService.listDashboards2({
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

    server.tool("getDashboard", "Get a dashboard by id", {
        owner: z.string().describe("Project owner"),
        slug: z.string().describe("Project slug"),
        dashboardId: z.string().describe("Dashboard ID"),
    },
        async ({ owner, slug, dashboardId }) => {
            const response = await WebService.getDashboard2({
                path: {
                    owner,
                    slug,
                    dashboardId
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

    server.tool("importDashboard", "Import a dashboard to another dashboard", {
        dashboardId: z.string().describe("Target Dashboard ID"),
        dashboardJson: z.string().describe("Dashboard JSON to import"),
    },
        async ({ dashboardId, dashboardJson }) => {
            const response = await WebService.importDashboard({
                body: {
                    dashboardId,
                    dashboardJson: JSON.parse(dashboardJson)
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

    server.tool("deleteDashboard", "Delete a dashboard by id", {
        dashboardId: z.string().describe("Dashboard ID"),
    },
        async ({ dashboardId }) => {
            const response = await WebService.deleteDashboard({
                path: {
                    dashboardId
                },
                client
            })
            if (response.error) {
                throw response.error
            }
            return {
                content: [{
                    type: "text",
                    text: "Dashboard deleted successfully"
                }]
            }
        }
    )

    server.tool("exportDashboard", "Export a dashboard to json", {
        dashboardId: z.string().describe("Dashboard ID"),
    },
        async ({ dashboardId }) => {
            const response = await WebService.exportDashboard({
                path: {
                    dashboardId
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


export async function getProjectId(client: Client, owner: string, slug: string) {
    const prjRes = await WebService.getProject({
        path: {
            owner,
            slug
        }, client
    })
    if (prjRes.error) {
        throw prjRes.error;
    }
    const project = prjRes.data?.project;
    
    return project?.id!;
}