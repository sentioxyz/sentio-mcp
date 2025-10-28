import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DebugAndSimulationService } from "@sentio/api";
import z from "zod";
import { Client } from "@hey-api/client-fetch";

export function registerDebugSimulationTools(server: McpServer, client: Client, options: any) {
    server.tool("getCallTraceByTransaction", "Get call trace by transaction", {
        owner: z.string().describe("Project owner"),
        slug: z.string().describe("Project slug"),
        chainId: z.string().describe("Numeric chain ID, e.g. 1 for Ethereum"),
        txHash: z.string().describe("Transaction hash (0x...)"),
        withInternalCalls: z.boolean().optional().describe("Include decoded internal calls"),
        disableOptimizer: z.boolean().optional().describe("Disable optimizer for higher internal call accuracy"),
        ignoreGasCost: z.boolean().optional().describe("Only effective when disableOptimizer=true"),
    }, async ({ owner, slug, chainId, txHash, withInternalCalls, disableOptimizer, ignoreGasCost }) => {
        const response = await DebugAndSimulationService.getCallTraceByTransaction({
            path: {
                owner,
                slug,
                chainId,
                txHash,
            },
            query: {
                withInternalCalls,
                disableOptimizer,
                ignoreGasCost,
            },
            client,
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
}


