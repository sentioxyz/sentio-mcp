#!/usr/bin/env node

import { Command } from 'commander'
import { runStart } from './start.js'
import { runServe } from './serve.js'
import { getApiKey } from "./apikey.js";

const program = new Command()

program
    .name('Sentio Api MCP')
    .description('Sentio Api MCP')

// Default command (stdio mode)
program
    .command('start')
    .option('-k, --apiKey <key>', 'API key', getApiKey())
    .option('-t, --token <token>', 'JWT token')
    .option('-H, --host <url>', 'Sentio host endpoint', 'https://app.sentio.xyz')
    .helpOption('-h, --help', 'Show help')
    .action((options) => {
        // Commander doesn't have a direct equivalent to _unknown, so we'll pass an empty array
        const argv: string[] = []
        runStart(argv, options)
    })

// Serve command (SSE mode)
program
    .command('serve')
    .description('Start MCP server with SSE support')
    .option('-k, --apiKey <key>', 'API key', getApiKey())
    .option('-H, --host <url>', 'Sentio host endpoint', 'https://app.sentio.xyz')
    .option('-p, --port <number>', 'Port to run the server on', '3000')
    .action((options) => {
        runServe(options)
    })

program.parse()