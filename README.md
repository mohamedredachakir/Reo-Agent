# Reo Agent 🤖

**Reo Agent** is a professional-grade, AI-powered terminal coding assistant built with TypeScript and Bun. It empowers developers to interact with their codebase using natural language across multiple AI providers and local models.

---

## 🚀 Key Features

- **Multi-Provider Hub**: Support for **Anthropic**, **OpenAI**, and **Google AI Studio (Gemini)**.
- **Local Performance**: Run private models locally via **Ollama** and **Docker**.
- **Autonomous Tools**: AI can read/edit files, run shell commands, and search code.
- **High Performance**: Built on **Bun** for blazing-fast execution and low latency.
- **Interactive REPL**: A beautiful, terminal-based chat interface with streaming support.

---

## 🛠️ Step-by-Step Setup

### 1. Installation
Clone the repository and install dependencies using Bun:

```bash
git clone https://github.com/mohamedredachakir/Reo-Agent.git
cd reo-agent
bun install
```

### 2. Configure Your AI Provider
You can set up your preferred AI provider in two ways:

#### Option A: Environment Variables (Quickest)
```bash
export ANTHROPIC_API_KEY="your-key"
# OR
export OPENAI_API_KEY="your-key"
# OR
export GOOGLE_API_KEY="your-key"
```

#### Option B: Configuration File
You can set configuration via the CLI:
```bash
reo /config provider google
reo /config googleApiKey your-key
reo /config model gemini-1.5-flash
```

Or manually edit `~/.config/reo-agent/config.yaml`:
```yaml
provider: google # anthropic, openai, google, or ollama
googleApiKey: your-google-key
openaiApiKey: your-openai-key
apiKey: your-anthropic-key
model: gemini-1.5-flash
```

### 3. Running Local Models (Ollama)
If you prefer running models locally for privacy and no cost:

1. **Start Ollama with Docker**:
   ```bash
   docker-compose up -d ollama
   ```
2. **Setup your model**:
   ```bash
   ./scripts/setup-ollama.sh
   ```

---

## 💻 Usage

### Start Interactive Chat
```bash
# Start with your default provider
reo

# Start with a specific provider and model
reo --provider google --model gemini-1.5-flash
reo --provider ollama --model llama3
```

### One-Off Tasks
```bash
reo -m "Write a unit test for the QueryEngine class"
```

### In-Chat Commands
While chatting with Reo, you can use **Slash Commands**:
- `/help`: See all available tools and commands.
- `/config`: Change settings on the fly.
- `/doctor`: Run a diagnostic check on your environment.
- `/clear`: Clear the chat history.

---

## 🧪 Development & Quality

Ensure the project is running perfectly on your machine:

```bash
bun run typecheck   # Validate TypeScript types
bun run lint        # Check code style
bun test            # Run internal tests
bun run build       # Verify production build
```

---

## 📄 License
This project is licensed under the MIT License.

## 🤝 Contributing
Contributions are welcome! Please feel free to submit a Pull Request.
