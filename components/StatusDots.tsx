import type { Question } from "@/lib/session/types";

const STYLE = {
  correct: { cls: "bg-success text-white", mark: "✓", label: "understood" },
  incorrect: { cls: "bg-review text-white", mark: "!", label: "needs review" },
  unanswered: { cls: "bg-white text-idle ring-2 ring-inset ring-idle/60", mark: "", label: "unanswered" },
  current: { cls: "bg-tint ring-2 ring-inset ring-primary", mark: "", label: "on screen now" },
} as const;

export function StatusDots({ questions, activeId }: { questions: Question[]; activeId: string | null }) {
  if (questions.length === 0) return null;
  return (
    <ol className="flex flex-wrap items-center justify-center gap-2" aria-label="Questions so far">
      {questions.map((q, i) => {
        const s = STYLE[q.id === activeId ? "current" : q.result];
        return (
          <li
            key={q.id}
            title={`${q.concept}: ${s.label}`}
            aria-label={`Question ${i + 1}, ${q.concept}: ${s.label}`}
            className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${s.cls}`}
          >
            {s.mark}
          </li>
        );
      })}
    </ol>
  );
}
