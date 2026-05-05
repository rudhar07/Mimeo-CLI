# Mimeo CLI

**A conversational AI agent that clones websites from natural language instructions, right in your terminal.**

Mimeo is a CLI tool that takes a user's description of a website, reasons through the task step-by-step, and generates fully working HTML, CSS, and JavaScript files — ready to open in a browser.

## ✨ Features

- **Conversational interface** — chat with the agent naturally in your terminal
- **Agentic reasoning loop** — the agent follows a structured `START → THINK → TOOL → OBSERVE → OUTPUT` cycle, breaking complex tasks into manageable steps
- **Real file generation** — writes actual `.html`, `.css`, and `.js` files to disk
- **Multiple tools** — file creation, directory management, file reading, shell commands
- **Multi-provider support** — works with OpenRouter, OpenAI, Google Gemini, or any OpenAI-compatible API
- **Live progress** — watch the agent think, plan, and build in real-time with color-coded output

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- An API key from [OpenRouter](https://openrouter.ai/keys), [OpenAI](https://platform.openai.com/api-keys), or [Google AI Studio](https://aistudio.google.com/apikey)

### Installation

```bash
git clone https://github.com/rudhar07/Mimeo-CLI.git
cd Mimeo-CLI
npm install
```

### Configuration

```bash
cp .env.example .env
```

Edit `.env` and add your API key. The file supports three providers — pick one:

**OpenRouter (recommended — single key, hundreds of models):**
```env
OPENAI_API_KEY=your_openrouter_key_here
OPENAI_MODEL=gpt-4.1-mini
OPENAI_BASE_URL=https://openrouter.ai/api/v1
```
Get a key at [openrouter.ai/keys](https://openrouter.ai/keys). One key gives you access to OpenAI, Anthropic, Google, Meta, DeepSeek, and many more — swap models by editing `OPENAI_MODEL`.

**Google Gemini (free tier):**
```env
OPENAI_API_KEY=your_gemini_key_here
OPENAI_MODEL=gemini-flash-latest
OPENAI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
```

**OpenAI (direct):**
```env
OPENAI_API_KEY=your_openai_key_here
OPENAI_MODEL=gpt-4.1-mini
# OPENAI_BASE_URL=   (leave empty for default)
```

### Usage

```bash
npm start
```

You'll see the Mimeo CLI banner. Type your request:

```
you > Build a landing page for a coffee subscription service with a header, hero, and footer
```

The agent will reason through the task, create files, and produce a working webpage you can open directly in your browser.

### Commands

| Command | Action |
|---------|--------|
| Type any message | Send a request to the agent |
| `/clear` | Reset conversation memory |
| `exit` | Quit the CLI |

## 🏗️ How It Works

Mimeo uses a structured reasoning loop inspired by ReAct (Reasoning + Acting):

```
┌─────────┐
│  START   │  Restate the user's goal
└────┬─────┘
     ▼
┌─────────┐
│  THINK   │  Reason about the next step (2-4 rounds)
└────┬─────┘
     ▼
┌─────────┐
│  TOOL    │  Execute an action (write file, create dir, etc.)
└────┬─────┘
     ▼
┌─────────┐
│ OBSERVE  │  System returns the tool's result
└────┬─────┘
     ▼
   (loop back to THINK, or...)
     ▼
┌─────────┐
│ OUTPUT   │  Final answer to the user
└─────────┘
```

Each response from the model is a single JSON object with a `step` field. The agent loops until it produces an `OUTPUT` step, allowing it to handle complex multi-file tasks naturally.

### Available Tools

| Tool | Purpose |
|------|---------|
| `writeFile` | Write content to a file (creates parent dirs automatically) |
| `makeDir` | Create directories |
| `readFile` | Read file contents |
| `listFiles` | List directory entries |
| `executeCommand` | Run shell commands |

## 🛠️ Tech Stack

- **Runtime:** Node.js (ES Modules)
- **AI:** OpenAI SDK (compatible with GPT-4, Gemini, and other providers)
- **CLI:** Node.js `readline` + [Chalk](https://github.com/chalk/chalk) for colored output
- **Architecture:** ReAct-style agent loop with JSON-structured responses

## 📁 Project Structure

```
mimeo-cli/
├── index.js          # Agent loop, tools, CLI REPL — all in one file
├── package.json
├── .env.example      # Template for API configuration
├── .gitignore
└── README.md
```

## 📄 License

MIT — see [LICENSE](LICENSE) for details.
