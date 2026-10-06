// Turns the list of questions into per-concept understanding (pure, unit-tested).
// See prd.md > Understanding tracking.

import type { ConceptStatus, TestedConcept } from "@/lib/checkpoints/types";
import type { Question } from "./types";

export type ConceptSummary = {
  key: string;
  label: string;
  status: ConceptStatus;
  /** Understood on a later question after an earlier miss. */
  afterReview: boolean;
  questions: Question[];
};

export function deriveConcepts(questions: Question[]): ConceptSummary[] {
  const groups = new Map<string, Question[]>();
  for (const q of questions) groups.set(q.conceptKey, [...(groups.get(q.conceptKey) ?? []), q]);

  return [...groups.entries()].map(([key, qs]) => {
    const answered = qs.filter((q) => q.answerIndex !== null);
    const latest = answered[answered.length - 1];
    const status: ConceptStatus = !latest ? "unanswered" : latest.result === "correct" ? "understood" : "needs_review";
    const afterReview =
      status === "understood" && answered.slice(0, -1).some((q) => q.result === "incorrect");
    return { key, label: qs[0].concept, status, afterReview, questions: qs };
  });
}

export function masteryCounts(concepts: ConceptSummary[]) {
  return {
    understood: concepts.filter((c) => c.status === "understood").length,
    needsReview: concepts.filter((c) => c.status === "needs_review").length,
    unanswered: concepts.filter((c) => c.status === "unanswered").length,
  };
}

/** What the AI is told about concepts already covered. */
export function toTestedConcepts(questions: Question[]): TestedConcept[] {
  return deriveConcepts(questions).map((c) => ({
    label: c.label,
    status: c.status,
    questionCount: c.questions.length,
  }));
}
