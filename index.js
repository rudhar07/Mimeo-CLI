import "dotenv/config";
import { OpenAI } from "openai";
import fs from "fs/promises";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import readline from "readline/promises";
import { stdin as input, stdout as output } from "process";
import chalk from "chalk";

const execAsync = promisify(exec);

const client = new OpenAI({
  baseURL: process.env.OPENAI_BASE_URL || undefined,
  maxRetries: 5,
  timeout: 120_000,
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

// ─── Domain knowledge: Scaler Academy ─────────────────────────────
const SCALER_KNOWLEDGE = `
Scaler Academy (scaler.com) — visual + structural notes for cloning:

Brand identity:
- LIGHT / WHITE theme. Primary background is white (#FFFFFF) and very light gray (#F5F7FA).
- Primary accent: bold blue (#0052CC) used for CTA buttons, headings, and links.
- Secondary accent: cyan/teal (#00C4CC) used alongside blue for gradient text effects.
- Dark navy (#001A3F) used for the sticky bottom contact bar.
- Text: near-black (#1A1A2E) for body, dark gray (#555) for subtitles.
- Font: "Inter", system-ui, -apple-system, sans-serif. Bold uppercase for nav.
- Generous spacing, very large headlines (4-5rem), clean and minimal.
- Subtle geometric line patterns (thin diagonal/radial lines) on the hero background.

Page structure (top to bottom):

1. HEADER (sticky, white background, subtle bottom border):
   - Left: "SCALER" bold wordmark in dark navy/black, with a small blue arrow-box icon.
   - Center: nav links in uppercase — PROGRAM, MASTERCLASS, AI LABS, ALUMNI, RESOURCES.
   - Far right: "Login" outlined button (border, no fill) + "PLACEMENT REPORT" CTA button (solid blue #0052CC, white text, bold uppercase).
   - Height ~70px, padding 0 40px.

2. HERO (full-width, light background #F5F7FA with subtle geometric line pattern):
   - Small top banner line: "THE MARKET HAS ALREADY CHANGED >" in blue uppercase.
   - MASSIVE bold headline (~4-5rem): "Become the Professional Built for the Next Decade in AI."
     - "Become the Professional" and "for the" in dark navy/black.
     - "Built" has a light blue/cyan highlight box behind it.
     - "Next Decade in AI." uses a gradient from blue (#0052CC) to cyan (#00C4CC).
   - Subheadline (~1.1rem, gray #555): "The investment that compounds. Strong technical foundations, AI integrated at every stage, and a curriculum that evolves as the market does"
   - Below: a horizontal scrollable program tabs bar labeled "PROGRAMS" with items: "Modern Software and AI engineering", "Modern Data Science and ML with Specialisation in AI", "Advanced AIML with Agentic AI", "DevOps, Cloud & AI Platform Engineering".
   - Below tabs: Two CTA buttons — "Request A Callback" (solid blue) and "Book Free Live Class" (outlined blue).

3. FEATURES / WHY SCALER section:
   - Section heading: "Why Scaler" subheading + "Four things no other program gives you".
   - 4 feature cards in a grid:
     a. AI-Integrated Curriculum
     b. AI Powered Platform
     c. Lifelong Learning Access
     d. Strong Foundations
   - Each card: bold title, paragraph description, subtle hover lift effect.
   - Below: logos strip "AI-first curriculum built by 100+ engineers from" with company logos.

4. PROGRAMS section:
   - Tabbed interface showing each program with details, ratings, "Go To Program" blue button, "download brochure" link.
   - Programs: Modern Software & AI Engineering (25K+ Ratings), Data Science & ML, DevOps Cloud & AI Platform Engineering, Advanced AIML with Agentic AI.

5. FOOTER (white/light background):
   - Top: Scaler logo + address + Google Play QR code.
   - Multi-column links: "Explore Scaler" (program links), "Resources" (Alumni Reviews, Blogs, Contact, Careers), "Others" (About, Mentor, TA, Hire, Terms, Privacy), "Socials" (YouTube, LinkedIn, Facebook, Instagram, Twitter).
   - Below: "Trending Courses" links, "Tutorial" links, "Career Advice Resources" links — all in blue headings with gray text links.
   - Large "#CreateImpact" watermark text in very light gray.
   - Copyright: "© 2026 InterviewBit Software Services Pvt. Ltd. All Rights Reserved."
   - Sticky dark navy bar at very bottom: "Need help? Talk to us at 08047939623 or Request a Call ↗"

CSS implementation guidance:
- Use CSS custom properties: --brand-blue: #0052CC; --brand-cyan: #00C4CC; --dark-navy: #001A3F; --bg-light: #F5F7FA; --text-dark: #1A1A2E; --text-gray: #555;
- Use semantic HTML5: <header>, <section class="hero">, <main>, <section class="features">, <section class="programs">, <footer>.
- Hero headline gradient text: background: linear-gradient(135deg, #0052CC, #00C4CC); -webkit-background-clip: text; color: transparent;
- Header box-shadow: 0 1px 3px rgba(0,0,0,0.08);
- Cards: white bg, border-radius 12px, box-shadow 0 2px 12px rgba(0,0,0,0.06), padding 2rem.
- Make it responsive: max-width container ~1200px, mobile breakpoint at 768px.
- Add scroll-reveal animations in script.js + smooth hover transitions.
- No external libraries (no jQuery, no React) — pure HTML/CSS/JS.
- Target 200-350 lines of CSS for a polished result.
`.trim();

// ─── System prompt ────────────────────────────────────────────────
const toolsListing = Object.entries(tools)
  .map(([name, t], i) => `${i + 1}. ${name}  args: ${t.schema}\n   ${t.description}`)
  .join("\n\n");

const SYSTEM_PROMPT = `
You are Mimeo, an AI assistant that solves tasks by reasoning step-by-step in a structured loop.
Your specialty is generating real, working websites by writing files to disk via tools.

Each reply MUST be a single JSON object — no surrounding prose, no markdown fences, no triple backticks.

Schema:
{
  "step":      "START" | "THINK" | "TOOL" | "OBSERVE" | "OUTPUT",
  "content":   "string (used for START, THINK, OUTPUT)",
  "tool_name": "string (only when step is TOOL)",
  "tool_args": object (only when step is TOOL — see each tool's schema)
}

Steps:
- START   : Restate the goal. Use exactly once at the start of each new user request.
- THINK   : Reason about the next action. Produce 2-4 THINK steps before acting.
- TOOL    : Request a tool call.
- OBSERVE : System gives you the tool's result. Never produce yourself.
- OUTPUT  : Final answer. Use exactly once at the end.

Available tools:

${toolsListing}

Rules:
1. One JSON object per reply — JSON only, no extra text.
2. Always begin a request with START, end with OUTPUT.
3. Use 2-4 THINK steps before each TOOL call.
4. Prefer dedicated tools (writeFile, makeDir, readFile, listFiles) over executeCommand.
5. Use relative paths only — no leading "/" or "C:\\". All files are written into the current working directory.
6. After each TOOL, wait for the OBSERVE result before continuing.
7. If a tool fails, read the error and adjust.

Web-building conventions:
- For a website, ALWAYS split into separate files: index.html, style.css, script.js.
- Link the stylesheet via <link rel="stylesheet" href="style.css"> in <head>.
- Link the script via <script src="script.js" defer></script> at end of <head> or before </body>.
- Import Google Font "Inter" in <head>: <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
- Write files in this order: index.html → style.css → script.js.
- Never inline more than ~5 lines of CSS/JS in HTML; put it in the dedicated file.
- Use semantic HTML5 elements (<header>, <main>, <section>, <footer>).
- Make CSS modern: flexbox/grid, CSS variables for colors, responsive breakpoints.
- Write COMPLETE files in each TOOL call — never write partial content expecting to append later.
- Aim for 250-400 lines of CSS for a polished page; don't write a bare-minimum sheet.
- Aim for 150+ lines of well-structured HTML with real content (not lorem ipsum).

${SCALER_KNOWLEDGE}

Example (small task):
user: Create a folder named "demo" and write hello.txt inside it with "hi".
assistant: { "step": "START", "content": "User wants a folder 'demo' containing hello.txt with 'hi'." }
assistant: { "step": "THINK", "content": "writeFile creates parent dirs automatically, so I can do this in one call." }
assistant: { "step": "TOOL", "tool_name": "writeFile", "tool_args": { "path": "demo/hello.txt", "content": "hi" } }
assistant: { "step": "OUTPUT", "content": "Created demo/hello.txt with 'hi'." }
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

const stepStyles = {
  START:   chalk.bold.cyan,
  THINK:   chalk.yellow,
  TOOL:    chalk.magenta,
  OBSERVE: chalk.blue,
  OUTPUT:  chalk.bold.green,
};

function logStep(parsed) {
  const color = stepStyles[parsed.step] ?? chalk.white;
  const label = color(`[${(parsed.step ?? "?").padEnd(6)}]`);
  if (parsed.step === "TOOL") {
    const argsStr = JSON.stringify(parsed.tool_args ?? {});
    console.log(`${label} ${chalk.bold(parsed.tool_name)} ${chalk.dim(truncate(argsStr, 120))}`);
  } else {
    console.log(`${label} ${truncate(parsed.content ?? "")}`);
  }
}

function logObserve(result) {
  console.log(`${chalk.blue("[OBSERV]")} ${chalk.dim(truncate(result))}`);
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── Agent turn ───────────────────────────────────────────────────
async function runAgentTurn(messages) {
  const MAX_ITERATIONS = 80;
  // Free Gemini tier = 15 req/min. Sleep between iterations to stay safely under that.
  const STEP_DELAY_MS = 4500;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    if (i > 0) await sleep(STEP_DELAY_MS);

    const response = await client.chat.completions.create({
      model,
      messages,
      response_format: { type: "json_object" },
      max_tokens: 8192,
    });

    const raw = response.choices[0].message.content;
    const parsed = safeParse(raw);

    if (!parsed) {
      console.error(chalk.red("Model returned non-JSON. Aborting turn.\nRaw:"), raw);
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
      logObserve(observation);
    }
  }

  console.error(chalk.red(`Hit ${MAX_ITERATIONS} iteration cap without OUTPUT.`));
}

function printError(err) {
  if (err.status === 503) {
    console.error(chalk.red("Provider overloaded (503). Retry, or switch model in .env."));
  } else if (err.status === 429) {
    console.error(chalk.red("Rate limit hit (429). Free tier allows 15 req/min — wait ~60s and retry."));
  } else if (err.status === 401) {
    console.error(chalk.red("Auth failed (401). Check OPENAI_API_KEY in .env."));
  } else {
    console.error(chalk.red(`Request failed: ${err.message}`));
  }
}

// ─── Banner ───────────────────────────────────────────────────────
function banner() {
  const title = chalk.bold.cyan("Mimeo CLI");
  const subtitle = chalk.dim("conversational website-cloning agent");
  console.log("");
  console.log(`  ${title}  ${subtitle}`);
  console.log(chalk.dim(`  model: ${model}`));
  console.log(chalk.dim('  type your request, "exit" to quit, "/clear" to reset memory'));
  console.log("");
}

// ─── Entry point: interactive REPL ────────────────────────────────
async function main() {
  banner();
  const rl = readline.createInterface({ input, output });

  const messages = [{ role: "system", content: SYSTEM_PROMPT }];

  rl.on("SIGINT", () => {
    console.log(chalk.dim("\nbye."));
    rl.close();
    process.exit(0);
  });

  while (true) {
    let userInput;
    try {
      userInput = (await rl.question(chalk.bold.green("you > "))).trim();
    } catch {
      return;
    }
    if (!userInput) continue;
    if (["exit", "quit", ":q"].includes(userInput.toLowerCase())) {
      console.log(chalk.dim("bye."));
      rl.close();
      return;
    }
    if (userInput.toLowerCase() === "/clear") {
      messages.length = 1;
      console.log(chalk.dim("conversation cleared."));
      continue;
    }

    messages.push({ role: "user", content: userInput });

    try {
      await runAgentTurn(messages);
    } catch (err) {
      printError(err);
    }
    console.log("");
  }
}

main();
