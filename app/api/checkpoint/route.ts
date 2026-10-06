// POST /api/checkpoint — the browser sends recent lecture text; we reply "wait" or a validated question.
// The Anthropic key stays on the server.

import { appendFile, mkdir } from "node:fs/promises";
import { z } from "zod";
import { evaluateCheckpoint } from "@/lib/checkpoints/evaluate";
import type { CheckpointResponse } from "@/lib/checkpoints/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const RequestSchema = z.object({
  transcriptWindow: z.string().min(1).max(20_000),
  recentTail: z.string().max(4_000),
  testedConcepts: z
    .array(
      z.object({
        label: z.string().max(200),
        status: z.enum(["understood", "needs_review", "unanswered"]),
        questionCount: z.number().int().min(0).max(10),
      }),
    )
    .max(100),
  elapsedSec: z.number().min(0).max(6 * 3600),
  questionDue: z.boolean(),
});

export async function POST(request: Request) {
  const parsed = RequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ decision: "wait", reason: "invalid request", error: true } satisfies CheckpointResponse, {
      status: 400,
    });
  }

  const result = await evaluateCheckpoint(parsed.data);
  const r = result.response;
  console.log(
    `[checkpoint] ${result.provider}/${result.model} ${result.latencyMs}ms → ${r.decision}${
      r.decision === "wait" ? ` (${r.reason})` : `: ${r.question.concept}`
    }`,
  );
  if (process.env.NODE_ENV === "development") {
    // DEV ONLY: keep every decision with the exact transcript the AI saw, for tuning (tmp/ is git-ignored).
    await mkdir("tmp", { recursive: true });
    await appendFile(
      "tmp/checkpoint-log.jsonl",
      JSON.stringify({ at: new Date().toISOString(), model: result.model, latencyMs: result.latencyMs, request: parsed.data, raw: result.raw, response: r }) + "\n",
    );
  }
  if (process.env.NODE_ENV === "development" && r.decision === "ask") {
    const q = r.question;
    console.log(
      `[checkpoint]   at ${Math.round(parsed.data.elapsedSec)}s · Q: ${q.question}\n` +
        q.choices.map((c, i) => `[checkpoint]     ${i === q.correctIndex ? "✓" : " "} ${c}`).join("\n") +
        `\n[checkpoint]   quote: "${q.evidenceQuote}"`,
    );
  }
  return Response.json(r, { headers: { "Cache-Control": "no-store" } });
}
