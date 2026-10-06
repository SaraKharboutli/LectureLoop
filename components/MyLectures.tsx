"use client";

import { formatClock } from "@/lib/checkpoints/window";
import { deriveConcepts, masteryCounts } from "@/lib/session/mastery";
import type { SavedLecture } from "@/lib/session/savedLectures";

export function formatLectureDate(ms: number): string {
  return new Date(ms).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function MyLectures({ lectures, onOpen }: { lectures: SavedLecture[]; onOpen: (id: string) => void }) {
  if (lectures.length === 0) return null;
  return (
    <section className="mt-10 w-full text-left" aria-label="My lectures">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">My lectures</h2>
      <ul className="mt-3 space-y-2">
        {lectures.map((l) => {
          const c = masteryCounts(deriveConcepts(l.questions));
          return (
            <li key={l.id}>
              <button
                type="button"
                onClick={() => onOpen(l.id)}
                className="flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left ring-1 ring-primary/15 transition hover:bg-tint"
              >
                <span>
                  <span className="block font-medium">{formatLectureDate(l.savedAt)}</span>
                  <span className="block text-sm text-muted">{formatClock(l.durationSec)} of lecture</span>
                </span>
                <span className="flex shrink-0 gap-3 text-sm font-semibold">
                  <span className="text-success">{c.understood} ✓</span>
                  <span className="text-review">{c.needsReview} ⚠</span>
                  <span className="text-idle">{c.unanswered} ○</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-idle">Saved only in this browser on this device.</p>
    </section>
  );
}
