"use client";

import type { Question } from "@/lib/session/types";
import { QuickCheckCard } from "./QuickCheckCard";
import { StatusDots } from "./StatusDots";

type Props = {
  questions: Question[];
  active: Question | null;
  onAnswer: (questionId: string, choiceIndex: number) => void;
  onDismiss: (questionId: string) => void;
};

export function CheckpointArea({ questions, active, onAnswer, onDismiss }: Props) {
  return (
    <section
      aria-label="Quick checks"
      className={`flex min-h-0 flex-col gap-3 border-t border-primary/10 bg-white px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] lg:w-[440px] lg:flex-none lg:border-t-0 lg:border-l lg:bg-tint/40 lg:px-6 lg:py-6 xl:w-[480px] ${
        active ? "flex-[66]" : "flex-[42]"
      }`}
    >
      {/* my-auto (not justify-center) keeps a tall card scrollable from its top on small screens */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="my-auto">
          {active ? (
            <QuickCheckCard
              key={active.id}
              question={active}
              variant="live"
              onAnswer={(i) => onAnswer(active.id, i)}
              onDismiss={() => onDismiss(active.id)}
            />
          ) : (
            <div className="flex flex-col items-center gap-3 px-4 text-center">
              <span className="relative flex h-10 w-10 items-center justify-center" aria-hidden="true">
                <span className="absolute h-10 w-10 rounded-full bg-primary/10 animate-soft-pulse" />
                <span className="h-3 w-3 rounded-full bg-primary" />
              </span>
              <p className="text-idle">Listening… a quick check will appear here when the lecturer finishes a point.</p>
            </div>
          )}
        </div>
      </div>
      <StatusDots questions={questions} activeId={active?.answerIndex === null ? active.id : null} />
    </section>
  );
}
