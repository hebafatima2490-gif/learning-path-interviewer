import { createFileRoute } from "@tanstack/react-router";
import type { Candidate, InterviewResponse } from "@/lib/interview-types";

type Body = { sessionId?: string; candidate?: Candidate; message?: string };

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}

export const Route = createFileRoute("/api/interview")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        }),
      POST: async ({ request }) => {
        let body: Body;
        try {
          body = (await request.json()) as Body;
        } catch {
          return json({ error: "Invalid JSON body" }, 400);
        }

        const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
        if (!sessionId) return json({ error: "sessionId is required" }, 400);

        const engine = await import("@/lib/interview-engine.server");

        try {
          // ---- start ----
          if (body.candidate) {
            const candidate = body.candidate;
            if (!candidate.member?.name || !Array.isArray(candidate.missions)) {
              return json({ error: "candidate must include member and missions" }, 400);
            }
            const plan = engine.buildPlan(candidate);
            if (plan.length === 0) {
              return json({ error: "Candidate has no completed missions to assess" }, 400);
            }
            const session = {
              sessionId,
              candidate,
              plan,
              askedQuestions: [],
              coveredDays: [],
              transcript: [],
              scores: [],
              answered: 0,
              done: false,
              updatedAt: Date.now(),
            };
            const reply = await engine.openInterview(session);
            engine.saveSession(session);
            const res: InterviewResponse = {
              reply,
              done: false,
              progress: {
                answered: 0,
                minQuestions: engine.MIN_QUESTIONS,
                coveredDays: session.coveredDays,
              },
            };
            return json(res);
          }

          // ---- turn ----
          const session = engine.getSession(sessionId);
          if (!session) return json({ error: "Unknown sessionId" }, 404);
          if (typeof body.message !== "string" || !body.message.trim()) {
            return json({ error: "message is required" }, 400);
          }
          if (session.done) {
            return json({
              reply: "Interview completed.",
              done: true,
              feedback: session.feedback,
            } satisfies InterviewResponse);
          }

          const message = body.message.trim().slice(0, 8000);
          session.transcript.push({ role: "user", content: message });

          const stopRequested = engine.shouldEnd(session, message);

          if (!stopRequested) {
            const reply = await engine.nextTurn(session, message);
            if (engine.shouldEnd(session)) {
              const feedback = await engine.buildFeedback(session);
              session.done = true;
              session.feedback = feedback;
              engine.saveSession(session);
              return json({
                reply: "Interview completed.",
                done: true,
                feedback,
                progress: {
                  answered: session.answered,
                  minQuestions: engine.MIN_QUESTIONS,
                  coveredDays: session.coveredDays,
                },
                review: session.scores.map((s) => ({
                  question: s.question,
                  answer: s.answer,
                  note: s.note,
                  day: s.day,
                  topic: s.topic,
                })),
              } satisfies InterviewResponse);
            }
            engine.saveSession(session);
            return json({
              reply,
              done: false,
              progress: {
                answered: session.answered,
                minQuestions: engine.MIN_QUESTIONS,
                coveredDays: session.coveredDays,
              },
            } satisfies InterviewResponse);
          }

          // candidate asked to stop
          const feedback = await engine.buildFeedback(session);
          session.done = true;
          session.feedback = feedback;
          engine.saveSession(session);
          return json({
            reply: "Interview completed.",
            done: true,
            feedback,
            progress: {
              answered: session.answered,
              minQuestions: engine.MIN_QUESTIONS,
              coveredDays: session.coveredDays,
            },
            review: session.scores.map((s) => ({
              question: s.question,
              answer: s.answer,
              note: s.note,
              day: s.day,
              topic: s.topic,
            })),
          } satisfies InterviewResponse);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error("interview error:", msg);
          const status = /429|rate limit/i.test(msg) ? 429 : /402|credit/i.test(msg) ? 402 : 500;
          return json({ error: msg }, status);
        }
      },
    },
  },
});
