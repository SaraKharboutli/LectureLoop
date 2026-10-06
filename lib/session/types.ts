// Everything LectureLoop remembers during one session — kept in page memory only.
// See spec.md > Data Model.

import type { SchedulerState } from "@/lib/checkpoints/scheduler";
import type { CheckpointQuestion, Segment } from "@/lib/checkpoints/types";

export type QuestionResult = "correct" | "incorrect" | "unanswered";

export type Question = CheckpointQuestion & {
  id: string;
  conceptKey: string;
  /** Session seconds when the card appeared. */
  askedAt: number;
  answerIndex: number | null;
  result: QuestionResult;
  answeredFrom?: "live" | "summary";
};

export type Connection = "idle" | "connecting" | "live" | "reconnecting" | "error";

export type Session = {
  phase: "start" | "listening" | "summary";
  connection: Connection;
  micError: string | null;
  /** Epoch ms when listening started. */
  startedAt: number | null;
  /** Session seconds when End was tapped. */
  endedAtSec: number | null;
  segments: Segment[];
  interim: string;
  questions: Question[];
  activeQuestionId: string | null;
  activeFeedback: null | "correct" | "incorrect";
  sched: SchedulerState;
  /** Increments every time a sentence ends (pauses don't matter); the session hook reacts to it. */
  boundaryTick: number;
};
