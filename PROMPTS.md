# AI Usage Log

This project was built with AI assistance across an initial build prompt and several follow-up
prompts used to diagnose and fix bugs found during testing. Below is the full sequence.

---

## 1. Initial Build Prompt

Build: AI Interview Agent (31-Day AI Cohort)

Build a full-stack web app that conducts realistic, personalized, multi-turn technical interviews for graduates of a 31-day enterprise AI engineering cohort (RAG, vector DBs, prompt engineering, agentic AI, MCP, deployment, production AI).

Stack: Node.js + Express (or Next.js API routes) backend, React + Tailwind frontend, single LLM provider via server-side API key stored in Replit Secrets. Never expose the key to the browser.

Input data (place in /data):
- curriculum.json — 8 modules, 31 days, each day has day, title, type, tools[], objectives[]
- candidates.json — array of { member: {id, name, jobRole, yearsExperience, education, status}, missions: [{day, title, passed, attempts, skipped}], signals: {commitDays, missionsCompleted, missionsFirstTry} }

Required HTTP endpoint — implement exactly:

POST /api/interview (no auth)
1. Start: body { sessionId, candidate } → { reply, done: false }
2. Turn: body { sessionId, message } → { reply, done: false }
3. End: { reply: "Interview completed.", done: true, feedback: { summary: string, strengths: string[], gaps: string[], next: string[] } }

State is keyed by sessionId and held server-side (in-memory Map is fine; include a TTL). Validate bodies; return 400 on missing sessionId, 404 on unknown session for a turn. The endpoint must work standalone via curl, independent of the UI.

Interview logic (this is the core — do not build a scripted questionnaire):
- On start, build an interview plan from the candidate: join their missions to curriculum.json days, and select topics only from days they completed/passed. Weight selection toward: high-attempt days (shaky mastery), capstone/build days, and their jobRole. Explicitly exclude skipped days from assessment, but you may mention one skipped topic at the end as a growth area.
- Plan must cover at least 4 distinct curriculum days and produce at least 8 questions total.
- Maintain an askedQuestions[] and coveredDays[] list in session state. No repeats: pass the full list of already-asked questions into every prompt with an instruction to never re-ask or rephrase a prior question; additionally normalize + similarity-check each new question against the asked list and regenerate if too close.
- Each turn: the LLM sees the full conversation transcript, the candidate profile, the remaining plan, and the asked-questions list, then either (a) asks a follow-up drilling into the answer just given, or (b) transitions to the next planned day. Aim ~40% follow-ups, ~60% new topics, decided by the model based on answer quality.
- Score each answer silently as it comes in: store {questionId, day, topic, answer, rubric: {correctness, depth, specificity, communication}, note} in session state. Never show scores mid-interview.
- Interviewer persona: warm, senior engineer, one question at a time, short conversational replies, acknowledges the answer before moving on, never lectures. Handles "I don't know" gracefully.
- End after the plan is exhausted (min 8 answered questions, ≥4 days) or when the candidate asks to stop.

Final feedback — must be an analysis of the actual answers, not the profile: Generate feedback from the stored per-answer rubric notes + transcript. Every strengths and gaps item must reference something the candidate actually said. next = 3–5 concrete, actionable prep steps. Reject/regenerate any feedback that reads as generic.

UI/UX — dark theme, clean, interactive:
- Landing: candidate picker (cards from candidates.json) showing name, role, years, completion stats; "Start Interview" button.
- Interview screen: chat transcript, distinct interviewer/candidate turns, auto-scroll, typing indicator, textarea composer, Enter to send.
- Header progress: "Question 3 of 8+" and chips for curriculum days covered so far.
- Report screen: summary card, Strengths / Gaps / Next Steps columns, per-question review accordion, copy-to-clipboard and download-JSON buttons.
- Palette: near-black background (#0B0D10), elevated surfaces (#14171C), one accent (teal or amber), high-contrast text.

Also include: graceful error states for rate limit / API failure, a README.md with curl examples for all three endpoint phases, and a seed/demo script that runs a full 8-question interview against the API.

---

## 2. Follow-up Fix — Repeated Questions

During testing, the interview began repeating the exact same question verbatim after the planned
topic list was exhausted. Diagnosed the cause as an out-of-bounds index in the fallback question
generator falling back to the same last topic every time. Prompted the following fix:

- Replace index-based topic selection with logic that always selects the next unused topic from
  session.topics, marking it as asked immediately.
- Once all planned topics are exhausted, generate a genuinely new deepening follow-up on the last
  topic instead of repeating a prior question verbatim.
- Widen the topic plan (more strong/shaky/gap topics included) so the 8-question / 4-day minimum
  is comfortably met without relying on the exhaustion fallback path.

---

## 3. Follow-up Fix — Feedback Not Based on Real Answers

Testing also surfaced that the final feedback report could describe "strengths" and "gaps" even in
a session where no real answers were given — because the fallback feedback generator was built
entirely from the candidate's pre-existing cohort profile (candidates.json), not the actual
conversation transcript. Prompted the following fix:

- Check session history for real candidate answers before generating any performance claims.
- If zero answers were given, return a feedback object that explicitly states no assessment could
  be made, rather than fabricating strengths/gaps from the profile.
- Ensure the primary feedback path (successful LLM call) is prompted to ground every strengths/gaps
  item in something the candidate specifically said in that session, referencing real answer content
  and day numbers — not just their historical mission record.

---

## 4. Follow-up Fix — Silent LLM Failures

Root-caused both bugs above to the same underlying issue: the server-side call to the LLM API was
failing silently (e.g. missing/invalid API key) and falling through to hardcoded fallback logic
without any visible error. Prompted the following fix:

- Add explicit console logging any time the LLM call fails — missing API key, non-OK HTTP response,
  or thrown exception — so failures are never silent.
- Add a server-side validation step on generated feedback: check that strengths/gaps items reference
  concrete details from stored per-answer records before accepting them; regenerate or flag if not.
- Verified via: (1) testing with an intentionally invalid API key to confirm errors now log clearly,
  and (2) running a full interview end-to-end and confirming feedback references specific real
  answers from that session.

---

## Notes

- All prompts above were used within the AI-assisted build environment (Lovable/Replit) to generate
  and iteratively fix the application code.
- Data files (curriculum.json, candidates.json) and technical-spec.md were provided as-is per the
  challenge brief and were not modified.
