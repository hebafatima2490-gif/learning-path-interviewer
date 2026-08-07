import type { Candidate } from "@/lib/interview-types";
import { ArrowRight, GraduationCap, Layers, Timer } from "lucide-react";

export function CandidatePicker({
  candidates,
  selectedId,
  onSelect,
  onStart,
  starting,
}: {
  candidates: Candidate[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onStart: () => void;
  starting: boolean;
}) {
  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-14">
      <div className="mb-10 max-w-2xl">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium tracking-wide text-primary">
          <span className="size-1.5 rounded-full bg-primary" />
          AI Cohort · 31 days · 8 modules
        </span>
        <h1 className="mt-5 text-4xl font-semibold text-foreground sm:text-5xl">
          AI Interview Agent
        </h1>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">
          A live, adaptive technical interview built from your own learning journey. Pick a
          candidate profile and the agent designs an interview plan from the days they actually
          completed — then follows up on what you say.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {candidates.map((c) => {
          const active = selectedId === c.member.id;
          const passed = c.missions.filter((m) => m.passed).length;
          const skipped = c.missions.filter((m) => m.skipped).length;
          return (
            <button
              key={c.member.id}
              onClick={() => onSelect(c.member.id)}
              aria-pressed={active}
              className={`group rounded-2xl border p-5 text-left transition-all duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                active
                  ? "border-primary/60 bg-card shadow-[0_0_0_1px_var(--primary)]"
                  : "border-border bg-card hover:border-primary/40"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">{c.member.name}</h3>
                  <p className="mt-0.5 text-sm text-primary">{c.member.jobRole}</p>
                </div>
                <span className="rounded-md border border-border bg-surface-2 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  {c.member.status}
                </span>
              </div>

              <dl className="mt-4 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                <div className="rounded-lg bg-surface-2 p-2">
                  <dt className="flex items-center gap-1">
                    <Timer className="size-3" /> Years
                  </dt>
                  <dd className="mt-1 text-sm font-semibold text-foreground">
                    {c.member.yearsExperience}
                  </dd>
                </div>
                <div className="rounded-lg bg-surface-2 p-2">
                  <dt className="flex items-center gap-1">
                    <Layers className="size-3" /> Passed
                  </dt>
                  <dd className="mt-1 text-sm font-semibold text-foreground">{passed}</dd>
                </div>
                <div className="rounded-lg bg-surface-2 p-2">
                  <dt className="flex items-center gap-1">
                    <GraduationCap className="size-3" /> Skipped
                  </dt>
                  <dd className="mt-1 text-sm font-semibold text-foreground">{skipped}</dd>
                </div>
              </dl>

              <p className="mt-3 line-clamp-1 text-xs text-muted-foreground">{c.member.education}</p>
            </button>
          );
        })}
      </div>

      <div className="sticky bottom-5 mt-8 flex justify-center">
        <button
          onClick={onStart}
          disabled={!selectedId || starting}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {starting ? "Preparing interview…" : "Start interview"}
          <ArrowRight className="size-4" />
        </button>
      </div>
    </div>
  );
}
