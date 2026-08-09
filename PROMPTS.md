Build: AI Interview Agent (31-Day AI Cohort)

Build a full-stack web app that conducts realistic, personalized, multi-turn technical interviews for graduates of a 31-day enterprise AI engineering cohort (RAG, vector DBs, prompt engineering, agentic AI, MCP, deployment, production AI).

Stack: Node.js + Express (or Next.js API routes) backend, React + Tailwind frontend, single LLM provider via server-side API key stored in Replit Secrets. Never expose the key to the browser.

Input data (place in /data):

curriculum.json — 8 modules, 31 days, each day has day, title, type, tools[], objectives[]

candidates.json — array of { member: {id, name, jobRole, yearsExperience, education, status}, missions: [{day, title, passed, attempts, skipped}], signals: {commitDays, missionsCompleted, missionsFirstTry} }

Required HTTP endpoint — implement exactly:

POST /api/interview (no auth)

Start: body { sessionId, candidate } → { reply, done: false }

Turn: body { sessionId, message } → { reply, done: false }

End: { reply: "Interview completed.", done: true, feedback: { summary: string, strengths: string[], gaps: string[], next: string[] } }

State is keyed by sessionId and held server-side (in-memory Map is fine; include a TTL). Validate bodies; return 400 on missing sessionId, 404 on unknown session for a turn. The endpoint must work standalone via curl, independent of the UI.

Interview logic (this is the core — do not build a scripted questionnaire):

On start, build an interview plan from the candidate: join their missions to curriculum.json days, and select topics only from days they completed/passed. Weight selection toward: high-attempt days (shaky mastery), capstone/build days, and their jobRole. Explicitly exclude skipped days from assessment, but you may mention one skipped topic at the end as a growth area.

Plan must cover at least 4 distinct curriculum days and produce at least 8 questions total.

Maintain a askedQuestions[] and coveredDays[] list in session state. No repeats: pass the full list of already-asked questions into every prompt with an instruction to never re-ask or rephrase a prior question; additionally normalize + similarity-check each new question against the asked list and regenerate if too close.

Each turn: the LLM sees the full conversation transcript, the candidate profile, the remaining plan, and the asked-questions list, then either (a) asks a follow-up drilling into the answer just given (probe a vague claim, ask "why that tradeoff", ask for a concrete example from their build), or (b) transitions to the next planned day. Aim ~40% follow-ups, ~60% new topics, decided by the model based on answer quality.

Score each answer silently as it comes in: store {questionId, day, topic, answer, rubric: {correctness, depth, specificity, communication}, note} in session state. Never show scores mid-interview.

Interviewer persona: warm, senior engineer, one question at a time, short conversational replies, acknowledges the answer before moving on, never lectures, never dumps bullet lists. Handles "I don't know" gracefully by simplifying or moving on.

End after the plan is exhausted (min 8 answered questions, ≥4 days) or when the candidate asks to stop.

Final feedback — must be an analysis of the actual answers, not the profile: Generate feedback from the stored per-answer rubric notes + transcript. Every strengths and gaps item must reference something the candidate actually said (e.g. "Explained chunking strategy with a concrete 512-token overlap example on Day 9"). next = 3–5 concrete, actionable prep steps. Reject/regenerate any feedback that reads as generic. Return it in the same response as done: true, and also render it in the UI.

UI/UX — dark theme, clean, interactive:

Landing: candidate picker (cards from candidates.json) showing name, role, years, completion stats; "Start Interview" button.

Interview screen: chat transcript, user bubbles distinct from interviewer (interviewer messages on the surface, no loud colored bubble), auto-scroll, typing/thinking indicator while the model responds, textarea composer that stays focused, Enter to send / Shift+Enter newline, disabled send while streaming.

Header progress: "Question 3 of 8+" and chips for curriculum days covered so far.

Report screen: summary card, then Strengths / Gaps / Next Steps columns with icons, plus a per-question review accordion showing the question, the candidate's answer, and the interviewer's note. Copy-to-clipboard and download-JSON buttons.

Palette: near-black background (#0B0D10), elevated surfaces (#14171C), one accent (teal or amber), high-contrast text. Rounded corners, subtle borders, smooth transitions. No purple-on-white gradients, no default Inter-everywhere look.

Responsive and keyboard accessible.

Also include: graceful error states for rate limit / API failure surfaced in the UI, a README.md with curl examples for all three endpoint phases, and a seed/demo script that runs a full 8-question interview against the API to prove it works end-to-end.

