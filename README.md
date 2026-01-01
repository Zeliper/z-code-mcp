# Z-Code MCP

MCP (Model Context Protocol) server for orchestrating multiple Claude Code sessions with HEAD/SUB coordination pattern.

## Overview

Z-Code MCP enables complex, multi-task coding projects by coordinating multiple Claude Code CLI sessions:

- **HEAD Phase**: Analyzes objectives and creates execution plans
- **SUB Phase**: Executes tasks in parallel with controlled concurrency
- **Aggregation Phase**: Combines results and generates summaries

## Installation

### Using npx (Recommended)

```bash
npx z-code-mcp
```

For always getting the latest version:

```bash
npx z-code-mcp@latest
```

### Global Installation

```bash
npm install -g z-code-mcp
```

## Claude Desktop / Claude Code Configuration

Add to your Claude configuration file:

**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "z-code-mcp": {
      "command": "npx",
      "args": ["-y", "z-code-mcp@latest"]
    }
  }
}
```

### Local Development Configuration

For testing local changes without publishing:

```json
{
  "mcpServers": {
    "z-code-mcp-dev": {
      "command": "node",
      "args": ["C:/path/to/z-code-mcp/build/index.js"]
    }
  }
}
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `Z_MCP_CLAUDE_COMMAND` | Claude CLI command | `claude` |
| `Z_MCP_MAX_CONCURRENT` | Max concurrent processes (1-10) | `3` |
| `Z_MCP_TEMP_DIR` | Temp directory for outputs | System temp |
| `Z_MCP_KEEP_TEMP` | Keep temp files on error | `false` |
| `Z_MCP_TEMPLATE_DIR` | Custom templates directory | Built-in |
| `Z_MCP_LOG_LEVEL` | Log level (debug/info/warn/error) | `info` |

## Available Task Templates

| Template | Description |
|----------|-------------|
| `code_analysis` | Analyze existing code structure and patterns |
| `code_generation` | Generate new code based on specifications |
| `test_writing` | Write tests for existing code |
| `documentation` | Create documentation |
| `security_review` | Security analysis and vulnerability detection |
| `refactoring` | Code improvements and refactoring |
| `custom` | Use custom template |

## Usage Example

Once configured, the MCP exposes an `orchestrate` tool:

```json
{
  "objective": "Implement user authentication feature",
  "workingDirectory": "/path/to/project",
  "tasks": [
    {
      "id": "analyze",
      "type": "code_analysis",
      "description": "Analyze current auth implementation"
    },
    {
      "id": "implement",
      "type": "code_generation",
      "description": "Implement JWT authentication",
      "dependencies": ["analyze"]
    },
    {
      "id": "test",
      "type": "test_writing",
      "description": "Write auth tests",
      "dependencies": ["implement"]
    }
  ],
  "coordination": {
    "strategy": "dependency-based",
    "maxConcurrent": 3
  }
}
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Watch mode
npm run dev

# Run MCP Inspector
npm run inspector
```

## Auto-Update Behavior

- **npx caches packages**: Use `npx z-code-mcp@latest` to force latest version
- **Local development**: Use direct path reference for immediate updates after build

## License

MIT
