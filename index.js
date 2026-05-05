import "dotenv/config";
import { OpenAI } from "openai";

const client = new OpenAI({
  baseURL: process.env.OPENAI_BASE_URL || undefined,
  maxRetries: 5,
  timeout: 60_000,
});

const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

async function main() {
  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: "user", content: "Say hello in one short sentence." },
      ],
    });

    console.log(response.choices[0].message.content);
  } catch (err) {
    if (err.status === 503) {
      console.error("Provider is overloaded (503). Try again in a moment, or switch model in .env to gemini-2.0-flash.");
    } else if (err.status === 401) {
      console.error("Auth failed (401). Check OPENAI_API_KEY in .env.");
    } else {
      console.error(`Request failed: ${err.message}`);
    }
    process.exit(1);
  }
}

main();
