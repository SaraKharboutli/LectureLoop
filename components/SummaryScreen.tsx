"use client";

import { deriveConcepts, masteryCounts } from "@/lib/session/mastery";
import type { Question, Session } from "@/lib/session/types";
import { QuickCheckCard } from "./QuickCheckCard";

type Props = {
  state: Session;
  onAnswer: (questionId: string, choiceIndex: number) => void;
  onNewSession: () => void;
};

const STATUS_LABEL = {
  correct: { text: "Understood ✓", cls: "text-success" },
  incorrect: { text: "Needs review ⚠", cls: "text-review" },
  unanswered: { text: "Not answered ○", cls: "text-idle" },
} as const;

export function SummaryScreen({ state, onAnswer, onNewSession }: Props) {
  const concepts = deriveConcepts(state.questions);
  const counts = masteryCounts(concepts);
  const words = state.segments.reduce((n, s) => n + s.text.split(/\s+/).filter(Boolean).length, 0);

  return (
    <main className="mx-auto max-w-2xl px-5 py-8 pb-[max(2rem,env(safe-area-inset-bottom))]">
      <h1 className="text-3xl font-semibold tracking-tight">Lecture Mastery</h1>

      {state.questions.length === 0 ? (
        <div className="mt-6 rounded-2xl bg-tint p-5">
          <p className="font-semibold">No checkpoints were reached in this session.</p>
          <p className="mt-1 text-muted">
            LectureLoop heard {words} word{words === 1 ? "" : "s"}. Questions appear only after an idea has been fully
            explained, so short sessions may end before the first one.
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
                  {c.status === "understood"
                    ? c.afterReview
                      ? "✓ after review"
                      : "✓"
                    : c.status === "needs_review"
                      ? "⚠"
                      : "○"}
                </span>
              </li>
            ))}
          </ul>

          <h2 className="mt-8 text-lg font-semibold">Your questions</h2>
          <ol className="mt-3 space-y-4">
            {state.questions.map((q, i) => (
              <QuestionRow key={q.id} index={i} question={q} onAnswer={onAnswer} />
            ))}
          </ol>
        </>
      )}

      <button
        type="button"
        onClick={onNewSession}
        className="mt-10 min-h-14 w-full rounded-2xl bg-primary px-6 text-lg font-semibold text-white shadow-sm transition hover:bg-primary-dark"
      >
        New session
      </button>
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
}: {
  index: number;
  question: Question;
  onAnswer: (questionId: string, choiceIndex: number) => void;
}) {
  const status = STATUS_LABEL[q.result];
  return (
    <li className="rounded-2xl ring-1 ring-primary/10 p-4">
      <div className="mb-2 flex items-center justify-between gap-2 text-sm">
        <span className="text-muted">
          {index + 1}. {q.concept}
          {q.kind === "recheck" ? " · second look" : ""}
        </span>
        <span className={`font-semibold ${status.cls}`}>{status.text}</span>
      </div>

      {q.answerIndex === null ? (
        <>
          <p className="mb-2 text-sm text-primary">You missed this one during the lecture — try it now:</p>
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
            <span className="text-muted">Correct answer:</span> <span className="font-medium">{q.choices[q.correctIndex]}</span>
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted">{q.explanation}</p>
        </>
      )}
    </li>
  );
}
