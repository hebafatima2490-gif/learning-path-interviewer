import { useState } from "react";
import type { Feedback } from "@/lib/interview-types";
import { Check, ChevronDown, Copy, Download, Sparkle, Target, TriangleAlert } from "lucide-react";

export type ReviewItem = {
  question: string;
  answer: string;
  note: string;
  day: number;
  topic: string;
};

function List({
  title,
  items,
  icon,
  tone,
}: {
  title: string;
  items: string[];
  icon: React.ReactNode;
  tone: string;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h3 className={`flex items-center gap-2 text-sm font-semibold ${tone}`}>
        {icon} {title}
      </h3>
      <ul className="mt-3 space-y-2.5">
        {items.map((it, i) => (
          <li key={i} className="text-sm leading-relaxed text-muted-foreground">
            <span className="mr-2 text-border">—</span>
            {it}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ReportPanel({
  feedback,
  review,
  candidateName,
  onRestart,
}: {
  feedback: Feedback;
  review: ReviewItem[];
  candidateName: string;
  onRestart: () => void;
}) {
  const [open, setOpen] = useState<number | null>(0);
  const [copied, setCopied] = useState(false);

  const payload = { candidate: candidateName, feedback, review };

  const copy = async () => {
    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const download = () => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `interview-${candidateName.replace(/\s+/g, "-").toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-primary">Debrief</p>
          <h1 className="mt-2 text-3xl font-semibold text-foreground">{candidateName}</h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={copy}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2 text-sm text-foreground transition-colors hover:border-primary/50"
          >
            {copied ? <Check className="size-4 text-primary" /> : <Copy className="size-4" />}
            {copied ? "Copied" : "Copy JSON"}
          </button>
          <button
            onClick={download}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2 text-sm text-foreground transition-colors hover:border-primary/50"
          >
            <Download className="size-4" /> Download
          </button>
          <button
            onClick={onRestart}
            className="rounded-xl bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110"
          >
            New interview
          </button>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-primary/25 bg-card p-6">
        <h2 className="text-sm font-semibold text-primary">Summary</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-foreground">{feedback.summary}</p>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <List
          title="Strengths"
          items={feedback.strengths}
          icon={<Sparkle className="size-4" />}
          tone="text-success"
        />
        <List
          title="Gaps"
          items={feedback.gaps}
          icon={<TriangleAlert className="size-4" />}
          tone="text-warning"
        />
        <List
          title="Next steps"
          items={feedback.next}
          icon={<Target className="size-4" />}
          tone="text-primary"
        />
      </div>

      {review.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-sm font-semibold text-foreground">Answer-by-answer review</h2>
          <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {review.map((r, i) => (
              <div key={i}>
                <button
                  onClick={() => setOpen(open === i ? null : i)}
                  aria-expanded={open === i}
                  className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-surface-2"
                >
                  <span className="rounded-md border border-border bg-surface-2 px-2 py-0.5 text-[11px] text-muted-foreground">
                    Day {r.day}
                  </span>
                  <span className="flex-1 truncate text-sm text-foreground">{r.question}</span>
                  <ChevronDown
                    className={`size-4 shrink-0 text-muted-foreground transition-transform ${open === i ? "rotate-180" : ""}`}
                  />
                </button>
                {open === i && (
                  <div className="space-y-3 border-t border-border px-5 py-4 text-sm">
                    <div>
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">
                        Your answer
                      </p>
                      <p className="mt-1 whitespace-pre-wrap leading-relaxed text-foreground">
                        {r.answer}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">
                        Interviewer note
                      </p>
                      <p className="mt-1 leading-relaxed text-primary">{r.note}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
