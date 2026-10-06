import { describe, expect, it } from "vitest";
import type { CheckpointDecision } from "@/lib/checkpoints/schema";
import { conceptSimilarity, isGrounded, shuffleChoices, validateDecision } from "@/lib/checkpoints/validate";

const TRANSCRIPT = `[01:10] So the light-dependent reactions happen in the thylakoid membranes. They capture light energy and use it to make ATP and NADPH.
[01:30] Those two molecules are the energy carriers that the Calvin cycle will use next.`;

const ask = (over: Partial<CheckpointDecision> = {}): CheckpointDecision => ({
  reason: "The light-dependent reactions were fully explained.",
  decision: "ask",
  concept: "Light-dependent reactions",
  kind: "new",
  importance: "high",
  question: "What do the light-dependent reactions produce?",
  choices: ["ATP and NADPH", "Glucose directly", "Oxygen-free DNA", "Amino acids"],
  correct_index: 0,
  explanation: "The lecturer said they capture light energy to make ATP and NADPH.",
  evidence_quote: "They capture light energy and use it to make ATP and NADPH.",
  ...over,
});

const ctx = { transcriptWindow: TRANSCRIPT, testedConcepts: [], random: () => 0 };

describe("isGrounded", () => {
  it("accepts an exact quote, ignoring case and punctuation", () => {
    expect(isGrounded("they capture light energy, and use it to make ATP and NADPH", TRANSCRIPT)).toBe(true);
  });
  it("accepts a quote with a small transcription difference", () => {
    expect(isGrounded("They capture the light energy and use it to make ATP and NADPH", TRANSCRIPT)).toBe(true);
  });
  it("accepts a quote that spans two transcript lines", () => {
    expect(isGrounded("make ATP and NADPH. Those two molecules are the energy carriers", TRANSCRIPT)).toBe(true);
  });
  it("rejects invented content", () => {
    expect(isGrounded("Photosystem II splits water molecules to release oxygen gas", TRANSCRIPT)).toBe(false);
  });
  it("rejects quotes that are too short to prove anything", () => {
    expect(isGrounded("ATP and NADPH", TRANSCRIPT)).toBe(false);
  });
});

describe("validateDecision", () => {
  it("passes a grounded, well-formed question", () => {
    const r = validateDecision(ask(), ctx);
    expect(r.decision).toBe("ask");
    if (r.decision === "ask") {
      expect(r.question.choices[r.question.correctIndex]).toBe("ATP and NADPH");
      expect(r.question.kind).toBe("new");
    }
  });

  it("passes through a wait verdict", () => {
    expect(validateDecision(ask({ decision: "wait", reason: "still explaining" }), ctx)).toEqual({
      decision: "wait",
      reason: "still explaining",
    });
  });

  it("rejects an ungrounded evidence quote", () => {
    const r = validateDecision(ask({ evidence_quote: "Photosystem II splits water molecules to release oxygen gas" }), ctx);
    expect(r).toMatchObject({ decision: "wait", rejected: true });
  });

  it("rejects low-importance questions", () => {
    expect(validateDecision(ask({ importance: "low" }), ctx)).toMatchObject({ rejected: true });
  });

  it("rejects bad choice sets", () => {
    expect(validateDecision(ask({ choices: ["A", "B", "C"] }), ctx)).toMatchObject({ rejected: true });
    expect(validateDecision(ask({ choices: ["A", "B", "C", "a"] }), ctx)).toMatchObject({ rejected: true });
    expect(validateDecision(ask({ correct_index: 4 }), ctx)).toMatchObject({ rejected: true });
  });

  it("rejects a concept that was already tested and understood", () => {
    const r = validateDecision(ask({ concept: "The light-dependent reactions" }), {
      ...ctx,
      testedConcepts: [{ label: "Light-dependent reactions", status: "understood", questionCount: 1 }],
    });
    expect(r).toMatchObject({ rejected: true });
  });

  it("turns a repeat of a needs-review concept into a re-check with the original label", () => {
    const r = validateDecision(ask({ concept: "Light dependent reaction" }), {
      ...ctx,
      testedConcepts: [{ label: "Light-dependent reactions", status: "needs_review", questionCount: 1 }],
    });
    expect(r.decision).toBe("ask");
    if (r.decision === "ask") {
      expect(r.question.kind).toBe("recheck");
      expect(r.question.concept).toBe("Light-dependent reactions");
    }
  });

  it("stops after the re-check limit", () => {
    const r = validateDecision(ask(), {
      ...ctx,
      testedConcepts: [{ label: "Light-dependent reactions", status: "needs_review", questionCount: 2 }],
    });
    expect(r).toMatchObject({ rejected: true });
  });

  it("rejects a re-check of an untested concept", () => {
    expect(validateDecision(ask({ kind: "recheck" }), ctx)).toMatchObject({ rejected: true });
  });
});

describe("helpers", () => {
  it("scores similar concept labels highly", () => {
    expect(conceptSimilarity("Law of demand", "The law of demand")).toBe(1);
    expect(conceptSimilarity("Law of demand", "Market equilibrium")).toBe(0);
  });

  it("keeps the correct answer tracked through a shuffle", () => {
    const choices = ["right", "w1", "w2", "w3"];
    for (const seed of [0, 0.3, 0.6, 0.99]) {
      const s = shuffleChoices(choices, 0, () => seed);
      expect(s.choices[s.correctIndex]).toBe("right");
      expect([...s.choices].sort()).toEqual([...choices].sort());
    }
  });
});
