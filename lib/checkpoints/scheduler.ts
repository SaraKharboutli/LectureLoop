// "Is it worth asking the AI right now?" — plain rules, no AI.
// Pure functions so they can be unit-tested. See spec.md > Checkpoint Scheduler.
//
// Checks happen at the end of any complete sentence (the lecturer does not have to stop talking).
// About every TARGET_GAP_SEC a question becomes "due": the AI is then told to ask about the most
// recent completed point rather than wait for a major idea.

import { CHECKPOINT_CONFIG as C } from "./config";

export type SchedulerState = {
  /** End time of the latest finalized transcript segment. */
  speechSec: number;
  /** speechSec at the moment the last evaluation started. */
  lastEvalSpeechSec: number;
  /** Verdict of the last finished evaluation. */
  lastVerdict: "wait" | "ask" | null;
  /** Lecture time when the last question was shown. */
  lastQuestionAt: number | null;
  /** An evaluation request is currently running. */
  inFlight: boolean;
  /** The latest finalized segment ended a sentence (. ? !). Speech-to-text also splits mid-sentence. */
  atSentenceEnd: boolean;
};

/** "boundary" = a sentence just ended (or the speaker paused after one); "timer" = periodic fallback. */
export type Trigger = "boundary" | "timer";

export type SchedulerDecision = { evaluate: boolean; due: boolean; reason: string };

export const initialSchedulerState: SchedulerState = {
  speechSec: 0,
  lastEvalSpeechSec: 0,
  lastVerdict: null,
  lastQuestionAt: null,
  inFlight: false,
  atSentenceEnd: false,
};

const SENTENCE_END = /[.?!]["')\]]*\s*$/;

export function endsSentence(text: string): boolean {
  return SENTENCE_END.test(text);
}

/** Seconds since the last question (or since the start of the lecture). */
function sinceLastQuestion(s: SchedulerState, nowSec: number): number {
  return s.lastQuestionAt === null ? nowSec : nowSec - s.lastQuestionAt;
}

export function shouldEvaluate(s: SchedulerState, trigger: Trigger, nowSec: number): SchedulerDecision {
  const since = sinceLastQuestion(s, nowSec);
  const due = since >= C.TARGET_GAP_SEC;
  const no = (reason: string): SchedulerDecision => ({ evaluate: false, due, reason });

  if (s.inFlight) return no("in-flight");
  if (s.speechSec < C.WARMUP_SEC) return no("warm-up");
  if (s.lastQuestionAt !== null && since < C.MIN_GAP_SEC) return no("cooldown");

  const newSpeech = s.speechSec - s.lastEvalSpeechSec;

  if (trigger === "timer") {
    // Overdue and the lecturer hasn't finished a sentence for a while, or a very long stretch with no boundary.
    const overdue = since >= C.TARGET_GAP_SEC + C.DUE_GRACE_SEC && newSpeech >= C.MIN_NEW_SPEECH_AFTER_WAIT_SEC;
    if (overdue || newSpeech >= C.NO_BOUNDARY_FALLBACK_SEC) return { evaluate: true, due, reason: "timer" };
    return no("timer-not-needed");
  }

  // A pause/fragment in the middle of a sentence is just a breath, not a possible boundary.
  if (!s.atSentenceEnd) return no("mid-sentence");
  const required = s.lastVerdict === "wait" ? C.MIN_NEW_SPEECH_AFTER_WAIT_SEC : C.MIN_NEW_SPEECH_SEC;
  if (newSpeech < required) return no("not-enough-new-speech");
  return { evaluate: true, due, reason: "boundary" };
}

export function onEvaluationStarted(s: SchedulerState): SchedulerState {
  return { ...s, inFlight: true, lastEvalSpeechSec: s.speechSec };
}

export function onEvaluationFinished(s: SchedulerState, verdict: "wait" | "ask", nowSec: number): SchedulerState {
  return {
    ...s,
    inFlight: false,
    lastVerdict: verdict,
    lastQuestionAt: verdict === "ask" ? nowSec : s.lastQuestionAt,
  };
}

export function onSpeech(s: SchedulerState, segmentEndSec: number, text: string): SchedulerState {
  return {
    ...s,
    speechSec: Math.max(s.speechSec, segmentEndSec),
    atSentenceEnd: endsSentence(text),
  };
}
