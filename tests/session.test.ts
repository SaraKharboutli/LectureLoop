import { describe, expect, it } from "vitest";
import type { CheckpointQuestion } from "@/lib/checkpoints/types";
import { deriveConcepts, masteryCounts, toTestedConcepts } from "@/lib/session/mastery";
import { initialSession, sessionReducer, type Action } from "@/lib/session/reducer";
import type { Session } from "@/lib/session/types";

const q = (concept: string, over: Partial<CheckpointQuestion> = {}): CheckpointQuestion => ({
  concept,
  kind: "new",
  question: `About ${concept}?`,
  choices: ["right", "w1", "w2", "w3"],
  correctIndex: 0,
  explanation: "Because the lecturer said so.",
  evidenceQuote: "some words the lecturer really said here",
  ...over,
});

const run = (...actions: Action[]): Session => actions.reduce(sessionReducer, initialSession);
const started: Action = { type: "START", at: 1000 };
const seg = (id: string, end: number): Action => ({ type: "FINAL_SEGMENT", segment: { id, text: `text ${id}`, start: end - 2, end } });

describe("transcript", () => {
  it("appends final segments, clears interim text, and advances lecture time", () => {
    const s = run(started, { type: "INTERIM", text: "photo syn" }, seg("a", 5), { type: "INTERIM", text: "next" }, seg("b", 9));
    expect(s.segments.map((x) => x.id)).toEqual(["a", "b"]);
    expect(s.interim).toBe("");
    expect(s.sched.speechSec).toBe(9);
  });

  it("ignores transcript events before start", () => {
    expect(run(seg("a", 5)).segments).toHaveLength(0);
  });

  it("goes back to start with a message when the mic is denied", () => {
    const s = run({ type: "MIC_ERROR", message: "blocked" });
    expect(s.phase).toBe("start");
    expect(s.micError).toBe("blocked");
  });
});

describe("quick check cards", () => {
  const shown = (id: string, concept: string, atSec = 100): Action => ({
    type: "QUESTION_SHOWN",
    id,
    question: q(concept),
    atSec,
  });

  it("shows a question as the active card and records when", () => {
    const s = run(started, { type: "EVAL_STARTED" }, shown("q1", "Law of demand"));
    expect(s.activeQuestionId).toBe("q1");
    expect(s.sched.lastQuestionAt).toBe(100);
    expect(s.sched.inFlight).toBe(false);
  });

  it("records a correct live answer and shows positive feedback", () => {
    const s = run(started, shown("q1", "A"), { type: "ANSWER", questionId: "q1", choiceIndex: 0, from: "live" });
    expect(s.questions[0].result).toBe("correct");
    expect(s.activeFeedback).toBe("correct");
  });

  it("records an incorrect answer, and answers are final", () => {
    const s = run(
      started,
      shown("q1", "A"),
      { type: "ANSWER", questionId: "q1", choiceIndex: 2, from: "live" },
      { type: "ANSWER", questionId: "q1", choiceIndex: 0, from: "live" },
    );
    expect(s.questions[0].result).toBe("incorrect");
    expect(s.questions[0].answerIndex).toBe(2);
  });

  it("times out an ignored card but keeps the question as unanswered", () => {
    const s = run(started, shown("q1", "A"), { type: "CARD_TIMEOUT", questionId: "q1" });
    expect(s.activeQuestionId).toBeNull();
    expect(s.questions[0].result).toBe("unanswered");
  });

  it("does not time out a card that is showing feedback", () => {
    const s = run(
      started,
      shown("q1", "A"),
      { type: "ANSWER", questionId: "q1", choiceIndex: 1, from: "live" },
      { type: "CARD_TIMEOUT", questionId: "q1" },
    );
    expect(s.activeQuestionId).toBe("q1");
  });

  it("dismisses a card after feedback", () => {
    const s = run(
      started,
      shown("q1", "A"),
      { type: "ANSWER", questionId: "q1", choiceIndex: 0, from: "live" },
      { type: "CARD_DISMISSED", questionId: "q1" },
    );
    expect(s.activeQuestionId).toBeNull();
    expect(s.activeFeedback).toBeNull();
  });
});

describe("ending and summary", () => {
  it("End counts the open card as unanswered and stops accepting AI results", () => {
    const s = run(
      started,
      { type: "QUESTION_SHOWN", id: "q1", question: q("A"), atSec: 100 },
      { type: "EVAL_STARTED" },
      { type: "END", atSec: 200 },
      { type: "QUESTION_SHOWN", id: "late", question: q("B"), atSec: 205 },
      { type: "EVAL_DONE", atSec: 205 },
    );
    expect(s.phase).toBe("summary");
    expect(s.activeQuestionId).toBeNull();
    expect(s.questions.map((x) => x.id)).toEqual(["q1"]);
    expect(s.questions[0].result).toBe("unanswered");
  });

  it("lets unanswered questions be answered from the summary", () => {
    const s = run(
      started,
      { type: "QUESTION_SHOWN", id: "q1", question: q("A"), atSec: 100 },
      { type: "END", atSec: 200 },
      { type: "ANSWER", questionId: "q1", choiceIndex: 0, from: "summary" },
    );
    expect(s.questions[0]).toMatchObject({ result: "correct", answeredFrom: "summary" });
    expect(masteryCounts(deriveConcepts(s.questions))).toEqual({ understood: 1, needsReview: 0, unanswered: 0 });
  });

  it("New session clears everything", () => {
    expect(run(started, seg("a", 5), { type: "RESET" })).toEqual(initialSession);
  });
});

describe("mastery", () => {
  it("derives per-concept status from the latest answered question, including re-checks", () => {
    const s = run(
      started,
      { type: "QUESTION_SHOWN", id: "q1", question: q("Law of demand"), atSec: 100 },
      { type: "ANSWER", questionId: "q1", choiceIndex: 3, from: "live" },
      { type: "QUESTION_SHOWN", id: "q2", question: q("Equilibrium"), atSec: 250 },
      { type: "QUESTION_SHOWN", id: "q3", question: q("Law of demand", { kind: "recheck" }), atSec: 400 },
      { type: "ANSWER", questionId: "q3", choiceIndex: 0, from: "live" },
      { type: "QUESTION_SHOWN", id: "q4", question: q("Price ceiling"), atSec: 550 },
      { type: "ANSWER", questionId: "q4", choiceIndex: 1, from: "live" },
    );
    const concepts = deriveConcepts(s.questions);
    expect(concepts.map((c) => [c.label, c.status, c.afterReview])).toEqual([
      ["Law of demand", "understood", true],
      ["Equilibrium", "unanswered", false],
      ["Price ceiling", "needs_review", false],
    ]);
    expect(masteryCounts(concepts)).toEqual({ understood: 1, needsReview: 1, unanswered: 1 });
    expect(toTestedConcepts(s.questions)[0]).toEqual({ label: "Law of demand", status: "understood", questionCount: 2 });
  });
});
