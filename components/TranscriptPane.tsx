"use client";

import { useEffect, useMemo, useRef } from "react";
import { findQuoteWords, segmentWords } from "@/lib/checkpoints/highlight";
import type { Segment } from "@/lib/checkpoints/types";

const NEAR_BOTTOM_PX = 80;

type Props = {
  segments: Segment[];
  interim: string;
  /** A quick check is on screen: on phones, give it room by shrinking the transcript. */
  compact: boolean;
  /** The active question's evidence quote — highlighted so the student sees where the question came from. */
  highlightQuote: string | null;
};

export function TranscriptPane({ segments, interim, compact, highlightQuote }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const markRef = useRef<HTMLElement | null>(null);
  const stickToBottom = useRef(true);

  const highlighted = useMemo(
    () => (highlightQuote ? findQuoteWords(segments, highlightQuote) : new Set<string>()),
    [segments, highlightQuote],
  );
  // The first highlighted word (in reading order) is what gets scrolled into view.
  const firstKey = useMemo(() => {
    let first: string | null = null;
    let best = [Infinity, Infinity];
    for (const k of highlighted) {
      const [si, pi] = k.split(":").map(Number);
      if (si < best[0] || (si === best[0] && pi < best[1])) {
        best = [si, pi];
        first = k;
      }
    }
    return first;
  }, [highlighted]);

  // While a question is showing, bring its source sentence into view; otherwise follow the newest words.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (highlighted.size === 0) markRef.current = null;
    if (highlighted.size > 0 && markRef.current) {
      markRef.current.scrollIntoView({ block: "center", behavior: "smooth" });
    } else if (stickToBottom.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [segments.length, interim, compact, highlighted]);

  const onScroll = () => {
    const el = ref.current;
    if (el && highlighted.size === 0) {
      stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    }
  };

  const empty = segments.length === 0 && !interim;

  return (
    <section
      ref={ref}
      onScroll={onScroll}
      aria-label="Live lecture transcript"
      aria-live="off"
      className={`min-h-0 overflow-y-auto px-5 py-4 text-[17px] leading-8 sm:text-lg lg:flex-1 lg:px-10 lg:py-8 lg:text-[19px] lg:leading-9 ${
        compact ? "flex-[34]" : "flex-[58]"
      }`}
    >
      {empty ? (
        <p className="pt-6 text-center text-idle">The lecture will appear here as it&apos;s spoken…</p>
      ) : (
        <p className="mx-auto max-w-[68ch]">
          {segments.map((s, si) => {
            const parts = segmentWords(s.text);
            // The space between two segments is highlighted when the quote continues across them.
            const joinOn = highlighted.has(`${si}:${parts.length - 1}`) && highlighted.has(`${si + 1}:0`);
            return (
            <span key={s.id}>
              {parts.map((part, pi) => {
                // A space is highlighted when the words on both sides are, so the quote reads as one band.
                const on = /^\s+$/.test(part)
                  ? highlighted.has(`${si}:${pi - 1}`) && highlighted.has(`${si}:${pi + 1}`)
                  : highlighted.has(`${si}:${pi}`);
                if (!on) return <span key={pi}>{part}</span>;
                return (
                  <mark
                    key={pi}
                    ref={`${si}:${pi}` === firstKey ? (el) => void (markRef.current = el) : undefined}
                    className="bg-primary/15 text-ink underline decoration-primary/50 decoration-2 underline-offset-[6px]"
                  >
                    {part}
                  </mark>
                );
              })}
              {joinOn ? <mark className="bg-primary/15 underline decoration-primary/50 decoration-2 underline-offset-[6px]"> </mark> : " "}
            </span>
            );
          })}
          {interim && <span className="text-idle">{interim}</span>}
        </p>
      )}
    </section>
  );
}
