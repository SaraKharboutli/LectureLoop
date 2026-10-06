"use client";

import type { Question } from "@/lib/session/types";

type Props = {
  question: Question;
  /** "live" shows feedback states and dismisses; "summary" is a compact inline version. */
  variant: "live" | "summary";
  onAnswer: (choiceIndex: number) => void;
  onDismiss?: () => void;
};

export function QuickCheckCard({ question: q, variant, onAnswer, onDismiss }: Props) {
  const answered = q.answerIndex !== null;
  const live = variant === "live";

  return (
    <div
      className={`rounded-2xl bg-tint p-4 sm:p-5 ${live ? "animate-card-in shadow-[0_6px_24px_-12px_rgba(91,91,214,0.45)]" : ""}`}
      onClick={answered && live ? onDismiss : undefined}
      role="group"
      aria-label={`Quick check: ${q.concept}`}
    >
      {live && (
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="shrink-0 whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-primary">
            {q.kind === "recheck" ? "Second look" : "Quick check"}
          </span>
          <span className="truncate rounded-full bg-white px-2.5 py-0.5 text-xs text-muted">{q.concept}</span>
        </div>
      )}

      <p className="text-[18px] font-semibold leading-snug sm:text-xl">{q.question}</p>

      <div className="mt-3 grid gap-2">
        {q.choices.map((choice, i) => {
          const isCorrect = i === q.correctIndex;
          const isPicked = i === q.answerIndex;
          // After answering, keep only the correct choice and the student's pick so the feedback fits on a phone.
          if (answered && live && !isCorrect && !isPicked) return null;
          let cls = "bg-white text-ink ring-1 ring-primary/15 hover:ring-primary/50";
          if (answered && isCorrect) cls = "bg-success/15 text-ink ring-2 ring-success";
          else if (answered && isPicked) cls = "bg-review/15 text-ink ring-2 ring-review";
          else if (answered) cls = "bg-white/70 text-muted ring-1 ring-transparent";
          return (
            <button
              key={i}
              type="button"
              disabled={answered}
              onClick={(e) => {
                e.stopPropagation();
                onAnswer(i);
              }}
              className={`flex min-h-12 items-center gap-3 rounded-xl px-4 py-2 text-left text-[15px] leading-snug transition sm:text-base ${cls} disabled:cursor-default`}
            >
              <span className="w-5 shrink-0 font-semibold text-primary">{String.fromCharCode(65 + i)}</span>
              <span>{choice}</span>
            </button>
          );
        })}
      </div>

      {answered && (
        <div className="mt-3" aria-live="polite">
          {q.result === "correct" ? (
            <p className="font-semibold text-success">Got it ✓</p>
          ) : (
            <>
              <p className="font-semibold text-review">Needs review</p>
              <p className="mt-1 text-[15px] leading-relaxed text-ink">{q.explanation}</p>
            </>
          )}
          {live && <p className="mt-2 text-xs text-idle">Tap to close</p>}
        </div>
      )}
    </div>
  );
}
