import { z } from "zod";
import curriculum from "@/data/curriculum.json";
import type {
  Candidate,
  CurriculumDay,
  PlanItem,
  Feedback,
  ScoredAnswer,
  Session,
} from "@/lib/interview-types";

const MODEL = "claude-sonnet-4-5";
const SESSION_TTL_MS = 1000 * 60 * 60 * 2; // 2 hours
const MIN_QUESTIONS = 8;
const MIN_DAYS = 4;

const days = curriculum.days as unknown as CurriculumDay[];
const dayById = new Map(days.map((d) => [d.day, d]));

/* ---------------------------------- store --------------------------------- */

const sessions = new Map<string, Session>();

function sweep() {
  const now = Date.now();
  for (const [id, s] of sessions) {
    if (now - s.updatedAt > SESSION_TTL_MS) sessions.delete(id);
  }
}

export function getSession(id: string): Session | undefined {
  sweep();
  return sessions.get(id);
}

export function saveSession(s: Session) {
  s.updatedAt = Date.now();
  sessions.set(s.sessionId, s);
}

/* ----------------------------------- plan --------------------------------- */

export function buildPlan(candidate: Candidate): PlanItem[] {
  const missions = candidate.missions ?? [];
  const completed = missions.filter((m) => m.passed && !m.skipped);
  const skipped = missions.filter((m) => m.skipped).map((m) => m.day);

  const role = (candidate.member?.jobRole ?? "").toLowerCase();

  const scored = completed
    .map((m) => {
      const day = dayById.get(m.day);
      if (!day) return null;
      let weight = 1;
      weight += Math.min(m.attempts ?? 1, 5) * 0.8; // shaky mastery first
      if (day.type === "BUILD" || day.type === "PROJECT" || day.type === "CAPSTONE") weight += 1.2;
      if (day.type === "AI_CORE") weight += 0.9;
      const roleHit = day.tools?.some((t) => role.includes(t.toLowerCase().split(" ")[0] ?? "§"));
      if (roleHit) weight += 0.6;
      if (role.includes("data") && day.day <= 10) weight += 0.4;
      if (role.includes("backend") && (day.type === "BUILD" || day.day >= 16)) weight += 0.4;
      if (role.includes("ml") || role.includes("ai")) weight += day.day >= 11 ? 0.5 : 0;
      return { day, weight, attempts: m.attempts ?? 1, title: m.title };
    })
    .filter(Boolean) as { day: CurriculumDay; weight: number; attempts: number; title: string }[];

  scored.sort((a, b) => b.weight - a.weight);

  const picked = scored.slice(0, Math.max(MIN_DAYS, Math.min(6, scored.length)));
  const plan: PlanItem[] = picked.map((p) => ({
    day: p.day.day,
    title: p.day.title,
    tools: p.day.tools ?? [],
    objectives: p.day.objectives ?? [],
    attempts: p.attempts,
    asked: 0,
  }));

  // annotate skipped topic for the growth-area mention at the end
  if (plan.length && skipped.length) {
    const s = dayById.get(skipped[0]!);
    if (s) plan[0]!.skippedMention = `Day ${s.day} — ${s.title}`;
  }
  return plan;
}

/* --------------------------------- helpers -------------------------------- */

const STOP = /\b(stop|end (the )?interview|i'?m done|finish (the )?interview|quit)\b/i;

function normalize(q: string) {
  return q
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !["what", "which", "there", "your", "that", "this", "would", "could", "about", "when", "were", "with", "have", "from", "tell"].includes(w));
}

export function tooSimilar(q: string, asked: string[]) {
  const a = new Set(normalize(q));
  if (a.size === 0) return false;
  for (const prev of asked) {
    const b = new Set(normalize(prev));
    if (b.size === 0) continue;
    let inter = 0;
    for (const w of a) if (b.has(w)) inter++;
    const jac = inter / (a.size + b.size - inter);
    if (jac >= 0.55) return true;
  }
  return false;
}

function apiKey() {
  const key = process.env["GEMINI_API_KEY"];
  if (!key) {
    throw new AiStreamError(
      "The Gemini API key is not configured on the server. Add GEMINI_API_KEY to continue.",
      500,
    );
  }
  return key;
}

export class AiStreamError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.name = "AiStreamError";
    this.status = status;
  }
}

function collectErrorInfo(err: unknown, depth = 0): { text: string; status?: number | undefined } {
  if (!err || depth > 6) return { text: "" };
  if (typeof err !== "object") return { text: String(err) };
  const e = err as Record<string, unknown>;
  const parts: string[] = [];
  if (typeof e['message'] === "string") parts.push(e['message']);
  if (typeof e['responseBody'] === "string") parts.push(e['responseBody']);
  let status =
    typeof e['statusCode'] === "number"
      ? (e['statusCode'] as number)
      : typeof e['status'] === "number"
        ? (e['status'] as number)
        : undefined;

  for (const key of ["cause", "error", "lastError"] as const) {
    const nested = collectErrorInfo(e[key], depth + 1);
    if (nested.text) parts.push(nested.text);
    if (!status && nested.status) status = nested.status;
  }
  if (Array.isArray(e['errors'])) {
    for (const sub of e['errors']) {
      const nested = collectErrorInfo(sub, depth + 1);
      if (nested.text) parts.push(nested.text);
      if (!status && nested.status) status = nested.status;
    }
  }
  return { text: parts.join(" | "), status };
}

function friendlyAiError(err: unknown): AiStreamError {
  const { text: raw, status } = collectErrorInfo(err);
  if (status === 429 || /429|rate.?limit|too many requests/i.test(raw)) {
    return new AiStreamError(
      "The AI service is rate limited right now. Wait a few seconds and send your answer again.",
      429,
    );
  }
  if (status === 402 || /402|payment required|quota|billing|exceeded your current quota/i.test(raw)) {
    return new AiStreamError(
      "Your Google AI account has no remaining quota. Check billing in Google AI Studio to continue the interview.",
      402,
    );
  }
  if (status === 401 || status === 403) {
    return new AiStreamError(
      "Google rejected the request — the GEMINI_API_KEY looks invalid or lacks access to this model.",
      502,
    );
  }
  if (/timeout|aborted|ECONNRESET|fetch failed|network/i.test(raw)) {
    return new AiStreamError(
      "The connection to the AI service dropped mid-response. Please send your answer again.",
      504,
    );
  }
  return new AiStreamError(
    `The AI service couldn't complete that response. Please try again.${raw ? ` (${raw.slice(0, 200)})` : ""}`,
    502,
  );
}


type GeminiSchema = Record<string, unknown>;

const GEMINI_URL = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

async function generate<T>(
  schema: z.ZodType<T>,
  responseSchema: GeminiSchema,
  system: string,
  prompt: string,
): Promise<T> {
  let text: string;
  try {
    const res = await fetch(GEMINI_URL(MODEL), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey(),
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema,
          temperature: 0.8,
        },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`Gemini request failed [${res.status}]: ${body.slice(0, 500)}`);
      throw friendlyAiError({ status: res.status, message: body });
    }

    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
      promptFeedback?: unknown;
    };
    text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    if (!text.trim()) {
      console.error("Gemini returned no text:", JSON.stringify(data).slice(0, 500));
      throw new AiStreamError("The AI returned an empty response. Please try again.", 502);
    }
  } catch (err) {
    if (err instanceof AiStreamError) throw err;
    console.error("Gemini request errored:", err);
    throw friendlyAiError(err);
  }

  let output: unknown;
  try {
    output = JSON.parse(text);
  } catch {
    console.error("Gemini returned malformed JSON:", text.slice(0, 500));
    throw new AiStreamError(
      "The AI returned an empty or malformed response. Please try again.",
      502,
    );
  }

  const parsed = schema.safeParse(output);
  if (!parsed.success) {
    console.error("AI returned unusable output:", JSON.stringify(output)?.slice(0, 500));
    throw new AiStreamError(
      "The AI returned an empty or malformed response. Please try again.",
      502,
    );
  }
  return parsed.data;
}


/* ------------------------------- prompt parts ------------------------------ */

function personaSystem() {
  return [
    "You are a warm, senior AI engineer conducting a live technical interview for a graduate of a 31-day enterprise AI engineering cohort.",
    "Style: conversational, one question at a time, 1-3 short sentences. Briefly acknowledge what the candidate just said before moving on.",
    "Never lecture, never dump bullet lists, never number your questions, never reveal scores or evaluation.",
    "If the candidate says they don't know, be gracious: simplify the question once or move to another area.",
    "Probe for concrete specifics from what they actually built: tradeoffs, numbers, failure modes, why-not-the-alternative.",
  ].join("\n");
}

function candidateBlock(c: Candidate) {
  const m = c.member;
  return `CANDIDATE: ${m.name} — ${m.jobRole}, ${m.yearsExperience} yrs, ${m.education}.
Signals: ${JSON.stringify(c.signals ?? {})}`;
}

function planBlock(plan: PlanItem[]) {
  return plan
    .map(
      (p) =>
        `- Day ${p.day}: ${p.title} | tools: ${p.tools.join(", ")} | objectives: ${p.objectives.join("; ")} | attempts taken: ${p.attempts} | questions asked so far: ${p.asked}`,
    )
    .join("\n");
}

function transcriptBlock(s: Session) {
  return s.transcript.map((t) => `${t.role === "user" ? "CANDIDATE" : "INTERVIEWER"}: ${t.content}`).join("\n");
}

/* ---------------------------------- turns --------------------------------- */

const openingSchema = z.object({
  reply: z.string(),
  question: z.string(),
  day: z.number(),
});

export async function openInterview(s: Session) {
  const out = await generate(
    openingSchema,
    personaSystem(),
    `${candidateBlock(s.candidate)}

PLANNED TOPICS (only these curriculum days may be assessed):
${planBlock(s.plan)}

Greet the candidate by first name in one short sentence, set expectations in one more sentence (a short conversational interview about what they built in the cohort), then ask your FIRST question about one of the planned days.
"reply" = the full spoken turn including the question. "question" = just the question sentence. "day" = the curriculum day number it targets.`,
  );
  if (!out.reply?.trim()) {
    throw new AiStreamError("The AI returned an empty opening message. Please try again.", 502);
  }
  registerQuestion(s, out.question, out.day);
  s.transcript.push({ role: "assistant", content: out.reply });
  return out.reply;

}

const turnSchema = z.object({
  rubric: z.object({
    correctness: z.number(),
    depth: z.number(),
    specificity: z.number(),
    communication: z.number(),
  }),
  note: z.string(),
  isFollowUp: z.boolean(),
  reply: z.string(),
  question: z.string(),
  day: z.number(),
});

export async function nextTurn(s: Session, message: string) {
  const asked = s.askedQuestions.map((q) => q.text);
  const current = s.askedQuestions[s.askedQuestions.length - 1];

  const base = `${candidateBlock(s.candidate)}

PLANNED TOPICS:
${planBlock(s.plan)}

DAYS COVERED SO FAR: ${s.coveredDays.join(", ") || "none"}
QUESTIONS ALREADY ASKED (never repeat or rephrase any of these):
${asked.map((q, i) => `${i + 1}. ${q}`).join("\n")}

FULL TRANSCRIPT SO FAR:
${transcriptBlock(s)}

THE QUESTION JUST ASKED: ${current?.text ?? "(none)"}
THE CANDIDATE'S LATEST ANSWER: ${message}

Tasks:
1. Silently score that answer 0-10 on correctness, depth, specificity, communication, plus a one-sentence "note" quoting or naming the specific thing they said.
2. Decide: follow up on this answer (probe a vague claim, a tradeoff, or ask for a concrete example from their build) OR move to a new planned day. Roughly 40% follow-ups / 60% new topics — follow up when the answer was vague, impressive, or partially wrong; move on when it was thorough or they clearly don't know.
3. Produce your spoken turn: brief acknowledgement + exactly one new question.
Progress: ${s.answered} answers given, ${s.coveredDays.length} distinct days covered. Minimum ${MIN_QUESTIONS} questions across ${MIN_DAYS} days; prioritise uncovered planned days if days covered is below ${MIN_DAYS}.`;

  let out = await generate(turnSchema, personaSystem(), base);

  if (tooSimilar(out.question, asked)) {
    out = await generate(
      turnSchema,
      personaSystem(),
      `${base}

IMPORTANT: your previous attempt asked a question too close to one already asked. Ask a clearly different question, ideally targeting a curriculum day not yet covered.`,
    );
  }

  s.scores.push({
    questionId: current?.id ?? `q${s.scores.length + 1}`,
    day: current?.day ?? 0,
    topic: current ? (dayById.get(current.day)?.title ?? "General") : "General",
    question: current?.text ?? "",
    answer: message,
    rubric: out.rubric,
    note: out.note,
  });
  s.answered += 1;

  if (!out.reply?.trim()) {
    throw new AiStreamError("The AI returned an empty response. Please send your answer again.", 502);
  }
  registerQuestion(s, out.question, out.day);
  s.transcript.push({ role: "assistant", content: out.reply });
  return out.reply;

}

function registerQuestion(s: Session, text: string, day: number) {
  const id = `q${s.askedQuestions.length + 1}`;
  s.askedQuestions.push({ id, text, day });
  if (!s.coveredDays.includes(day) && dayById.has(day)) s.coveredDays.push(day);
  const item = s.plan.find((p) => p.day === day);
  if (item) item.asked += 1;
}

export function shouldEnd(s: Session, message?: string) {
  if (message && STOP.test(message)) return true;
  return s.answered >= MIN_QUESTIONS && s.coveredDays.length >= MIN_DAYS;
}

/* --------------------------------- feedback -------------------------------- */

const feedbackSchema = z.object({
  summary: z.string(),
  strengths: z.array(z.string()),
  gaps: z.array(z.string()),
  next: z.array(z.string()),
});

export async function buildFeedback(s: Session): Promise<Feedback> {
  const detail = s.scores
    .map(
      (a: ScoredAnswer, i) =>
        `#${i + 1} [Day ${a.day} — ${a.topic}]\nQ: ${a.question}\nA: ${a.answer}\nScores: ${JSON.stringify(a.rubric)}\nInterviewer note: ${a.note}`,
    )
    .join("\n\n");

  const skippedMention = s.plan.find((p) => p.skippedMention)?.skippedMention;

  const gen = () =>
    generate(
      feedbackSchema,
      "You write blunt, specific, evidence-based interview debriefs for AI engineers. You only cite things the candidate actually said in this interview. Generic coaching language is unacceptable.",
      `Candidate: ${s.candidate.member.name}, ${s.candidate.member.jobRole}.

ANSWER-BY-ANSWER RECORD:
${detail}

Write the debrief:
- summary: 3-4 sentences on how the interview actually went, naming specific topics they handled well or poorly.
- strengths: 3-4 items. Each MUST reference a specific thing they said, with the day/topic (e.g. "Explained chunking with a concrete 512-token overlap example on Day 9").
- gaps: 3-4 items. Each MUST reference a specific weak or vague answer and say what was missing.${skippedMention ? ` You may add one item noting ${skippedMention} was skipped in the cohort and is untested.` : ""}
- next: 3-5 concrete prep actions tied to those gaps (something they can do this week), not vague advice.
Never write filler like "keep practicing" or "communicate clearly".`,
    );

  let fb = await gen();
  const generic = /keep practic|continue learning|work on communication skills|study more/i;
  if (fb.strengths.some((x) => generic.test(x)) || fb.gaps.some((x) => generic.test(x))) {
    fb = await gen();
  }
  return fb;
}

export { MIN_QUESTIONS, MIN_DAYS, dayById };
