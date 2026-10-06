"use client";

import { useState, type ReactNode } from "react";
import { LogoMark, Wordmark } from "./Logo";

type Props = { onStart: () => Promise<void>; micError: string | null; devFeedLabel?: string; children?: ReactNode };

const STEPS = [
  {
    title: "Listen",
    text: "Keep your eyes on the lecturer. LectureLoop turns the lecture into live text.",
    icon: (
      <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Zm-7 9a7 7 0 0 0 14 0M12 19v3" />
    ),
  },
  {
    title: "Quick check",
    text: "When the lecturer finishes a point, one short question about exactly what was said.",
    icon: <path d="M4 5h16v11H8l-4 4V5Zm5 5.5 2 2 4-4" />,
  },
  {
    title: "Review",
    text: "Leave with what you understood and what needs review — saved on this device.",
    icon: <path d="M5 6h14M5 12h9M5 18h6m7-3 2 2 3-4" />,
  },
];

export function StartScreen({ onStart, micError, devFeedLabel, children }: Props) {
  const [starting, setStarting] = useState(false);

  const handleStart = async () => {
    setStarting(true);
    try {
      await onStart();
    } finally {
      setStarting(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-full max-w-3xl flex-col items-center justify-center px-6 py-12 text-center">
      <LogoMark size={64} className="mb-5 drop-shadow-[0_8px_20px_rgba(91,91,214,0.35)]" />
      <h1 className="text-4xl">
        <Wordmark />
      </h1>
      <p className="mt-3 text-xl font-medium">Study while you listen.</p>
      <p className="mt-2 max-w-xl text-lg leading-relaxed text-muted">
        LectureLoop follows a live lecture and, right after the lecturer finishes a point, gives you one quick
        question about it — so the lecture itself becomes your first study session.
      </p>

      <ol className="mt-8 grid w-full gap-3 text-left sm:grid-cols-3" aria-label="How it works">
        {STEPS.map((s, i) => (
          <li key={s.title} className="rounded-2xl bg-tint p-4">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-primary">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  {s.icon}
                </svg>
              </span>
              <span className="text-xs font-semibold text-primary">{i + 1}</span>
              <span className="font-semibold">{s.title}</span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted">{s.text}</p>
          </li>
        ))}
      </ol>

      <div className="mt-8 w-full max-w-xl">
        {micError ? (
          <div role="alert" className="w-full rounded-2xl bg-tint p-5 text-left">
            <p className="font-semibold">LectureLoop can&apos;t hear the lecture yet</p>
            <p className="mt-1 text-muted">{micError}</p>
            <p className="mt-3 text-sm text-muted">
              To allow it: tap the lock or <span aria-hidden>ⓘ</span> icon next to the address bar → Microphone →
              Allow. On iPhone/iPad: Settings → Safari → Microphone → Allow. Then try again.
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted">Place your device where it can clearly hear the lecturer.</p>
        )}

        <button
          type="button"
          onClick={handleStart}
          disabled={starting}
          className="mt-4 min-h-14 w-full rounded-2xl bg-primary px-6 text-lg font-semibold text-white shadow-[0_10px_24px_-10px_rgba(91,91,214,0.7)] transition hover:bg-primary-dark focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-primary/40 disabled:opacity-60"
        >
          {starting ? "Starting…" : micError ? "Try again" : "Start Learning"}
        </button>

        {devFeedLabel && (
          <p className="mt-4 text-xs text-idle">Development test mode: replaying “{devFeedLabel}” instead of the microphone.</p>
        )}

        {children}
      </div>
    </main>
  );
}
