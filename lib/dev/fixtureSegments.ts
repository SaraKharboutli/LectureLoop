// TEST/DEV ONLY: turns a written lecture fixture into timed transcript segments,
// as if a lecturer were speaking it at a normal pace. Used by the replay script
// and the development-only ?devfeed option. Never used for real sessions.
//
// With { fragment: true }, sentences are also split at commas/semicolons/colons into
// separate segments — like real speech-to-text, which finalizes text at every short
// breath, often mid-sentence.

import type { Segment } from "@/lib/checkpoints/types";

const WORDS_PER_SEC = 2.5; // ~150 words per minute
const BREATH_PAUSE_SEC = 0.3;
const SENTENCE_PAUSE_SEC = 0.4;
const PARAGRAPH_PAUSE_SEC = 1.5;

export function fixtureToSegments(text: string, opts: { fragment?: boolean } = {}): Segment[] {
  const segments: Segment[] = [];
  let t = 0;
  const push = (piece: string, pauseAfter: number) => {
    const words = piece.split(/\s+/).length;
    segments.push({ id: `fx-${segments.length}`, text: piece, start: t, end: t + words / WORDS_PER_SEC });
    t += words / WORDS_PER_SEC + pauseAfter;
  };

  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  for (const paragraph of paragraphs) {
    const sentences = paragraph.match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) ?? [paragraph];
    for (const raw of sentences) {
      const sentence = raw.trim();
      if (!sentence) continue;
      const pieces = opts.fragment
        ? (sentence.match(/[^,;:]+[,;:]?/g) ?? [sentence]).map((p) => p.trim()).filter(Boolean)
        : [sentence];
      pieces.forEach((piece, i) => push(piece, i === pieces.length - 1 ? SENTENCE_PAUSE_SEC : BREATH_PAUSE_SEC));
    }
    t += PARAGRAPH_PAUSE_SEC - SENTENCE_PAUSE_SEC;
  }
  return segments;
}
