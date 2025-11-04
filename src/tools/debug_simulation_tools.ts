import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DebugAndSimulationService } from "@sentio/api";
import z from "zod";
import { Client } from "@hey-api/client-fetch";

/**
 * Debug and Simulation Tools for Call Trace Analysis
 *
 * This module provides three tools optimized for LLM context management:
 *
 * 1. getCallTraceSummary - Lightweight summary tool (RECOMMENDED FIRST STEP)
 *    - Returns high-level transaction overview
 *    - Lists failed calls with paths (e.g., "0.2.1")
 *    - Shows contracts involved
 *    - Includes preview of top 2 call levels
 *    - Minimal token usage (~500 tokens)
 *
 * 2. getCallTraceDetails - Targeted detail extraction
 *    - Fetch specific call by path (from summary's failedCalls)
 *    - Example: path "0.2.1" = root → 3rd call → 2nd subcall
 *    - Returns just that branch with configurable depth
 *    - Perfect for investigating specific failures
 *
 * 3. getCallTraceByTransaction - Full trace with depth control
 *    - Default maxDepth=3 to prevent context overflow
 *    - Use maxDepth=0 for unlimited (careful with large traces)
 *    - Returns metadata about truncation
 *
 * Recommended workflow:
 *   1. Call getCallTraceSummary to understand the transaction
 *   2. If investigating a specific failure, use getCallTraceDetails with the path
 *   3. If broader context needed, use getCallTraceByTransaction with appropriate maxDepth
 */

// Helper function to truncate call trace to a specific depth
function truncateCallTrace(trace: any, maxDepth: number, currentDepth: number = 0): any {
    if (!trace || currentDepth >= maxDepth) {
        return trace;
    }

    const truncated = { ...trace };

    if (Array.isArray(trace.calls) && trace.calls.length > 0) {
        if (currentDepth + 1 >= maxDepth) {
            // At max depth, just include count of nested calls
            truncated.calls = [];
            truncated.nestedCallsCount = trace.calls.length;
            truncated.nestedCallsOmitted = true;
        } else {
            truncated.calls = trace.calls.map((call: any) =>
                truncateCallTrace(call, maxDepth, currentDepth + 1)
            );
        }
    }

    return truncated;
}

// Helper function to count total calls recursively
function countCalls(trace: any): number {
    if (!trace) return 0;
    let count = 1;
    if (Array.isArray(trace.calls)) {
        trace.calls.forEach((call: any) => {
            count += countCalls(call);
        });
    }
    return count;
}

// Helper function to find failed calls
function findFailedCalls(trace: any, path: string = "0"): any[] {
    if (!trace) return [];

    const failed: any[] = [];

    if (trace.error || trace.revert) {
        failed.push({
            path,
            type: trace.type,
            from: trace.from,
            to: trace.to,
            error: trace.error || trace.revert,
            gasUsed: trace.gasUsed
        });
    }

    if (Array.isArray(trace.calls)) {
        trace.calls.forEach((call: any, index: number) => {
            failed.push(...findFailedCalls(call, `${path}.${index}`));
        });
    }

    return failed;
}

// Helper function to extract unique contracts
function extractContracts(trace: any): Set<string> {
    const contracts = new Set<string>();

    function traverse(node: any) {
        if (!node) return;

        if (node.from) contracts.add(node.from);
        if (node.to) contracts.add(node.to);

        if (Array.isArray(node.calls)) {
            node.calls.forEach(traverse);
        }
    }

    traverse(trace);
    return contracts;
}

// Helper function to extract a specific call by path
function getCallByPath(trace: any, path: string): any | null {
    if (!trace) return null;

    const parts = path.split('.').map(p => parseInt(p, 10));

    // Path starts at "0" which is the root
    if (parts[0] !== 0) {
        return null;
    }

    let current = trace;

    // Traverse the path
    for (let i = 1; i < parts.length; i++) {
        const index = parts[i];

        if (!Array.isArray(current.calls) || index >= current.calls.length) {
            return null;
        }

        current = current.calls[index];
    }

    return current;
}

// Helper function to create summary
function createCallTraceSummary(trace: any): any {
    const totalCalls = countCalls(trace);
    const failedCalls = findFailedCalls(trace);
    const contracts = extractContracts(trace);

    return {
        transaction: {
            type: trace.type,
            from: trace.from,
            to: trace.to,
            value: trace.value,
            gas: trace.gas,
            gasUsed: trace.gasUsed,
            success: !trace.error && !trace.revert
        },
        summary: {
            totalCalls,
            totalGasUsed: trace.gasUsed,
            failedCallsCount: failedCalls.length,
            contractsInvolvedCount: contracts.size,
            hasInternalCalls: totalCalls > 1
        },
        failedCalls: failedCalls.length > 0 ? failedCalls : undefined,
        contractsInvolved: Array.from(contracts).slice(0, 20), // Limit to first 20
    };
}

export function registerDebugSimulationTools(server: McpServer, client: Client, _options: any) {

    server.tool("getCallTraceSummary", "Get a high-level summary of call trace by transaction. Use this first to understand the transaction before fetching full details.", {
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

        const summary = createCallTraceSummary(response.data);

        return {
            content: [{
                type: "text",
                text: JSON.stringify(summary, null, 2),
            }]
        };
    });

    server.tool("getCallTraceDetails", "Get details for a specific call by path. Use path from getCallTraceSummary (e.g., '0.2.1' for root->3rd call->2nd subcall).", {
        owner: z.string().describe("Project owner"),
        slug: z.string().describe("Project slug"),
        chainId: z.string().describe("Numeric chain ID, e.g. 1 for Ethereum"),
        txHash: z.string().describe("Transaction hash (0x...)"),
        callPath: z.string().describe("Call path (e.g., '0' for root, '0.2.1' for nested calls). Get paths from getCallTraceSummary failedCalls."),
        maxDepth: z.number().optional().default(2).describe("Maximum depth to show from this call (default: 2)"),
        withInternalCalls: z.boolean().optional().describe("Include decoded internal calls"),
        disableOptimizer: z.boolean().optional().describe("Disable optimizer for higher internal call accuracy"),
        ignoreGasCost: z.boolean().optional().describe("Only effective when disableOptimizer=true"),
    }, async ({ owner, slug, chainId, txHash, callPath, maxDepth, withInternalCalls, disableOptimizer, ignoreGasCost }) => {
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

        const targetCall = getCallByPath(response.data, callPath);

        if (!targetCall) {
            throw new Error(`Call path '${callPath}' not found in trace. Verify path from getCallTraceSummary.`);
        }

        const depth = maxDepth ?? 2;
        const truncatedCall = depth === 0 ? targetCall : truncateCallTrace(targetCall, depth);

        // Add context information
        const result = {
            path: callPath,
            call: truncatedCall,
            metadata: {
                hasNestedCalls: Array.isArray(targetCall.calls) && targetCall.calls.length > 0,
                nestedCallsCount: Array.isArray(targetCall.calls) ? targetCall.calls.length : 0,
                maxDepthApplied: depth,
                wasTruncated: depth > 0 && Array.isArray(targetCall.calls) && targetCall.calls.length > 0
            }
        };

        return {
            content: [{
                type: "text",
                text: JSON.stringify(result, null, 2),
            }]
        };
    });

    server.tool("getCallTraceByTransaction", "Get call trace by transaction with depth limiting. For large traces, use getCallTraceSummary first.", {
        owner: z.string().describe("Project owner"),
        slug: z.string().describe("Project slug"),
        chainId: z.string().describe("Numeric chain ID, e.g. 1 for Ethereum"),
        txHash: z.string().describe("Transaction hash (0x...)"),
        maxDepth: z.number().optional().default(3).describe("Maximum call depth to return (default: 3, use 0 for unlimited). Helps manage large traces."),
        withInternalCalls: z.boolean().optional().describe("Include decoded internal calls"),
        disableOptimizer: z.boolean().optional().describe("Disable optimizer for higher internal call accuracy"),
        ignoreGasCost: z.boolean().optional().describe("Only effective when disableOptimizer=true"),
    }, async ({ owner, slug, chainId, txHash, maxDepth, withInternalCalls, disableOptimizer, ignoreGasCost }) => {
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

        const depth = maxDepth ?? 3;
        const result = depth === 0 ? response.data : truncateCallTrace(response.data, depth);

        // Add metadata about truncation
        const metadata = {
            maxDepthApplied: depth,
            wasTruncated: depth > 0,
            totalCallsInOriginal: depth > 0 ? countCalls(response.data) : undefined
        };

        return {
            content: [{
                type: "text",
                text: JSON.stringify({
                    metadata,
                    trace: result
                }, null, 2),
            }]
        };
    });
}


