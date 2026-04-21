# Reo Agent Project Description

## What is this project?

Reo Agent is an AI-powered terminal coding assistant built with TypeScript and Bun. It provides a command-line interface where developers can chat with an AI model and let it use tools (file editing, shell commands, search, and web fetch) to help with coding tasks.

## Why this project was created

This project was created to make developer workflows faster directly in the terminal by combining:

- Natural language interaction with an AI assistant
- Built-in coding tools for reading/writing/editing files
- Shell command execution for development tasks
- Search tools for large codebases
- A slash-command system for utility actions (`/help`, `/config`, `/doctor`, `/version`, etc.)

In short, the goal is to provide a lightweight local CLI coding agent similar to modern AI coding assistants, but focused on terminal usage and extensibility.

## What we use it for

Main use cases:

- Asking coding questions about a repository
- Reading and modifying project files via AI-guided tool calls
- Running terminal commands from the assistant workflow
- Searching files and text quickly (`glob`, `grep`)
- Managing interactive coding sessions in CLI
- Experimenting with a multi-agent coordination concept (team/agent/task model)

## Current implemented architecture

High-level implemented modules:

- `src/main.tsx`: CLI entry point and interactive loop
- `src/QueryEngine.ts`: LLM integration, message history, and tool-calling logic
- `src/Tool.ts`: base tool abstraction
- `src/tools/*`: file tools, bash/web tools, registry
- `src/commands/index.ts`: slash commands and command registry
- `src/components/*`: Ink UI components for REPL display
- `src/config/index.ts`: config manager and YAML handling
- `src/state/index.ts`: state/session manager
- `src/coordinator/index.ts`: multi-agent team/task orchestration model

## Is the project finished and ready?

Short answer: **Not fully finished yet**.

### Why it is not fully ready

From the analysis, there are clear work-in-progress indicators:

- TypeScript typecheck currently fails with multiple errors in `src/main.tsx` (ANSI escape sequences use `\033`, which TS rejects as octal escapes).
- Some command features are placeholder-level today:
  - `/cost` returns static zero values.
  - `/config` reports that changes are not yet persisted from the command path.
- Documentation is still minimal in `docs/` and does not fully describe real architecture and production readiness.

### Readiness summary

- Core prototype: **Yes, implemented**
- Production-ready/stable release: **No, not yet**
- Overall status: **MVP / in progress**

## Recommended next steps to reach "ready"

1. Fix typecheck errors in `src/main.tsx` (ANSI escape sequences).
2. Complete `/config` persistence wiring and `/cost` real token/cost tracking.
3. Expand architecture and usage docs to match actual behavior.
4. Add tests (unit + integration for tools/commands).
5. Run full validation pipeline (`typecheck`, `lint`, build) in CI.

---

This description is based on current repository contents and command results as of 21 April 2026.
