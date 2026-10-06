// The fixed answer format Claude must return (structured output).
// See spec.md > Checkpoint Route (AI decision + question).

import { z } from "zod";

export const CheckpointDecisionSchema = z.object({
  reason: z
    .string()
    .describe("One short sentence: why ask now, or why wait."),
  decision: z.enum(["ask", "wait"]),
  concept: z
    .string()
    .describe("Short label for the concept being tested (2-6 words). Empty when waiting."),
  kind: z
    .enum(["new", "recheck"])
    .describe("'recheck' only for a needs_review concept the lecturer has revisited."),
  importance: z.enum(["high", "medium", "low"]),
  question: z.string().describe("The question. Empty when waiting."),
  choices: z
    .array(z.string())
    .describe("Exactly 4 short answer choices when asking (max ~12 words each). Empty when waiting."),
  correct_index: z
    .number()
    .int()
    .describe("Index (0-3) of the correct choice. 0 when waiting."),
  explanation: z
    .string()
    .describe("One sentence explaining the correct answer using what the lecturer said. Empty when waiting."),
  evidence_quote: z
    .string()
    .describe(
      "A word-for-word span copied from TRANSCRIPT (no [mm:ss] markers, 8-40 words) that proves the correct answer. Empty when waiting.",
    ),
});

export type CheckpointDecision = z.infer<typeof CheckpointDecisionSchema>;
