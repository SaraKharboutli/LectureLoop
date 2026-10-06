// All timing rules for when LectureLoop is allowed to ask a question.
// Times are in seconds of lecture time (since the session started).
// See devpost/spec.md > Checkpoint Scheduler.

export const CHECKPOINT_CONFIG = {
  /** Lecture time before the very first evaluation. */
  WARMUP_SEC: 45,
  /** Learner decision: aim for a quick check about every 1.5 minutes. After this, a question is "due". */
  TARGET_GAP_SEC: 90,
  /** Minimum time between two questions being shown (learner: "a question every 1.5–2 minutes"). */
  MIN_GAP_SEC: 75,
  /** New lecture time required since the last evaluation. */
  MIN_NEW_SPEECH_SEC: 20,
  /** New lecture time required after the AI answered "wait". */
  MIN_NEW_SPEECH_AFTER_WAIT_SEC: 15,
  /** If a question is due but no sentence has ended for this long, evaluate anyway. */
  DUE_GRACE_SEC: 20,
  /** If the lecturer never finishes a sentence, evaluate anyway after this much new speech. */
  NO_BOUNDARY_FALLBACK_SEC: 90,
  /** How often the fallback timer checks (live mode only). */
  FALLBACK_TICK_SEC: 5,
  /** An unanswered card disappears after this long (≤ MIN_GAP_SEC, so cards never replace each other mid-read). */
  CARD_TIMEOUT_SEC: 60,
  /** Original question + one re-check. */
  MAX_QUESTIONS_PER_CONCEPT: 2,

  /** Transcript sent to the AI: the most recent N seconds… */
  WINDOW_SEC: 480,
  /** …capped at this many words. */
  WINDOW_MAX_WORDS: 1800,
  /** The "what is being said right now" tail. */
  TAIL_SEC: 30,
} as const;

export const DEFAULT_MODEL = "claude-sonnet-5-5";

export function getModel(): string {
  return process.env.CLAUDE_MODEL?.trim() || DEFAULT_MODEL;
}

/**
 * Which route reaches Claude. Vercel AI Gateway (if AI_GATEWAY_API_KEY is set)
 * speaks the same Anthropic Messages API; otherwise we call Anthropic directly.
 */
export type ClaudeProvider = { name: "vercel-ai-gateway" | "anthropic"; apiKey: string; baseURL?: string };

export const AI_GATEWAY_BASE_URL = "https://ai-gateway.vercel.sh";

export function getClaudeProvider(): ClaudeProvider | null {
  const gateway = process.env.AI_GATEWAY_API_KEY?.trim();
  if (gateway) return { name: "vercel-ai-gateway", apiKey: gateway, baseURL: AI_GATEWAY_BASE_URL };
  const anthropic = process.env.ANTHROPIC_API_KEY?.trim();
  if (anthropic) return { name: "anthropic", apiKey: anthropic };
  return null;
}

/** Same model, provider-specific ID: "claude-sonnet-5-5" → "anthropic/claude-sonnet-5.5" on the gateway. */
export function providerModelId(model: string, provider: ClaudeProvider["name"]): string {
  if (provider !== "vercel-ai-gateway" || model.includes("/")) return model;
  return `anthropic/${model.replace(/-(\d+)-(\d+)$/, "-$1.$2")}`;
}
