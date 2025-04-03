import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { PriceService } from "@sentio/api";
import z, { symbol } from "zod";
import { Client } from "@hey-api/client-fetch";

export function registerPriceTools(server: McpServer, client: Client, options: any) {
    server.tool("getPrice", "Get price of a given coin", {
        symbol: z.string().describe("Coin Symbol"),
        timestamp: z.date().describe("Timestamp"),
        chain: z.string().describe("Chain"),
        address: z.string().describe("Address"),
    }, async ({ symbol, timestamp, chain, address }) => {
        const response = await PriceService.getPrice({
            query: {
                'coinId.symbol': symbol,
                'coinId.address.address': address,
                'coinId.address.chain': chain,
                timestamp: timestamp.toISOString(),
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

    server.tool("priceListCoins", "List all available coins", {}, async () => {
        const response = await PriceService.priceListCoins({ client });
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