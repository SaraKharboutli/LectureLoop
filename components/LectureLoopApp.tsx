"use client";

import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { useLectureSession, type DevFeed } from "@/lib/session/useLectureSession";
import { LectureScreen } from "./LectureScreen";
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
    return <SummaryScreen state={state} onAnswer={(id, i) => answer(id, i, "summary")} onNewSession={reset} />;
  }

  return <StartScreen onStart={start} micError={state.micError} devFeedLabel={devFeed?.fixture} />;
}
