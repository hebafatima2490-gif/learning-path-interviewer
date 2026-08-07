import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import candidatesData from "@/data/candidates.json";
import type { Candidate, Feedback, InterviewResponse } from "@/lib/interview-types";
import { CandidatePicker } from "@/components/interview/CandidatePicker";
import { ChatPanel, type ChatMessage } from "@/components/interview/ChatPanel";
import { ReportPanel, type ReviewItem } from "@/components/interview/ReportPanel";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AI Interview Agent — Adaptive Cohort Interviews" },
      {
        name: "description",
        content:
          "Practice a realistic, adaptive technical interview built from your 31-day AI cohort progress, with evidence-based feedback at the end.",
      },
      { property: "og:title", content: "AI Interview Agent — Adaptive Cohort Interviews" },
      {
        property: "og:description",
        content:
          "Multi-turn AI technical interviews personalized to the curriculum days you completed, ending in a structured debrief.",
      },
    ],
  }),
  component: Home,
});

const candidates = (candidatesData as { candidates: Candidate[] }).candidates;

function Home() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answered, setAnswered] = useState(0);
  const [minQuestions, setMinQuestions] = useState(8);
  const [coveredDays, setCoveredDays] = useState<number[]>([]);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [review, setReview] = useState<ReviewItem[]>([]);

  const candidate = useMemo(
    () => candidates.find((c) => c.member.id === selectedId) ?? null,
    [selectedId],
  );

  async function post(body: Record<string, unknown>): Promise<InterviewResponse> {
    const res = await fetch("/api/interview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as InterviewResponse & { error?: string };
    if (!res.ok) {
      throw new Error(
        res.status === 429
          ? "Rate limit reached — wait a few seconds and send your answer again."
          : res.status === 402
            ? "AI credits exhausted. Add credits to continue the interview."
            : (data.error ?? "Something went wrong. Please try again."),
      );
    }
    return data;
  }

  function applyProgress(data: InterviewResponse) {
    if (data.progress) {
      setAnswered(data.progress.answered);
      setMinQuestions(data.progress.minQuestions);
      setCoveredDays(data.progress.coveredDays);
    }
  }

  async function start() {
    if (!candidate) return;
    setBusy(true);
    setError(null);
    const id = crypto.randomUUID();
    try {
      const data = await post({ sessionId: id, candidate });
      setSessionId(id);
      setMessages([{ role: "assistant", content: data.reply }]);
      applyProgress(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start interview.");
      setSessionId(id);
      setMessages([]);
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    if (!sessionId || !input.trim() || busy) return;
    const message = input.trim();
    setInput("");
    setMessages((m) => [...m, { role: "user", content: message }]);
    setBusy(true);
    setError(null);
    try {
      const data = await post({ sessionId, message });
      applyProgress(data);
      if (data.done && data.feedback) {
        setFeedback(data.feedback);
        setReview(data.review ?? []);
      } else {
        setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send answer.");
    } finally {
      setBusy(false);
    }
  }

  function restart() {
    setSelectedId(null);
    setSessionId(null);
    setMessages([]);
    setFeedback(null);
    setReview([]);
    setAnswered(0);
    setCoveredDays([]);
    setError(null);
  }

  if (feedback && candidate) {
    return (
      <main className="min-h-screen bg-background">
        <ReportPanel
          feedback={feedback}
          review={review}
          candidateName={candidate.member.name}
          onRestart={restart}
        />
      </main>
    );
  }

  if (sessionId && candidate) {
    return (
      <main className="min-h-screen bg-background">
        <ChatPanel
          candidateName={candidate.member.name}
          messages={messages}
          input={input}
          setInput={setInput}
          onSend={send}
          busy={busy}
          error={error}
          answered={answered}
          minQuestions={minQuestions}
          coveredDays={coveredDays}
        />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <CandidatePicker
        candidates={candidates}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onStart={start}
        starting={busy}
      />
      {error && (
        <p className="mx-auto max-w-6xl px-5 pb-10 text-sm text-destructive">{error}</p>
      )}
    </main>
  );
}
