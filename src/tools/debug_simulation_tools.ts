import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DebugAndSimulationService, MoveService } from "@sentio/api";
import z from "zod";
import { Client } from "@hey-api/client-fetch";

/**
 * Debug and Simulation Tools for Call Trace Analysis
 */

// Helper function to generate a readable name for a call
function generateCallName(call: any): string {
    // If we have a decoded function name, use it
    // Try both 'functionName' and 'function' fields
    const funcName = call.functionName || call.function;
    if (funcName) {
        return funcName.replace(/\(.*\)/, ''); // Remove parameters
    }

    // Try to get function selector from input (first 10 chars: 0x + 8 hex chars)
    if (call.input && call.input.length >= 10) {
        return call.input.substring(0, 10);
    }

    // Fallback to call type
    return (call.type || 'CALL').toLowerCase();
}

function truncateSubCalls(trace: any): any {
    if (!Array.isArray(trace.calls) || trace.calls.length === 0) {
        return trace;
    }

    // Create a shallow copy of the trace
    const truncatedTrace = { ...trace };

    // Create copies of the calls array with truncated subcalls
    truncatedTrace.calls = trace.calls.map((call: any) => {
        const callCopy = { ...call };
        // add sub calls count
        callCopy.subCallsCount = Array.isArray(callCopy.calls) ? callCopy.calls.length : 0;

        delete callCopy.calls; // Remove nested calls to truncate size
        return callCopy;
    });

    return truncatedTrace;
}

// Helper function to extract a specific call by named path (e.g., "root", "root/transfer_0", "root/transfer_0/approve_0")
function getCallByPath(trace: any, path: string): any | null {
    if (!trace) return null;

    // Split path into segments
    const segments = path.split('/');

    // First segment should be "root"
    if (segments[0] !== 'root') {
        return null;
    }

    // If path is just "root", return the trace
    if (segments.length === 1) {
        return truncateSubCalls(trace);
    }

    let current = trace;

    // Traverse the path using named segments
    for (let i = 1; i < segments.length; i++) {
        const targetName = segments[i];

        if (!Array.isArray(current.calls) || current.calls.length === 0) {
            return null;
        }

        // Generate names for all children to find the matching one
        const nameCounter = new Map<string, number>();
        let found = false;

        for (const child of current.calls) {
            const baseName = generateCallName(child);
            const count = nameCounter.get(baseName) || 0;
            nameCounter.set(baseName, count + 1);

            const childName = `${baseName}_${count}`;

            // Debug logging
            console.log(`Checking child: baseName="${baseName}", count=${count}, childName="${childName}", targetName="${targetName}"`);

            if (childName === targetName) {
                current = child;
                found = true;
                break;
            }
        }

        if (!found) {
            return null;
        }
    }

    return truncateSubCalls(current);
}

export function registerDebugSimulationTools(server: McpServer, client: Client, _options: any) {

    server.tool("getSuiCallTrace", "Get the call trace for a Sui transaction", {
        networkId: z.string().describe("Network ID for Sui (e.g., '1' for mainnet, '2' for testnet)"),
        txDigest: z.string().describe("Sui transaction digest"),
    }, async ({ networkId, txDigest }) => {
        const response = await MoveService.getSuiCallTrace({
            query: {
                networkId,
                txDigest,
            },
            client,
        });
        if (response.error) {
            throw response.error;
        }
        return {
            content: [{
                type: "text",
                text: JSON.stringify(response.data, null, 2),
            }]
        };
    });

    server.tool("getAptosCallTrace", "Get the call trace for an Aptos transaction", {
        networkId: z.string().describe("Network ID for Aptos (e.g., '1' for mainnet, '2' for testnet)"),
        txHash: z.string().describe("Aptos transaction hash"),
    }, async ({ networkId, txHash }) => {
        const response = await MoveService.getCallTrace({
            query: {
                networkId,
                txHash,
            },
            client,
        });
        if (response.error) {
            throw response.error;
        }
        return {
            content: [{
                type: "text",
                text: JSON.stringify(response.data, null, 2),
            }]
        };
    });

    server.tool("getCallTraceByTransaction", "Get the call trace for a transaction without internal calls", {
        owner: z.string().describe("Project owner"),
        slug: z.string().describe("Project slug"),
        chainId: z.string().describe("Numeric chain ID (e.g., '1' for Ethereum)"),
        txHash: z.string().describe("Transaction hash (0x...)"),
    }, async ({ owner, slug, chainId, txHash }) => {
        const response = await DebugAndSimulationService.getCallTraceByTransaction({
            path: {
                owner,
                slug,
                chainId,
                txHash,
            },
            query: {
                withInternalCalls: false,
                disableOptimizer: false,
                ignoreGasCost: false,
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

    server.tool(
        "exploreDetailedCallTraceByTransaction",
        "Explore the detailed call trace for a transaction including internal calls. Returns a partial result by default with subcalls truncated - use callPath to navigate into specific nested calls (e.g., 'root' for root call, 'root/map_0' for first map call, 'root/map_0/dispatch_0' for first dispatch within that map call).",
        {
            owner: z.string().describe("Project owner"),
            slug: z.string().describe("Project slug"),
            chainId: z.string().describe("Numeric chain ID (e.g., '1' for Ethereum)"),
            txHash: z.string().describe("Transaction hash (0x...)"),
            callPath: z.string().optional().default("root").describe("Path to the call to explore - defaults to 'root'. Format: 'root' for top-level call, 'root/functionName_0' for first occurrence of functionName, 'root/functionName_0/nestedCall_1' for second occurrence of nestedCall within that function, etc."),
        },
        async ({ owner, slug, chainId, txHash, callPath }) => {
            // Fetch the full call trace
            const response = await DebugAndSimulationService.getCallTraceByTransaction({
                path: {
                    owner,
                    slug,
                    chainId,
                    txHash,
                },
                query: {
                    withInternalCalls: true,
                    disableOptimizer: false,
                    ignoreGasCost: false,
                },
                client,
            });
            if (response.error) {
                throw response.error;
            }

            // Get the target call
            const path = callPath || "root";
            const targetCall = getCallByPath(response.data, path);

            if (!targetCall) {
                throw new Error(`Call path '${path}' not found in trace. Check that the path is valid.`);
            }

            // Return the exact call result
            return {
                content: [{
                    type: "text",
                    text: JSON.stringify(targetCall),
                }]
            };
        }
    );
}


