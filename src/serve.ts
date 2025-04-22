import http from "node:http";
import {SSEServerTransport} from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";
import {setupServer} from "./start.js";

function decodeJWT(token: string) {
    const parts = token.split('.');
    const json = Buffer.from(parts[1], 'base64').toString();
    return JSON.parse(json);
}

function extractAuth(req: express.Request) {
    const token = req.header('Authorization')
    if (token) {
        // decode jwt token, extract subject as key
        const {sub} = decodeJWT(token)
        return {sub, token }
    }
    const apiKey = req.header('api-key')
    if (apiKey) {
        return{ sub: apiKey,  apiKey}
    }
    return undefined
}

export async function runServe(options: any) {
    const app = express();
    const port = options.port || 3000;


    // Create HTTP server
    const httpServer = http.createServer(app);
    let transports: Map<string, SSEServerTransport> = new Map();
    // Set up SSE endpoint
    app.get('/sse', async (req, res) => {
        const transport = new SSEServerTransport('/message', res);
        await transport.start();
        const auth = extractAuth(req) ?? {sub: options.apiKey, apiKey: options.apiKey}

        const {server} = await setupServer({...options, ...auth});
        await server.connect(transport);
        if (auth?.sub) {
            transports.set(auth.sub, transport)
        } else {
            console.error("No key provided")
        }
        // Handle client disconnection
        req.on('close', () => {
            transport?.close()?.catch(console.error);
            if (auth?.sub) {
                transports.delete(auth.sub)
            }
        });
    });

    app.post('/message', express.json(), async (req, res) => {
        const auth = extractAuth(req) ?? {sub: options.apiKey, apiKey: options.apiKey}
        if (!auth.sub) {
            res.status(401).send("No auth provided")
            return
        }
        const transport = transports.get(auth.sub)
        await transport?.handlePostMessage(req, res);
    });

    // Start the server
    httpServer.listen(port, () => {
        console.error(`MCP Server running on SSE at http://localhost:${port}`);
        console.error(`Connect to the SSE endpoint at http://localhost:${port}/sse`);
    });
}