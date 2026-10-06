import { beforeEach, describe, expect, it, vi } from "vitest";
import { deriveConcepts } from "@/lib/session/mastery";
import {
  answerInLecture,
  deleteLecture,
  loadLectures,
  MAX_SAVED_LECTURES,
  retryInLecture,
  upsertLecture,
  type SavedLecture,
} from "@/lib/session/savedLectures";
import type { Question } from "@/lib/session/types";

const q = (id: string, over: Partial<Question> = {}): Question => ({
  id,
  concept: "Law of demand",
  conceptKey: "law of demand",
  kind: "new",
  question: "What happens when price rises?",
  choices: ["Quantity demanded falls", "Rises", "Same", "Shifts"],
  correctIndex: 0,
  explanation: "Opposite directions.",
  evidenceQuote: "when the price of a good rises the quantity demanded falls",
  askedAt: 90,
  answerIndex: null,
  result: "unanswered",
  ...over,
});

const lecture = (id: string, savedAt: number, questions: Question[] = []): SavedLecture => ({
  id,
  savedAt,
  durationSec: 300,
  transcript: "Today we talk about demand.",
  questions,
});

beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
});

describe("saved lectures", () => {
  it("saves, lists newest first, replaces by id, and deletes", () => {
    upsertLecture(lecture("a", 1));
    upsertLecture(lecture("b", 2));
    expect(loadLectures().map((l) => l.id)).toEqual(["b", "a"]);
    upsertLecture({ ...lecture("a", 1), durationSec: 999 });
    expect(loadLectures()).toHaveLength(2);
    expect(loadLectures().find((l) => l.id === "a")?.durationSec).toBe(999);
    deleteLecture("b");
    expect(loadLectures().map((l) => l.id)).toEqual(["a"]);
  });

  it("keeps only the newest lectures", () => {
    for (let i = 0; i < MAX_SAVED_LECTURES + 5; i++) upsertLecture(lecture(`l${i}`, i));
    const all = loadLectures();
    expect(all).toHaveLength(MAX_SAVED_LECTURES);
    expect(all[0].id).toBe(`l${MAX_SAVED_LECTURES + 4}`);
  });

  it("survives unavailable storage without crashing", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    });
    expect(loadLectures()).toEqual([]);
    expect(() => upsertLecture(lecture("a", 1))).not.toThrow();
  });

  it("answers a missed question from a saved lecture", () => {
    const l = answerInLecture(lecture("a", 1, [q("q1")]), "q1", 0);
    expect(l.questions[0]).toMatchObject({ result: "correct", answeredFrom: "summary" });
  });

  it("retrying a wrong answer and getting it right marks the concept understood after review", () => {
    let l = lecture("a", 1, [q("q1", { answerIndex: 2, result: "incorrect" })]);
    l = retryInLecture(l, "q1", "q1-retry");
    expect(l.questions).toHaveLength(2);
    expect(l.questions[1]).toMatchObject({ kind: "recheck", answerIndex: null });
    l = answerInLecture(l, "q1-retry", 0);
    expect(deriveConcepts(l.questions)[0]).toMatchObject({ status: "understood", afterReview: true });
  });
});
