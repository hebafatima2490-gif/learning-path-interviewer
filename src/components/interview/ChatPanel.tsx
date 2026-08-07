import { useEffect, useRef } from "react";
import { SendHorizonal, AlertTriangle } from "lucide-react";

export type ChatMessage = { role: "user" | "assistant"; content: string };

export function ChatPanel({
  candidateName,
  messages,
  input,
  setInput,
  onSend,
  busy,
  error,
  answered,
  minQuestions,
  coveredDays,
}: {
  candidateName: string;
  messages: ChatMessage[];
  input: string;
  setInput: (v: string) => void;
  onSend: () => void;
  busy: boolean;
  error: string | null;
  answered: number;
  minQuestions: number;
  coveredDays: number[];
}) {
  const endRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  useEffect(() => {
    if (!busy) taRef.current?.focus();
  }, [busy, messages.length]);

  return (
    <div className="mx-auto flex h-screen w-full max-w-3xl flex-col px-4">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border py-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            Technical interview · {candidateName}
          </h2>
          <p className="text-xs text-muted-foreground">
            Question {Math.min(answered + 1, minQuestions)} of {minQuestions}+
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {coveredDays.length === 0 ? (
            <span className="text-xs text-muted-foreground">No days covered yet</span>
          ) : (
            coveredDays.map((d) => (
              <span
                key={d}
                className="rounded-md border border-primary/30 bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground"
              >
                Day {d}
              </span>
            ))
          )}
        </div>
      </header>

      <div className="scroll-thin flex-1 space-y-5 overflow-y-auto py-6">
        {messages.map((m, i) =>
          m.role === "assistant" ? (
            <div key={i} className="flex gap-3">
              <div className="mt-1 size-7 shrink-0 rounded-lg border border-primary/40 bg-accent text-center text-xs leading-[26px] font-semibold text-accent-foreground">
                AI
              </div>
              <p className="max-w-[46rem] whitespace-pre-wrap text-[15px] leading-relaxed text-foreground">
                {m.content}
              </p>
            </div>
          ) : (
            <div key={i} className="flex justify-end">
              <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-[15px] leading-relaxed text-primary-foreground">
                {m.content}
              </p>
            </div>
          ),
        )}

        {busy && (
          <div className="flex items-center gap-3">
            <div className="mt-1 size-7 shrink-0 rounded-lg border border-primary/40 bg-accent text-center text-xs leading-[26px] font-semibold text-accent-foreground">
              AI
            </div>
            <span className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="size-1.5 animate-bounce rounded-full bg-muted-foreground"
                  style={{ animationDelay: `${i * 120}ms` }}
                />
              ))}
            </span>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-foreground">
            <AlertTriangle className="mt-0.5 size-4 text-destructive" />
            <span>{error}</span>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="border-t border-border py-4">
        <div className="flex items-end gap-2 rounded-2xl border border-border bg-card p-2 transition-colors focus-within:border-primary/50">
          <textarea
            ref={taRef}
            value={input}
            rows={2}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (!busy && input.trim()) onSend();
              }
            }}
            placeholder="Answer in your own words… (Enter to send, Shift+Enter for a new line)"
            aria-label="Your answer"
            className="scroll-thin max-h-40 flex-1 resize-none bg-transparent px-2 py-1.5 text-[15px] text-foreground outline-none placeholder:text-muted-foreground"
          />
          <button
            onClick={onSend}
            disabled={busy || !input.trim()}
            aria-label="Send answer"
            className="inline-flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-all hover:brightness-110 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <SendHorizonal className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
