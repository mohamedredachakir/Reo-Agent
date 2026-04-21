# Reo Agent Documentation

## What is Reo Agent?

Reo Agent is an AI-powered terminal coding assistant for repository work: code edits, shell execution, search, and iterative problem solving.

## Quick start

```bash
bun install
bun run build
bun run dev
```

## Core commands

- `/help`: list available commands.
- `/config`: view current configuration.
- `/config <key> <value>`: persist config updates to YAML.
- `/cost`: show current session token usage and estimated USD cost.
- `/doctor`: validate environment setup.
- `/clear`: clear in-memory conversation context.

## CLI options

- `-m, --message <message>`: send an initial message.
- `--no-stream`: disable streaming and print the final response once.
- `--model <model>`: override model for current run.
- `--max-tokens <number>`: override response token cap.
- `--temperature <number>`: override sampling temperature (`0` to `2`).

Invalid numeric values for `--max-tokens` and `--temperature` fail fast with an error.

## Development checks

```bash
bun run typecheck
bun run lint
bun test
bun run build
bun run build:prod
```

## Troubleshooting

- Missing API key: set `ANTHROPIC_API_KEY` or `apiKey` in config.
- No tool results: verify working directory and file path permissions.
- Unexpected command errors: run `/doctor` and then re-check config values.

## Additional docs

- Architecture details: `docs/architecture.md`
- Contribution guide: `CONTRIBUTING.md`
