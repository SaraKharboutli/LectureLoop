// Builds the transcript text the AI sees: a recent window with [mm:ss] markers,
// plus the last few seconds ("recent tail") so it can tell if an idea is still being explained.

import { CHECKPOINT_CONFIG as C } from "./config";
import type { Segment } from "./types";

export function formatClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

const LINE_SPAN_SEC = 20;

export function buildWindow(segments: Segment[]): { transcriptWindow: string; recentTail: string } {
  if (segments.length === 0) return { transcriptWindow: "", recentTail: "" };
  const lastEnd = segments[segments.length - 1].end;

  // Most recent segments within WINDOW_SEC, then trim from the oldest side to the word cap.
  let recent = segments.filter((s) => s.end >= lastEnd - C.WINDOW_SEC);
  let words = recent.reduce((n, s) => n + countWords(s.text), 0);
  while (recent.length > 1 && words > C.WINDOW_MAX_WORDS) {
    words -= countWords(recent[0].text);
    recent = recent.slice(1);
  }

  // Group into lines of ~20 s so the AI can see timing without one line per fragment.
  const lines: string[] = [];
  let lineStart = recent[0].start;
  let buf: string[] = [];
  for (const seg of recent) {
    if (buf.length > 0 && seg.start - lineStart >= LINE_SPAN_SEC) {
      lines.push(`[${formatClock(lineStart)}] ${buf.join(" ")}`);
      buf = [];
      lineStart = seg.start;
    }
    buf.push(seg.text.trim());
  }
  if (buf.length) lines.push(`[${formatClock(lineStart)}] ${buf.join(" ")}`);

  const recentTail = segments
    .filter((s) => s.end >= lastEnd - C.TAIL_SEC)
    .map((s) => s.text.trim())
    .join(" ");

  return { transcriptWindow: lines.join("\n"), recentTail };
}

function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}
