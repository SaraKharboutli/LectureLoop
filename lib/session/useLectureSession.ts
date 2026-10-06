"use client";

// Wires microphone → live transcription → timing rules → /api/checkpoint → session state,
// and owns the timers (card timeout, auto-dismiss, no-pause fallback).
// See spec.md > Session State and > The Core Journey Through the System.

import { useCallback, useEffect, useReducer, useRef } from "react";
import { MicPermissionError, startMic, type MicCapture } from "@/lib/audio/mic";
import { CHECKPOINT_CONFIG as C } from "@/lib/checkpoints/config";
import { shouldEvaluate, type Trigger } from "@/lib/checkpoints/scheduler";
import type { CheckpointResponse } from "@/lib/checkpoints/types";
import { buildWindow } from "@/lib/checkpoints/window";
import { LiveTranscriber } from "@/lib/transcription/deepgram";
import { toTestedConcepts } from "./mastery";
import { initialSession, sessionReducer } from "./reducer";
import type { Session } from "./types";

const CORRECT_DISMISS_MS = 2000;
const INCORRECT_DISMISS_MS = 8000;

/** DEVELOPMENT ONLY: replay a test lecture instead of the microphone (?devfeed=<fixture>&speed=<n>). */
export type DevFeed = { fixture: string; speed: number };

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function useLectureSession(devFeed: DevFeed | null = null) {
  const [state, dispatch] = useReducer(sessionReducer, initialSession);

  const stateRef = useRef<Session>(state);
  const startedAtRef = useRef(0);
  const speedRef = useRef(1);
  const sessionIdRef = useRef(0);
  const inFlightRef = useRef(false);
  const micRef = useRef<MicCapture | null>(null);
  const transcriberRef = useRef<LiveTranscriber | null>(null);
  const feedTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    stateRef.current = state;
  });

  /** Session time in seconds (sped up in dev-feed mode so the timing rules scale too). */
  const clock = useCallback(() => ((Date.now() - startedAtRef.current) / 1000) * speedRef.current, []);

  const maybeEvaluate = useCallback(
    (trigger: Trigger, s: Session) => {
      if (s.phase !== "listening" || inFlightRef.current) return;
      const now = clock();
      const decision = shouldEvaluate(s.sched, trigger, now);
      if (!decision.evaluate) return;

      inFlightRef.current = true;
      dispatch({ type: "EVAL_STARTED" });
      const sessionId = sessionIdRef.current;
      const { transcriptWindow, recentTail } = buildWindow(s.segments);

      fetch("/api/checkpoint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcriptWindow,
          recentTail,
          testedConcepts: toTestedConcepts(s.questions),
          elapsedSec: now,
          questionDue: decision.due,
        }),
      })
        .then((r) => r.json() as Promise<CheckpointResponse>)
        .catch((): CheckpointResponse => ({ decision: "wait", reason: "network error", error: true }))
        .then((res) => {
          if (sessionIdRef.current !== sessionId) return; // session ended meanwhile
          inFlightRef.current = false;
          if (res.decision === "ask") {
            dispatch({ type: "QUESTION_SHOWN", id: newId(), question: res.question, atSec: clock() });
          } else {
            dispatch({ type: "EVAL_DONE", atSec: clock() });
          }
        });
    },
    [clock],
  );

  // Every finished sentence is a chance to check in with the timing rules — the lecturer doesn't have to pause.
  useEffect(() => {
    if (state.boundaryTick > 0) maybeEvaluate("boundary", state);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per boundary, with that render's state
  }, [state.boundaryTick]);

  // Fallback when a question is overdue or the lecturer never finishes a sentence.
  useEffect(() => {
    if (state.phase !== "listening") return;
    const id = setInterval(
      () => maybeEvaluate("timer", stateRef.current),
      (C.FALLBACK_TICK_SEC * 1000) / speedRef.current,
    );
    return () => clearInterval(id);
  }, [state.phase, maybeEvaluate]);

  // Card lifetime: unanswered → disappears after the timeout; answered → auto-dismiss.
  useEffect(() => {
    const qid = state.activeQuestionId;
    if (!qid) return;
    const ms =
      state.activeFeedback === null
        ? (C.CARD_TIMEOUT_SEC * 1000) / speedRef.current
        : state.activeFeedback === "correct"
          ? CORRECT_DISMISS_MS
          : INCORRECT_DISMISS_MS;
    const id = setTimeout(
      () => dispatch({ type: state.activeFeedback === null ? "CARD_TIMEOUT" : "CARD_DISMISSED", questionId: qid }),
      ms,
    );
    return () => clearTimeout(id);
  }, [state.activeQuestionId, state.activeFeedback]);

  const stopInputs = useCallback(() => {
    micRef.current?.stop();
    micRef.current = null;
    transcriberRef.current?.stop();
    transcriberRef.current = null;
    feedTimersRef.current.forEach(clearTimeout);
    feedTimersRef.current = [];
  }, []);

  useEffect(() => stopInputs, [stopInputs]);

  const startDevFeed = useCallback(async (feed: DevFeed) => {
    const res = await fetch(`/api/dev-fixture?name=${encodeURIComponent(feed.fixture)}`);
    if (!res.ok) {
      dispatch({ type: "MIC_ERROR", message: `Dev feed: fixture "${feed.fixture}" not found.` });
      return;
    }
    const { fixtureToSegments } = await import("@/lib/dev/fixtureSegments");
    const segments = fixtureToSegments(await res.text(), { fragment: true });
    speedRef.current = feed.speed;
    startedAtRef.current = Date.now();
    sessionIdRef.current++;
    inFlightRef.current = false;
    dispatch({ type: "START", at: startedAtRef.current });
    dispatch({ type: "CONNECTION", status: "live" });
    feedTimersRef.current = segments.map((seg) =>
      setTimeout(() => {
        dispatch({ type: "FINAL_SEGMENT", segment: seg });
      }, (seg.end * 1000) / feed.speed),
    );
  }, []);

  const start = useCallback(async () => {
    if (devFeed) return startDevFeed(devFeed);

    let mic: MicCapture;
    try {
      mic = await startMic((pcm) => transcriberRef.current?.sendAudio(pcm));
    } catch (err) {
      dispatch({
        type: "MIC_ERROR",
        message: err instanceof MicPermissionError ? err.message : "The microphone could not be started.",
      });
      return;
    }
    micRef.current = mic;
    speedRef.current = 1;
    startedAtRef.current = Date.now();
    sessionIdRef.current++;
    inFlightRef.current = false;
    dispatch({ type: "START", at: startedAtRef.current });

    const transcriber = new LiveTranscriber(
      mic.sampleRate,
      {
        onInterim: (text) => dispatch({ type: "INTERIM", text }),
        onFinal: (seg) => dispatch({ type: "FINAL_SEGMENT", segment: { id: newId(), ...seg } }),
        onStatus: (status) => dispatch({ type: "CONNECTION", status }),
      },
      clock,
    );
    transcriberRef.current = transcriber;
    transcriber.start();
  }, [clock, devFeed, startDevFeed]);

  const end = useCallback(() => {
    stopInputs();
    sessionIdRef.current++;
    inFlightRef.current = false;
    dispatch({ type: "END", atSec: clock() });
  }, [clock, stopInputs]);

  const answer = useCallback((questionId: string, choiceIndex: number, from: "live" | "summary") => {
    dispatch({ type: "ANSWER", questionId, choiceIndex, from });
  }, []);

  const dismiss = useCallback((questionId: string) => dispatch({ type: "CARD_DISMISSED", questionId }), []);

  const reset = useCallback(() => {
    stopInputs();
    dispatch({ type: "RESET" });
  }, [stopInputs]);

  return { state, start, end, answer, dismiss, reset, clock, transcriberRef };
}
