# Reo Agent User Guide

## 1. What this project is

Reo Agent is an AI-powered terminal coding assistant built with TypeScript and Bun.
It lets you chat in terminal and use built-in tools for:

- Reading and editing files
- Running shell commands
- Searching code with glob and grep
- Running slash commands like /help, /config, /doctor, /cost

## 2. Requirements

Before running, install:

- Bun (latest stable)
- Node.js (recommended for compatibility checks)
- An Anthropic API key

## 3. Install and run

From the project root:

1. Install dependencies
   bun install

2. Build project
   bun run build

3. Start in development mode
   bun run dev

4. Or run directly
   bun run src/main.tsx

5. Optional: build production bundle
   bun run build:prod

## 4. Configure API key

You can configure your key in either way:

Option A: environment variable
export ANTHROPIC_API_KEY=your_api_key_here

Option B: config file
Create this file:
~/.config/reo-agent/config.yaml

Example content:
apiKey: your_api_key_here
model: claude-sonnet-4-20250514
maxTokens: 8192
temperature: 0.7

## 5. Basic usage

Start interactive chat:
reo
or
bun run src/main.tsx

Send one initial message:
bun run src/main.tsx -m "Explain this repository structure"

Show options:
bun run src/main.tsx --help

## 6. Useful slash commands

- /help : show available commands
- /version : show current version
- /config : show current config
- /config temperature 0.5 : update a config value and persist it
- /doctor : check environment health
- /cost : show session token usage and estimated cost
- /clear : clear conversation in current session

## 7. Validation commands

Run all quality checks:

bun run typecheck
bun run lint
bun test
bun run build
bun run build:prod

If all pass, the project is healthy.

## 8. What to add for complete work

The project is stable now, but to make it fully complete for long-term production use, add:

1. More integration tests

- Full CLI workflows
- Streaming and non-streaming behavior
- Error path and tool failure scenarios

2. Stronger error UX

- More actionable user-facing error messages
- Standardized exit codes for common failures

3. Release workflow

- Versioning and changelog automation
- Optional publish pipeline and release notes process

4. Security hardening

- Add secret scanning in CI
- Add dependency vulnerability checks in CI

5. User documentation upgrades

- Troubleshooting section with common failure examples
- Real-world command recipes for daily use

## 9. Quick success checklist

A user setup is complete when:

- API key is set
- bun run dev starts successfully
- /doctor reports healthy environment
- /config updates persist after restart
- typecheck, lint, test, and build all pass
