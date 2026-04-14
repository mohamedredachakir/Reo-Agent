# Reo Agent

AI-powered terminal coding assistant built with TypeScript.

## Features

- **Interactive REPL** - Chat with Reo directly in your terminal
- **File Operations** - Read, write, and edit files with natural language
- **Shell Commands** - Execute bash commands and see results
- **Code Search** - Search files with grep and glob patterns
- **Streaming Responses** - See Reo's responses as they're generated
- **Slash Commands** - `/help`, `/config`, `/doctor`, `/version`
- **Tool System** - Extensible tool architecture
- **Multi-Agent Support** - Coordinate multiple AI agents for complex tasks

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/reo-agent.git
cd reo-agent

# Install dependencies
bun install

# Build
bun run build

# Link for global use
bun link
```

## Configuration

Create `~/.config/reo-agent/config.yaml`:

```yaml
apiKey: your-anthropic-api-key
model: claude-sonnet-4-20250514
maxTokens: 8192
temperature: 0.7
```

Or set the environment variable:
```bash
export ANTHROPIC_API_KEY=your-api-key
```

## Usage

```bash
# Start interactive mode
reo

# Send initial message
reo -m "Explain this code"

# Show help
reo --help
```

## Available Tools

| Tool | Description |
|------|-------------|
| `read` | Read file contents |
| `write` | Write content to files |
| `edit` | Edit files with string replacement |
| `bash` | Execute shell commands |
| `glob` | Find files matching patterns |
| `grep` | Search file contents |
| `web_fetch` | Fetch URLs |

## Slash Commands

| Command | Description |
|---------|-------------|
| `/help` | Show help information |
| `/version` | Show version |
| `/config [key] [value]` | View or set config |
| `/doctor` | Check system requirements |
| `/clear` | Clear conversation |
| `/cost` | Show API costs |

## Architecture

```
src/
├── main.tsx         # CLI entry point
├── App.tsx         # Main React app
├── QueryEngine.ts  # LLM API client
├── Tool.ts         # Base tool class
├── tools/          # Tool implementations
├── commands/       # Slash commands
├── components/     # React/Ink UI components
├── config/         # Configuration management
├── state/          # State management
├── coordinator/    # Multi-agent coordination
└── utils/          # Utility functions
```

## Development

```bash
# Run in development
bun run dev

# Type check
bun run typecheck

# Lint
bun run lint

# Build for production
bun run build:prod
```

## License

MIT
# Reo-Agent
