import "dotenv/config";
import { OpenAI } from "openai";
import fs from "fs/promises";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const client = new OpenAI({
  baseURL: process.env.OPENAI_BASE_URL || undefined,
  maxRetries: 5,
  timeout: 60_000,
});

const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

// ─── Tool registry ────────────────────────────────────────────────
const tools = {
  writeFile: {
    description: "Write content to a file. Creates parent directories if missing. Overwrites existing files.",
    schema: '{ "path": "relative/file.html", "content": "<html>...</html>" }',
    run: async ({ path: filePath, content }) => {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, content, "utf8");
      return `Wrote ${Buffer.byteLength(content, "utf8")} bytes to ${filePath}`;
    },
  },

  makeDir: {
    description: "Create a directory (recursive — parents created automatically).",
    schema: '{ "path": "relative/folder/path" }',
    run: async ({ path: dirPath }) => {
      await fs.mkdir(dirPath, { recursive: true });
      return `Created directory ${dirPath}`;
    },
  },

  readFile: {
    description: "Read and return the full text contents of a file.",
    schema: '{ "path": "relative/file.html" }',
    run: async ({ path: filePath }) => {
      return await fs.readFile(filePath, "utf8");
    },
  },

  listFiles: {
    description: "List entries (files + folders) inside a directory.",
    schema: '{ "path": "relative/folder" }',
    run: async ({ path: dirPath }) => {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      if (entries.length === 0) return "(empty directory)";
      return entries
        .map((e) => (e.isDirectory() ? `${e.name}/` : e.name))
        .join("\n");
    },
  },

  executeCommand: {
    description: "Run a shell command and return stdout + stderr. Use sparingly — prefer the dedicated tools above.",
    schema: '{ "cmd": "node --version" }',
    run: async ({ cmd }) => {
      const { stdout, stderr } = await execAsync(cmd);
      return `stdout:\n${stdout}\nstderr:\n${stderr}`;
    },
  },
};

// ─── System prompt ────────────────────────────────────────────────
const toolsListing = Object.entries(tools)
  .map(([name, t], i) => `${i + 1}. ${name}${t.schema ? `  args: ${t.schema}` : ""}\n   ${t.description}`)
  .join("\n\n");

const SYSTEM_PROMPT = `
You are an AI assistant that solves tasks by reasoning step-by-step in a structured loop.

Each reply MUST be a single JSON object — no surrounding prose, no markdown fences.

Schema:
{
  "step":      "START" | "THINK" | "TOOL" | "OBSERVE" | "OUTPUT",
  "content":   "string (used for START, THINK, OUTPUT)",
  "tool_name": "string (only when step is TOOL)",
  "tool_args": object (only when step is TOOL — see each tool's schema)
}

Steps:
- START   : Restate the goal. Use exactly once at the start.
- THINK   : Reason about the next action. Produce 2-4 THINK steps before acting.
- TOOL    : Request a tool call.
- OBSERVE : System gives you the tool's result. Never produce yourself.
- OUTPUT  : Final answer to the user. Use exactly once at the end.

Available tools:

${toolsListing}

Rules:
1. One JSON object per reply.
2. Always begin with START, end with OUTPUT.
3. Use 2-4 THINK steps before each TOOL call.
4. Prefer dedicated tools (writeFile, makeDir, readFile, listFiles) over executeCommand.
5. Use relative paths only — no leading "/" or "C:\\". All files write into the current working directory.
6. After each TOOL, wait for the OBSERVE result before continuing.
7. If a tool fails, read the error and adjust — do not give up immediately.

Example:
user: Create a folder named "demo" and write hello.txt inside it with the text "hi".
assistant: { "step": "START", "content": "User wants a folder 'demo' containing hello.txt with 'hi'." }
assistant: { "step": "THINK", "content": "writeFile creates parent dirs automatically, so I can do this in a single call." }
assistant: { "step": "TOOL", "tool_name": "writeFile", "tool_args": { "path": "demo/hello.txt", "content": "hi" } }
[system observe will arrive here]
assistant: { "step": "OUTPUT", "content": "Created demo/hello.txt with the text 'hi'." }
`.trim();

// ─── Helpers ──────────────────────────────────────────────────────
function safeParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch { return null; }
    }
    return null;
  }
}

function truncate(str, max = 200) {
  if (typeof str !== "string") return String(str);
  return str.length > max ? `${str.slice(0, max)}… (${str.length} chars)` : str;
}

function logStep(parsed) {
  const labels = {
    START: "[START ]",
    THINK: "[THINK ]",
    TOOL: "[TOOL  ]",
    OBSERVE: "[OBSERV]",
    OUTPUT: "[OUTPUT]",
  };
  const label = labels[parsed.step] ?? `[${parsed.step}]`;
  if (parsed.step === "TOOL") {
    const argsStr = JSON.stringify(parsed.tool_args ?? {});
    console.log(`${label} ${parsed.tool_name}(${truncate(argsStr, 120)})`);
  } else {
    console.log(`${label} ${truncate(parsed.content ?? "")}`);
  }
}

async function runTool(parsed) {
  const tool = tools[parsed.tool_name];
  if (!tool) return `Error: tool "${parsed.tool_name}" not found. Available: ${Object.keys(tools).join(", ")}`;

  let args = parsed.tool_args;
  if (typeof args === "string") {
    try { args = JSON.parse(args); } catch { args = { value: args }; }
  }

  try {
    return await tool.run(args ?? {});
  } catch (e) {
    return `Tool error: ${e.message}`;
  }
}

// ─── Agent loop ───────────────────────────────────────────────────
async function runAgent(userInput) {
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userInput },
  ];

  const MAX_ITERATIONS = 50;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await client.chat.completions.create({
      model,
      messages,
      response_format: { type: "json_object" },
    });

    const raw = response.choices[0].message.content;
    const parsed = safeParse(raw);

    if (!parsed) {
      console.error("Model returned non-JSON. Aborting.\nRaw:", raw);
      return;
    }

    messages.push({ role: "assistant", content: JSON.stringify(parsed) });
    logStep(parsed);

    if (parsed.step === "OUTPUT") return;

    if (parsed.step === "TOOL") {
      const observation = await runTool(parsed);
      messages.push({
        role: "user",
        content: JSON.stringify({ step: "OBSERVE", content: observation }),
      });
      console.log(`[OBSERV] ${truncate(observation)}`);
    }
  }

  console.error(`Hit ${MAX_ITERATIONS} iteration cap without OUTPUT.`);
}

// ─── Entry point ──────────────────────────────────────────────────
async function main() {
  try {
    await runAgent(
      'Create a folder named "demo_test" and write a file hello.txt inside it containing the text "hello world from the agent".',
    );
  } catch (err) {
    if (err.status === 503) {
      console.error("Provider overloaded (503). Retry, or switch model in .env.");
    } else if (err.status === 401) {
      console.error("Auth failed (401). Check OPENAI_API_KEY in .env.");
    } else {
      console.error(`Request failed: ${err.message}`);
    }
    process.exit(1);
  }
}

main();
