"use client";

import { useEffect, useState } from "react";
import { formatClock } from "@/lib/checkpoints/window";
import type { Session } from "@/lib/session/types";
import { CheckpointArea } from "./CheckpointArea";
import { LogoMark, Wordmark } from "./Logo";
import { TranscriptPane } from "./TranscriptPane";

type Props = {
  state: Session;
  clock: () => number;
  onEnd: () => void;
  onAnswer: (questionId: string, choiceIndex: number) => void;
  onDismiss: (questionId: string) => void;
};

const STATUS = {
  idle: { text: "Starting…", dot: "bg-idle", pulse: false },
  connecting: { text: "Connecting…", dot: "bg-idle", pulse: true },
  live: { text: "Listening", dot: "bg-primary", pulse: true },
  reconnecting: { text: "Reconnecting…", dot: "bg-review", pulse: true },
  error: { text: "Connection lost", dot: "bg-review", pulse: false },
} as const;

export function LectureScreen({ state, clock, onEnd, onAnswer, onDismiss }: Props) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setElapsed(clock()), 1000);
    return () => clearInterval(id);
  }, [clock]);

  const status = STATUS[state.connection];
  const active = state.questions.find((q) => q.id === state.activeQuestionId) ?? null;

  return (
    <main className="mx-auto flex h-dvh max-w-3xl flex-col lg:max-w-7xl">
      <header className="flex items-center gap-3 border-b border-primary/10 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] lg:px-8">
        <LogoMark size={28} />
        <Wordmark className="text-[17px]" />
        <span className="ml-1 flex items-center gap-1.5 text-sm text-muted" role="status">
          <span className={`h-2.5 w-2.5 rounded-full ${status.dot} ${status.pulse ? "animate-soft-pulse" : ""}`} />
          {status.text}
        </span>
        <span className="ml-auto font-mono text-sm tabular-nums text-muted">{formatClock(elapsed)}</span>
        <button
          type="button"
          onClick={onEnd}
          className="min-h-10 rounded-xl px-4 text-sm font-semibold text-primary ring-1 ring-primary/30 transition hover:bg-tint"
        >
          End
        </button>
      </header>

      {/* Phones/tablets portrait: transcript above, quick checks below. Laptops/landscape: side by side. */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <TranscriptPane
          segments={state.segments}
          interim={state.interim}
          compact={active !== null}
          highlightQuote={active && active.answerIndex === null ? active.evidenceQuote : null}
        />
        <CheckpointArea questions={state.questions} active={active} onAnswer={onAnswer} onDismiss={onDismiss} />
      </div>
    </main>
  );
}
