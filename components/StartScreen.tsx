"use client";

import { useState, type ReactNode } from "react";

type Props = { onStart: () => Promise<void>; micError: string | null; devFeedLabel?: string; children?: ReactNode };

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
    <main className="mx-auto flex min-h-full max-w-xl flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-tint">
        <span className="h-4 w-4 rounded-full bg-primary" aria-hidden />
      </div>
      <h1 className="text-3xl font-semibold tracking-tight">LectureLoop</h1>
      <p className="mt-3 text-lg leading-relaxed text-muted">
        Study while you listen. LectureLoop follows the lecture and, right after an idea is fully explained,
        gives you one quick question about it.
      </p>

      {micError ? (
        <div role="alert" className="mt-8 w-full rounded-2xl bg-tint p-5 text-left">
          <p className="font-semibold">LectureLoop can&apos;t hear the lecture yet</p>
          <p className="mt-1 text-muted">{micError}</p>
          <p className="mt-3 text-sm text-muted">
            To allow it: tap the lock or <span aria-hidden>ⓘ</span> icon next to the address bar → Microphone →
            Allow. On iPhone/iPad: Settings → Safari → Microphone → Allow. Then try again.
          </p>
        </div>
      ) : (
        <p className="mt-8 rounded-2xl bg-tint px-5 py-4 text-sm text-ink">
          Place your device where it can clearly hear the lecturer, then keep your eyes on the lecture.
        </p>
      )}

      <button
        type="button"
        onClick={handleStart}
        disabled={starting}
        className="mt-8 min-h-14 w-full rounded-2xl bg-primary px-6 text-lg font-semibold text-white shadow-sm transition hover:bg-primary-dark focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-primary/40 disabled:opacity-60"
      >
        {starting ? "Starting…" : micError ? "Try again" : "Start Learning"}
      </button>

      {devFeedLabel && (
        <p className="mt-4 text-xs text-idle">Development test mode: replaying “{devFeedLabel}” instead of the microphone.</p>
      )}

      {children}
    </main>
  );
}
