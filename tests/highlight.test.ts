import { describe, expect, it } from "vitest";
import { findQuoteWords, segmentWords } from "@/lib/checkpoints/highlight";
import type { Segment } from "@/lib/checkpoints/types";

const seg = (text: string, i: number): Segment => ({ id: `s${i}`, text, start: i * 3, end: i * 3 + 3 });
const segments = [
  "So the light-dependent reactions happen in the thylakoid membranes.",
  "They capture light energy,",
  "and use it to make ATP and NADPH.",
  "Okay, now the Calvin cycle.",
].map(seg);

const highlighted = (keys: Set<string>) =>
  [...keys].map((k) => {
    const [si, pi] = k.split(":").map(Number);
    return segmentWords(segments[si].text)[pi];
  });

describe("findQuoteWords", () => {
  it("finds an exact quote that spans segments", () => {
    const words = highlighted(findQuoteWords(segments, "They capture light energy, and use it to make ATP and NADPH."));
    expect(words.join(" ")).toBe("They capture light energy, and use it to make ATP and NADPH.");
  });

  it("tolerates small recognition differences", () => {
    const words = highlighted(findQuoteWords(segments, "they capture the light energy and use it to make ATP and NADPH"));
    expect(words).toContain("NADPH.");
    expect(words).toContain("capture");
  });

  it("handles hyphenated words", () => {
    expect(highlighted(findQuoteWords(segments, "the light-dependent reactions happen in the thylakoid"))).toContain(
      "light-dependent",
    );
  });

  it("returns nothing for text that was never said", () => {
    expect(findQuoteWords(segments, "Photosystem two splits water to release oxygen gas").size).toBe(0);
  });
});
