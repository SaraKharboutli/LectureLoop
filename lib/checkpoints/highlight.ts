// Finds where a question's evidence quote sits in the transcript, so the UI can highlight
// "this is what the lecturer said" while the Quick Check is on screen. Pure, unit-tested.

import type { Segment } from "./types";
import { normalizeText } from "./validate";

const FUZZY = 0.85;

/** Words of each segment, split so the UI can render them with highlights (spaces kept as separate parts). */
export function segmentWords(text: string): string[] {
  return text.split(/(\s+)/).filter((p) => p.length > 0);
}

/** Returns keys "segmentIndex:partIndex" of the transcript words that make up the quote (empty if not found). */
export function findQuoteWords(segments: Segment[], quote: string): Set<string> {
  const q = normalizeText(quote).split(" ").filter(Boolean);
  const result = new Set<string>();
  if (q.length === 0) return result;

  // Flatten the transcript into normalized words that remember where they came from.
  const flat: { norm: string; key: string }[] = [];
  segments.forEach((seg, si) => {
    segmentWords(seg.text).forEach((part, pi) => {
      if (/^\s+$/.test(part)) return;
      for (const w of normalizeText(part).split(" ").filter(Boolean)) flat.push({ norm: w, key: `${si}:${pi}` });
    });
  });

  let bestStart = -1;
  let bestLen = 0;
  // Exact match first (search from the end: the quote is usually recent).
  for (let i = flat.length - q.length; i >= 0; i--) {
    if (q.every((w, k) => flat[i + k].norm === w)) {
      bestStart = i;
      bestLen = q.length;
      break;
    }
  }
  // Tolerant match for small speech-to-text differences.
  if (bestStart < 0) {
    const span = Math.ceil(q.length * 1.3);
    let bestScore = 0;
    for (let i = 0; i < flat.length; i++) {
      if (flat[i].norm !== q[0] && flat[i].norm !== q[1]) continue;
      const window = flat.slice(i, i + span).map((f) => f.norm);
      const score = lcs(q, window);
      if (score > bestScore) {
        bestScore = score;
        bestStart = i;
        bestLen = Math.min(span, flat.length - i);
      }
    }
    if (bestScore < Math.ceil(q.length * FUZZY)) return result;
  }

  for (let k = bestStart; k < bestStart + bestLen; k++) result.add(flat[k].key);
  return result;
}

function lcs(a: string[], b: string[]): number {
  const prev = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    let diag = 0;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = a[i - 1] === b[j - 1] ? diag + 1 : Math.max(prev[j], prev[j - 1]);
      diag = tmp;
    }
  }
  return prev[b.length];
}
