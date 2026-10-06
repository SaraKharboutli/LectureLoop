"use client";

import type { ReactNode } from "react";
import { deriveConcepts, masteryCounts } from "@/lib/session/mastery";
import type { Question } from "@/lib/session/types";
import { LogoMark, Wordmark } from "./Logo";
import { QuickCheckCard } from "./QuickCheckCard";

type Props = {
  questions: Question[];
  wordCount: number;
  onAnswer: (questionId: string, choiceIndex: number) => void;
  /** Offered on a concept's latest question when it was answered wrongly (saved lectures). */
  onRetry?: (questionId: string) => void;
  /** Shown under the heading, e.g. the lecture date. */
  subtitle?: ReactNode;
  /** Extra content after the questions, e.g. the lecture text. */
  children?: ReactNode;
  /** Bottom actions. */
  footer: ReactNode;
};

const STATUS_LABEL = {
  correct: { text: "Understood ✓", cls: "text-success" },
  incorrect: { text: "Needs review ⚠", cls: "text-review" },
  unanswered: { text: "Not answered ○", cls: "text-idle" },
} as const;

export function SummaryScreen({ questions, wordCount, onAnswer, onRetry, subtitle, children, footer }: Props) {
  const concepts = deriveConcepts(questions);
  const counts = masteryCounts(concepts);
  const latestOfConcept = new Set(concepts.map((c) => c.questions[c.questions.length - 1].id));

  return (
    <main className="mx-auto max-w-2xl px-5 py-8 pb-[max(2rem,env(safe-area-inset-bottom))]">
      <div className="mb-6 flex items-center gap-2">
        <LogoMark size={26} />
        <Wordmark className="text-[16px]" />
      </div>
      <h1 className="text-3xl font-semibold tracking-tight">Lecture Mastery</h1>
      {subtitle && <p className="mt-1 text-muted">{subtitle}</p>}

      {questions.length === 0 ? (
        <div className="mt-6 rounded-2xl bg-tint p-5">
          <p className="font-semibold">No checkpoints were reached in this session.</p>
          <p className="mt-1 text-muted">
            LectureLoop heard {wordCount} word{wordCount === 1 ? "" : "s"}. Quick checks start after about a minute and a
            half of lecture, so very short sessions may end before the first one.
          </p>
        </div>
      ) : (
        <>
          <dl className="mt-6 grid grid-cols-3 gap-3 text-center">
            <Count label="understood" value={counts.understood} cls="text-success" />
            <Count label="need review" value={counts.needsReview} cls="text-review" />
            <Count label="not answered" value={counts.unanswered} cls="text-idle" />
          </dl>

          <ul className="mt-6 space-y-2" aria-label="Concepts">
            {concepts.map((c) => (
              <li key={c.key} className="flex items-center justify-between gap-3 rounded-xl px-1 py-1">
                <span className="font-medium">{c.label}</span>
                <span
                  className={`shrink-0 text-sm font-semibold ${
                    c.status === "understood" ? "text-success" : c.status === "needs_review" ? "text-review" : "text-idle"
                  }`}
                >
                  {c.status === "understood" ? (c.afterReview ? "✓ after review" : "✓") : c.status === "needs_review" ? "⚠" : "○"}
                </span>
              </li>
            ))}
          </ul>

          <h2 className="mt-8 text-lg font-semibold">Your questions</h2>
          <ol className="mt-3 space-y-4">
            {questions.map((q, i) => (
              <QuestionRow
                key={q.id}
                index={i}
                question={q}
                onAnswer={onAnswer}
                onRetry={onRetry && q.result === "incorrect" && latestOfConcept.has(q.id) ? onRetry : undefined}
              />
            ))}
          </ol>
        </>
      )}

      {children}

      <div className="mt-10 grid gap-3">{footer}</div>
    </main>
  );
}

function Count({ label, value, cls }: { label: string; value: number; cls: string }) {
  return (
    <div className="rounded-2xl bg-tint px-2 py-4">
      <dd className={`text-3xl font-semibold ${cls}`}>{value}</dd>
      <dt className="mt-1 text-xs text-muted">{label}</dt>
    </div>
  );
}

function QuestionRow({
  index,
  question: q,
  onAnswer,
  onRetry,
}: {
  index: number;
  question: Question;
  onAnswer: (questionId: string, choiceIndex: number) => void;
  onRetry?: (questionId: string) => void;
}) {
  const status = STATUS_LABEL[q.result];
  return (
    <li className="rounded-2xl p-4 ring-1 ring-primary/10">
      <div className="mb-2 flex items-center justify-between gap-2 text-sm">
        <span className="text-muted">
          {index + 1}. {q.concept}
          {q.kind === "recheck" ? " · second look" : ""}
        </span>
        <span className={`font-semibold ${status.cls}`}>{status.text}</span>
      </div>

      {q.answerIndex === null ? (
        <>
          <p className="mb-2 text-sm text-primary">
            {q.kind === "recheck" ? "Try it again:" : "You missed this one during the lecture — try it now:"}
          </p>
          <QuickCheckCard question={q} variant="summary" onAnswer={(i) => onAnswer(q.id, i)} />
        </>
      ) : (
        <>
          <p className="font-semibold leading-snug">{q.question}</p>
          {q.result === "incorrect" && (
            <p className="mt-2 text-sm">
              <span className="text-muted">Your answer:</span> {q.choices[q.answerIndex]}
            </p>
          )}
          <p className="mt-1 text-sm">
            <span className="text-muted">Correct answer:</span>{" "}
            <span className="font-medium">{q.choices[q.correctIndex]}</span>
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted">{q.explanation}</p>
          {onRetry && (
            <button
              type="button"
              onClick={() => onRetry(q.id)}
              className="mt-3 min-h-10 rounded-xl px-4 text-sm font-semibold text-primary ring-1 ring-primary/30 transition hover:bg-tint"
            >
              Try again
            </button>
          )}
        </>
      )}
    </li>
  );
}
