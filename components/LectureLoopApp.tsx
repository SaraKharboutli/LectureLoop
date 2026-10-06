"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { deleteLecture, loadLectures, upsertLecture, type SavedLecture } from "@/lib/session/savedLectures";
import { newId, useLectureSession, type DevFeed } from "@/lib/session/useLectureSession";
import { LectureScreen } from "./LectureScreen";
import { MyLectures } from "./MyLectures";
import { SavedLectureScreen } from "./SavedLectureScreen";
import { StartScreen } from "./StartScreen";
import { SummaryScreen } from "./SummaryScreen";

export function LectureLoopApp() {
  const params = useSearchParams();
  // DEVELOPMENT ONLY test mode: ?devfeed=<fixture>&speed=<n>. Ignored in production builds.
  const devFeed = useMemo<DevFeed | null>(() => {
    if (process.env.NODE_ENV !== "development") return null;
    const fixture = params.get("devfeed");
    if (!fixture) return null;
    return { fixture, speed: Math.max(1, Math.min(20, Number(params.get("speed")) || 1)) };
  }, [params]);

  const { state, start, end, answer, dismiss, reset, clock } = useLectureSession(devFeed);

  // DEVELOPMENT ONLY: &autostart=1 starts the dev feed without a tap (used for headless screenshots).
  const autostart = devFeed !== null && params.get("autostart") === "1";
  const autostarted = useRef(false); // React dev mode runs effects twice; start only once
  useEffect(() => {
    if (!autostart || autostarted.current) return;
    autostarted.current = true;
    void start();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once on load
  }, [autostart]);

  // My lectures (saved on this device) — read after mount, refreshed whenever we're back on the Start screen.
  const [lectures, setLectures] = useState<SavedLecture[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is only available after mount
    if (state.phase === "start") setLectures(loadLectures());
  }, [state.phase]);

  if (state.phase === "listening") {
    return (
      <LectureScreen
        state={state}
        clock={clock}
        onEnd={end}
        onAnswer={(id, i) => answer(id, i, "live")}
        onDismiss={dismiss}
      />
    );
  }

  if (state.phase === "summary") {
    return (
      <SummaryScreen
        questions={state.questions}
        wordCount={state.segments.reduce((n, s) => n + s.text.split(/\s+/).filter(Boolean).length, 0)}
        onAnswer={(id, i) => answer(id, i, "summary")}
        subtitle={state.segments.length || state.questions.length ? "Saved to My lectures on this device." : undefined}
        footer={
          <button
            type="button"
            onClick={reset}
            className="min-h-14 w-full rounded-2xl bg-primary px-6 text-lg font-semibold text-white shadow-sm transition hover:bg-primary-dark"
          >
            New session
          </button>
        }
      />
    );
  }

  const open = lectures.find((l) => l.id === openId);
  if (open) {
    return (
      <SavedLectureScreen
        lecture={open}
        newId={newId}
        onChange={(l) => setLectures(upsertLecture(l))}
        onDelete={() => {
          setLectures(deleteLecture(open.id));
          setOpenId(null);
        }}
        onBack={() => setOpenId(null)}
      />
    );
  }

  return (
    <StartScreen onStart={start} micError={state.micError} devFeedLabel={devFeed?.fixture}>
      <MyLectures lectures={lectures} onOpen={setOpenId} />
    </StartScreen>
  );
}
