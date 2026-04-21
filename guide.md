# Reo Agent User Guide

## 1. Overview

Reo Agent is an advanced AI-powered terminal coding assistant built with TypeScript and Bun. It provides a seamless interactive experience for developers, allowing you to manage your codebase through natural language.

Key capabilities:
- **Multi-Provider Support**: Switch between Anthropic, OpenAI, and Google AI Studio.
- **Local Models**: Run private models locally via Ollama and Docker.
- **File Operations**: Read, write, and edit files using AI-driven tool calls.
- **Shell Integration**: Execute bash commands directly from the chat.
- **Code Intelligence**: Search your project using advanced glob and grep patterns.

## 2. Requirements

- **Bun**: Latest stable version.
- **Docker & Docker Compose**: (Optional) Required for running local models via Ollama.
- **API Keys**: At least one key from Anthropic, OpenAI, or Google AI Studio.

## 3. Installation

From the project root:

```bash
# Install dependencies
bun install

# Build the project
bun run build

# Start in development mode
bun run dev
```

## 4. Configuring AI Providers

Reo Agent supports multiple providers. You can configure them via environment variables or a configuration file.

### Option A: Environment Variables

```bash
export ANTHROPIC_API_KEY=your_key
export OPENAI_API_KEY=your_key
export GOOGLE_API_KEY=your_key
```

### Option B: Configuration File
Create or edit `~/.config/reo-agent/config.yaml`:

```yaml
provider: google # Options: anthropic, openai, google, ollama
model: gemini-1.5-flash # Optional: defaults are set per provider
apiKey: your_primary_key
openaiApiKey: your_openai_key
googleApiKey: your_google_key
ollamaBaseUrl: http://localhost:11434
maxTokens: 8192
temperature: 0.7
```

## 5. Using Local Models (Ollama)

Reo Agent is Docker-ready for local model execution, ensuring privacy and performance.

1. **Start the Ollama container**:
   ```bash
   docker-compose up -d ollama
   ```

2. **Pull a model** (e.g., llama3):
   ```bash
   ./scripts/setup-ollama.sh
   ```

3. **Run Reo with Ollama**:
   ```bash
   reo --provider ollama --model llama3
   ```

## 6. CLI Usage & Commands

### Interactive Mode
```bash
# Default (uses config or Anthropic)
reo

# Specific Provider
reo --provider google --model gemini-1.5-flash
reo --provider openai --model gpt-4o
```

### Direct Message
```bash
reo -m "Refactor the authentication logic in src/auth.ts"
```

### Slash Commands (Inside Chat)
- `/help`: List all available commands.
- `/config`: View or update settings (e.g., `/config temperature 0.5`).
- `/doctor`: Check system health and API connectivity.
- `/cost`: View token usage and estimated session costs.
- `/clear`: Reset the current conversation history.

## 7. Development & Health Checks

Keep your Reo instance healthy by running these commands:

```bash
bun run typecheck   # Check for TypeScript errors
bun run lint        # Ensure code style consistency
bun test            # Run the test suite
bun run build       # Verify the build process
```

## 8. Troubleshooting

- **API Errors**: Ensure your keys are correctly set in the environment or `config.yaml`. Use `/doctor` to diagnose connection issues.
- **Ollama Connection**: If using Docker, ensure port `11434` is not blocked and the container is running (`docker ps`).
- **Model Not Found**: For Ollama, ensure you have pulled the model using `ollama pull [model_name]` or the provided script.
