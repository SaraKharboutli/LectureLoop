"use client";

import { useEffect, useRef } from "react";
import type { Segment } from "@/lib/checkpoints/types";

const NEAR_BOTTOM_PX = 80;

export function TranscriptPane({
  segments,
  interim,
  compact,
}: {
  segments: Segment[];
  interim: string;
  /** A quick check is on screen: give it room by shrinking the transcript. */
  compact: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  useEffect(() => {
    const el = ref.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [segments.length, interim, compact]);

  const onScroll = () => {
    const el = ref.current;
    if (el) stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
  };

  const empty = segments.length === 0 && !interim;

  return (
    <section
      ref={ref}
      onScroll={onScroll}
      aria-label="Live lecture transcript"
      aria-live="off"
      className={`min-h-0 overflow-y-auto px-5 py-4 text-[17px] leading-8 sm:text-lg ${compact ? "flex-[34]" : "flex-[58]"}`}
    >
      {empty ? (
        <p className="pt-6 text-center text-idle">The lecture will appear here as it&apos;s spoken…</p>
      ) : (
        <p>
          {segments.map((s) => (
            <span key={s.id}>{s.text} </span>
          ))}
          {interim && <span className="text-idle">{interim}</span>}
        </p>
      )}
    </section>
  );
}
