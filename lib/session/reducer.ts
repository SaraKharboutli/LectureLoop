// Every change to the session goes through here (pure, unit-tested).
// See spec.md > Session State.

import {
  initialSchedulerState,
  onEvaluationFinished,
  onEvaluationStarted,
  onSpeech,
} from "@/lib/checkpoints/scheduler";
import type { CheckpointQuestion, Segment } from "@/lib/checkpoints/types";
import { conceptKey } from "@/lib/checkpoints/validate";
import type { Connection, Question, Session } from "./types";

export type Action =
  | { type: "START"; at: number }
  | { type: "MIC_ERROR"; message: string }
  | { type: "CONNECTION"; status: Connection }
  | { type: "INTERIM"; text: string }
  | { type: "FINAL_SEGMENT"; segment: Segment }
  | { type: "EVAL_STARTED" }
  | { type: "EVAL_DONE"; atSec: number }
  | { type: "QUESTION_SHOWN"; id: string; question: CheckpointQuestion; atSec: number }
  | { type: "ANSWER"; questionId: string; choiceIndex: number; from: "live" | "summary" }
  | { type: "CARD_TIMEOUT"; questionId: string }
  | { type: "CARD_DISMISSED"; questionId: string }
  | { type: "END"; atSec: number }
  | { type: "RESET" };

export const initialSession: Session = {
  phase: "start",
  connection: "idle",
  micError: null,
  startedAt: null,
  endedAtSec: null,
  segments: [],
  interim: "",
  questions: [],
  activeQuestionId: null,
  activeFeedback: null,
  sched: initialSchedulerState,
  boundaryTick: 0,
};

export function sessionReducer(s: Session, a: Action): Session {
  switch (a.type) {
    case "START":
      return { ...initialSession, phase: "listening", connection: "connecting", startedAt: a.at };

    case "MIC_ERROR":
      return { ...initialSession, micError: a.message };

    case "CONNECTION":
      return s.phase === "listening" ? { ...s, connection: a.status } : s;

    case "INTERIM":
      return s.phase === "listening" ? { ...s, interim: a.text } : s;

    case "FINAL_SEGMENT": {
      if (s.phase !== "listening") return s;
      const sched = onSpeech(s.sched, a.segment.end, a.segment.text);
      return {
        ...s,
        segments: [...s.segments, a.segment],
        interim: "",
        sched,
        // A finished sentence is a possible check point — the lecturer doesn't have to stop talking.
        boundaryTick: sched.atSentenceEnd ? s.boundaryTick + 1 : s.boundaryTick,
      };
    }

    case "EVAL_STARTED":
      return s.phase === "listening" ? { ...s, sched: onEvaluationStarted(s.sched) } : s;

    case "EVAL_DONE":
      // A late answer after End is ignored.
      return s.phase === "listening" ? { ...s, sched: onEvaluationFinished(s.sched, "wait", a.atSec) } : s;

    case "QUESTION_SHOWN": {
      if (s.phase !== "listening") return s;
      const q: Question = {
        ...a.question,
        id: a.id,
        conceptKey: conceptKey(a.question.concept),
        askedAt: a.atSec,
        answerIndex: null,
        result: "unanswered",
      };
      return {
        ...s,
        questions: [...s.questions, q],
        activeQuestionId: q.id,
        activeFeedback: null,
        sched: onEvaluationFinished(s.sched, "ask", a.atSec),
      };
    }

    case "ANSWER": {
      const target = s.questions.find((q) => q.id === a.questionId);
      if (!target || target.answerIndex !== null) return s;
      if (a.from === "live" && s.activeQuestionId !== a.questionId) return s;
      const result = a.choiceIndex === target.correctIndex ? "correct" : "incorrect";
      return {
        ...s,
        questions: s.questions.map((q) =>
          q.id === a.questionId ? { ...q, answerIndex: a.choiceIndex, result, answeredFrom: a.from } : q,
        ),
        activeFeedback: a.from === "live" ? result : s.activeFeedback,
      };
    }

    case "CARD_TIMEOUT":
      // Only an unanswered card times out; it stays saved as "unanswered".
      if (s.activeQuestionId !== a.questionId || s.activeFeedback !== null) return s;
      return { ...s, activeQuestionId: null };

    case "CARD_DISMISSED":
      if (s.activeQuestionId !== a.questionId) return s;
      return { ...s, activeQuestionId: null, activeFeedback: null };

    case "END":
      if (s.phase !== "listening") return s;
      return {
        ...s,
        phase: "summary",
        connection: "idle",
        endedAtSec: a.atSec,
        interim: "",
        activeQuestionId: null,
        activeFeedback: null,
        sched: { ...s.sched, inFlight: false },
      };

    case "RESET":
      return initialSession;
  }
}
