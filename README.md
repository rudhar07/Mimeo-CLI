# Mimeo CLI

A conversational AI agent that runs in your terminal and clones websites from natural language instructions — built for Assignment 02 of the Scaler GenAI course.

> Status: 🚧 in active development — see commit history for progress.

## What it does

You chat with the agent in the terminal. It reasons step-by-step (START → THINK → TOOL → OBSERVE → OUTPUT) and writes real HTML / CSS / JS files to disk. The headline use case: ask it to clone the Scaler Academy website and watch it generate a working page with a header, hero section, and footer.

## Quickstart

> Detailed setup will appear here once the project is feature-complete.

```bash
npm install
cp .env.example .env   # then edit .env and paste your OpenAI key
npm start
```

## Roadmap

- [x] Project scaffold
- [ ] OpenAI client + minimal agent
- [ ] Reasoning loop with structured outputs
- [ ] Filesystem tools (writeFile, makeDir, readFile, listFiles, exec)
- [ ] Interactive REPL with colored output
- [ ] Specialized prompt for Scaler clone
- [ ] Final docs + demo

## License

MIT
