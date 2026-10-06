// Shared shapes for the checkpoint engine (browser + server + scripts).

/** One finalized piece of transcript. Times are seconds since the session started. */
export type Segment = { id: string; text: string; start: number; end: number };

export type ConceptStatus = "understood" | "needs_review" | "unanswered";

/** What the AI is told about concepts already tested in this session. */
export type TestedConcept = {
  label: string;
  status: ConceptStatus;
  questionCount: number;
};

export type CheckpointRequest = {
  transcriptWindow: string;
  recentTail: string;
  testedConcepts: TestedConcept[];
  elapsedSec: number;
  /** About 1.5 minutes since the last quick check: ask about the latest completed point. */
  questionDue: boolean;
};

/** A validated, ready-to-show multiple-choice question. */
export type CheckpointQuestion = {
  concept: string;
  kind: "new" | "recheck";
  question: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
  evidenceQuote: string;
};

export type CheckpointResponse =
  | { decision: "ask"; question: CheckpointQuestion }
  | { decision: "wait"; reason: string; rejected?: boolean; error?: boolean };
