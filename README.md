# AI Interview Agent — 31-Day AI Cohort

An adaptive, multi-turn technical interviewer for graduates of the 31-day enterprise AI
engineering cohort (RAG, vector DBs, prompt engineering, agentic AI, MCP, deployment,
production AI).

- **Frontend:** React + TanStack Start + Tailwind (dark theme).
- **Backend:** TanStack server route (`src/routes/api/interview.ts`) + in-memory session store with a 2h TTL.
- **LLM:** Lovable AI Gateway (`openai/gpt-5.6-sol`), called server-side only. The API key never reaches the browser.
- **Data:** `src/data/curriculum.json`, `src/data/candidates.json`.

## How the interview works

1. **Plan** — on start, the candidate's missions are joined to the curriculum. Only days they
   **passed** are eligible. Weighting favours high-attempt days (shaky mastery), BUILD/AI_CORE/capstone
   days, and their job role. Skipped days are excluded from assessment and may be mentioned once at
   the end as a growth area.
2. **Turns** — each turn the model receives the full transcript, the candidate profile, the remaining
   plan, and every question already asked, then either follows up on the last answer or moves to a new
   day. A normalized Jaccard similarity check regenerates any question too close to a previous one.
3. **Silent scoring** — every answer is stored with `{correctness, depth, specificity, communication}`
   plus a one-line note. Nothing is shown mid-interview.
4. **End** — after ≥8 answers across ≥4 distinct curriculum days, or when the candidate asks to stop.
5. **Feedback** — generated from the stored per-answer notes and transcript, so every strength/gap
   cites something the candidate actually said.

## API

`POST /api/interview` — no auth. Returns `400` on a missing `sessionId`, `404` on an unknown session.

### 1. Start

```bash
curl -s -X POST http://localhost:8080/api/interview \
  -H 'Content-Type: application/json' \
  -d '{"sessionId":"abc-123","candidate":'"$(node -e 'console.log(JSON.stringify(require("./src/data/candidates.json").candidates[0]))')"'}'
```

```json
{ "reply": "Hi Sarah — let's talk through what you built...", "done": false }
```

### 2. Turn

```bash
curl -s -X POST http://localhost:8080/api/interview \
  -H 'Content-Type: application/json' \
  -d '{"sessionId":"abc-123","message":"We chunked at 500 tokens with 80 token overlap..."}'
```

```json
{ "reply": "Interesting — why 80 tokens of overlap specifically?", "done": false }
```

### 3. End

```json
{
  "reply": "Interview completed.",
  "done": true,
  "feedback": {
    "summary": "...",
    "strengths": ["..."],
    "gaps": ["..."],
    "next": ["..."]
  }
}
```

## Demo script

Runs a complete interview against the live endpoint and prints the final feedback:

```bash
node scripts/demo-interview.mjs http://localhost:8080
```
