#!/usr/bin/env node
/**
 * End-to-end demo: runs a full interview against POST /api/interview.
 * Usage: node scripts/demo-interview.mjs [baseUrl]
 */
import { readFileSync } from "node:fs";

const base = process.argv[2] ?? "http://localhost:8080";
const { candidates } = JSON.parse(readFileSync("src/data/candidates.json", "utf8"));
const candidate = candidates[0];
const sessionId = `demo-${Date.now()}`;

const answers = [
  "We chunked the healthcare PDFs at about 500 tokens with 80 token overlap, embedded them with all-MiniLM-L6-v2, and stored them in Chroma with plan-type metadata so we could filter before the vector search.",
  "We compared cosine similarity against the raw dot product and cosine won because our embeddings weren't length-normalised, so long policy sections were dominating the ranking.",
  "The biggest failure was retrieval returning the right document but the wrong section, so we added section headers into the chunk text itself and recall on our eval set went from roughly 68% to 84%.",
  "For prompting we moved from a long instruction blob to a short system prompt plus few-shot examples, and we forced JSON output with a schema so the frontend never had to parse prose.",
  "Honestly I don't remember the exact numbers for that one.",
  "In the chatbot backend we streamed tokens over SSE from FastAPI, kept per-session history in memory, and truncated to the last 10 turns plus a rolling summary to stay under the context window.",
  "For agents we used a planner tool-caller loop with a step cap of 10 and a retry on tool errors; MCP gave us one protocol so the same tools worked across clients.",
  "We deployed with Docker on Kubernetes, added liveness probes, and logged every request id with latency and token counts so we could trace slow retrievals.",
  "We evaluated with a golden set of 60 questions scored for faithfulness and answer relevance, and we blocked prompt injection by stripping instructions out of retrieved chunks.",
  "The capstone was the full healthcare plan assistant: ingestion, Chroma retrieval, an agent layer for claims lookups, and a React frontend.",
];

async function post(body) {
  const res = await fetch(`${base}/api/interview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`${res.status}: ${JSON.stringify(data)}`);
  return data;
}

let turn = await post({ sessionId, candidate });
console.log(`\n🤖 ${turn.reply}\n`);

for (const answer of answers) {
  if (turn.done) break;
  console.log(`🧑 ${answer}\n`);
  turn = await post({ sessionId, message: answer });
  console.log(`🤖 ${turn.reply}\n`);
}

if (turn.feedback) {
  console.log("===== FEEDBACK =====");
  console.log(JSON.stringify(turn.feedback, null, 2));
} else {
  console.log("Interview did not complete within the scripted answers.");
}
