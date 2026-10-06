"use client";

import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import { findQuoteWords, segmentWords } from "@/lib/checkpoints/highlight";
import type { Segment } from "@/lib/checkpoints/types";

const NEAR_BOTTOM_PX = 80;
const MARK_CLASS = "bg-primary/15 text-ink underline decoration-primary/50 decoration-2 underline-offset-[6px]";

type Props = {
  segments: Segment[];
  interim: string;
  /** A quick check is on screen: on phones, give it room by shrinking the transcript. */
  compact: boolean;
  /** The active question's evidence quote — highlighted so the student sees where the question came from. */
  highlightQuote: string | null;
};

/**
 * One finalized piece of transcript. Memoized: during a long lecture only new or highlighted
 * segments re-render, instead of every word on every speech update.
 */
const SegmentText = memo(function SegmentText({
  text,
  marked,
  joinNext,
  firstPart,
  onFirstMark,
}: {
  text: string;
  /** Comma-separated word indices to highlight ("" = none). A string keeps memo comparison cheap. */
  marked: string;
  joinNext: boolean;
  firstPart: number | null;
  onFirstMark: (el: HTMLElement | null) => void;
}) {
  if (!marked) return <>{text} </>;
  const on = new Set(marked.split(",").map(Number));
  const parts = segmentWords(text);
  return (
    <>
      {parts.map((part, pi) => {
        // A space is highlighted when the words on both sides are, so the quote reads as one band.
        const hl = /^\s+$/.test(part) ? on.has(pi - 1) && on.has(pi + 1) : on.has(pi);
        if (!hl) return <span key={pi}>{part}</span>;
        return (
          <mark key={pi} ref={pi === firstPart ? onFirstMark : undefined} className={MARK_CLASS}>
            {part}
          </mark>
        );
      })}
      {joinNext ? <mark className={MARK_CLASS}> </mark> : " "}
    </>
  );
});

export function TranscriptPane({ segments, interim, compact, highlightQuote }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const markRef = useRef<HTMLElement | null>(null);
  const stickToBottom = useRef(true);

  const highlighted = useMemo(
    () => (highlightQuote ? findQuoteWords(segments, highlightQuote) : new Set<string>()),
    [segments, highlightQuote],
  );

  // Group highlighted word keys ("segment:part") per segment, and find the first one in reading order.
  const { perSegment, first } = useMemo(() => {
    const per = new Map<number, number[]>();
    for (const k of highlighted) {
      const [si, pi] = k.split(":").map(Number);
      per.set(si, [...(per.get(si) ?? []), pi]);
    }
    let f: [number, number] | null = null;
    for (const [si, parts] of per) {
      const pi = Math.min(...parts);
      if (!f || si < f[0] || (si === f[0] && pi < f[1])) f = [si, pi];
    }
    return { perSegment: per, first: f };
  }, [highlighted]);

  const onFirstMark = useCallback((el: HTMLElement | null) => {
    markRef.current = el;
  }, []);

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
            const parts = perSegment.get(si);
            const lastPart = parts ? segmentWords(s.text).length - 1 : -1;
            return (
              <SegmentText
                key={s.id}
                text={s.text}
                marked={parts ? parts.sort((a, b) => a - b).join(",") : ""}
                // the space between two segments is highlighted when the quote continues across them
                joinNext={!!parts && parts.includes(lastPart) && (perSegment.get(si + 1)?.includes(0) ?? false)}
                firstPart={first && first[0] === si ? first[1] : null}
                onFirstMark={onFirstMark}
              />
            );
          })}
          {interim && <span className="text-idle">{interim}</span>}
        </p>
      )}
    </section>
  );
}
