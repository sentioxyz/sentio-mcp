# Sentio MCP Server

This is the Model Context Protocol (MCP) server for Sentio, providing a standardized interface for interacting with Sentio's API services.

## Features

- Web Tools Integration
- Data Tools Integration
- Price Tools Integration
- Processor Tools Integration
- Alerts Tools Integration
- Project Resource Management
- Authentication Support (API Key and Token-based)

## Prerequisites

- Node.js (Latest LTS version recommended)
- pnpm (Package manager)
- TypeScript

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd sentio-mcp
```

2. Install dependencies:
```bash
pnpm install
```

3. Build the project:
```bash
pnpm build
```

## Configuration

The server can be configured using environment variables or command-line arguments:

- `--host`: The Sentio API host URL, default to https://app.sentio.xyz
- `--api-key`: Your Sentio API key
- `--token`: Your Sentio authentication token (alternative to API key)

## Usage

## Claud Desktop Configuration

To use this MCP server in Claud Desktop, add the following configuration to your Claud settings:


```
{
    "mcpServers": {
        "sentio-api": {
            "command": "bun",  
            "args": [
                "--watch",
                "<project_dir>/src/cli.ts",
                "-k",
                "<your sentio api key>"
            ]
        }
    }
}
```
or use nodejs (v22 or later)
```
{
    "mcpServers": {
        "sentio-api": {
            "command": "node",  
            "args": [
                "--watch",
                "<project_dir>/build/cli.js",
                "-k",
                "<your sentio api key>"
            ]
        }
    }
}
```

## Available Tools

The server provides access to the following tool categories:

- Web Tools: General web-related operations
- Data Tools: Data management and querying
- Price Tools: Price-related operations
- Processor Tools: Data processing operations
- Alerts Tools: Alert management and configuration

## Development

### Running Tests

```bash
pnpm test
```

### Project Structure

- `src/`: Source code directory
  - `tools/`: Tool implementations
  - `start.ts`: Server startup configuration
  - `cli.ts`: Command-line interface
  - `apikey.ts`: API key management
  - `index.ts`: Main entry point

 
