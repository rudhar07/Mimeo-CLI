import "dotenv/config";
import { OpenAI } from "openai";

const client = new OpenAI({
  baseURL: process.env.OPENAI_BASE_URL || undefined,
  maxRetries: 5,
  timeout: 60_000,
});

const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

const SYSTEM_PROMPT = `
You are an AI assistant that solves tasks by reasoning step-by-step in a structured loop.

Each reply MUST be a single JSON object — no surrounding prose, no markdown fences.

Schema:
{ "step": "START" | "THINK" | "TOOL" | "OBSERVE" | "OUTPUT",
  "content": "string",
  "tool_name": "string (only when step is TOOL)",
  "tool_args": "string (only when step is TOOL)" }

The 5 steps:
- START   : Restate the user's goal in your own words. Use exactly once at the very start.
- THINK   : Reason about the next action. Produce 2-4 THINK steps before acting.
- TOOL    : Request a tool call. (No tools are wired up yet — placeholder for now.)
- OBSERVE : You will receive this from the system after a tool runs. Never produce OBSERVE yourself.
- OUTPUT  : Final answer to the user. Use exactly once at the end.

Rules:
1. One JSON object per reply.
2. Always begin with START, end with OUTPUT.
3. Multiple THINK steps are encouraged — show your reasoning.
4. If a tool is unavailable, skip TOOL and reason your way to OUTPUT.

Example:
user: What is 12 * 7?
assistant: { "step": "START", "content": "User wants the product of 12 and 7." }
assistant: { "step": "THINK", "content": "This is mental math; 12 * 7 = 12 * 7." }
assistant: { "step": "THINK", "content": "12 * 7 = (10 * 7) + (2 * 7) = 70 + 14 = 84." }
assistant: { "step": "OUTPUT", "content": "12 * 7 = 84." }
`.trim();

function safeParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

function logStep(parsed) {
  const step = parsed.step ?? "?";
  const content = parsed.content ?? "";
  const labels = {
    START: "[START ]",
    THINK: "[THINK ]",
    TOOL: "[TOOL  ]",
    OBSERVE: "[OBSERV]",
    OUTPUT: "[OUTPUT]",
  };
  const label = labels[step] ?? `[${step}]`;
  if (step === "TOOL") {
    console.log(`${label} ${parsed.tool_name}(${parsed.tool_args ?? ""})`);
  } else {
    console.log(`${label} ${content}`);
  }
}

async function runAgent(userInput) {
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userInput },
  ];

  const MAX_ITERATIONS = 25;

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
      messages.push({
        role: "user",
        content: JSON.stringify({
          step: "OBSERVE",
          content: "No tools are wired up yet. Reason from existing context to OUTPUT.",
        }),
      });
    }
  }

  console.error(`Hit ${MAX_ITERATIONS} iteration cap without an OUTPUT step.`);
}

async function main() {
  try {
    await runAgent("What is 12 * 7? Please also explain the breakdown.");
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
