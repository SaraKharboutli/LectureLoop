// Server-only: asks Claude whether to ask a question now, then validates the answer.
// Shared by app/api/checkpoint/route.ts and scripts/replay-transcript.ts.

import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getClaudeProvider, getModel, providerModelId, type ClaudeProvider } from "./config";
import { buildUserMessage, SYSTEM_PROMPT } from "./prompt";
import { CheckpointDecisionSchema, type CheckpointDecision } from "./schema";
import type { CheckpointRequest, CheckpointResponse } from "./types";
import { validateDecision } from "./validate";

export type EvaluationResult = {
  response: CheckpointResponse;
  /** The AI's raw proposal (before validation), for logs and the replay script. */
  raw: CheckpointDecision | null;
  usage: { inputTokens: number; outputTokens: number } | null;
  model: string;
  provider: ClaudeProvider["name"] | "none";
  latencyMs: number;
};

const clients = new Map<string, Anthropic>();
function getClient(p: ClaudeProvider): Anthropic {
  const key = `${p.name}:${p.apiKey}`;
  let c = clients.get(key);
  if (!c) {
    c = new Anthropic({ apiKey: p.apiKey, baseURL: p.baseURL, timeout: 30_000, maxRetries: 1 });
    clients.set(key, c);
  }
  return c;
}

/** One Claude call with the structured-output schema. Same prompt, schema and effort on both routes. */
async function callClaude(p: ClaudeProvider, model: string, req: CheckpointRequest) {
  const client = getClient(p);
  const common = {
    model: providerModelId(model, p.name),
    max_tokens: 8000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user" as const, content: buildUserMessage(req) }],
  };
  if (p.name === "anthropic") {
    // Direct API: also enable Anthropic's server-side fallback if the model declines a request.
    return client.beta.messages.parse({
      ...common,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: betaZodOutputFormat(CheckpointDecisionSchema) },
    });
  }
  return client.messages.parse({
    ...common,
    output_config: { effort: "low", format: zodOutputFormat(CheckpointDecisionSchema) },
  });
}

export async function evaluateCheckpoint(
  req: CheckpointRequest,
  opts: { model?: string } = {},
): Promise<EvaluationResult> {
  const model = opts.model ?? getModel();
  const provider = getClaudeProvider();
  const started = Date.now();
  const done = (
    response: CheckpointResponse,
    raw: CheckpointDecision | null = null,
    usage: EvaluationResult["usage"] = null,
  ): EvaluationResult => ({
    response,
    raw,
    usage,
    model,
    provider: provider?.name ?? "none",
    latencyMs: Date.now() - started,
  });

  if (!provider) {
    return done({ decision: "wait", reason: "no AI key set (AI_GATEWAY_API_KEY or ANTHROPIC_API_KEY)", error: true });
  }

  try {
    const message = await callClaude(provider, model, req);
    const usage = { inputTokens: message.usage.input_tokens, outputTokens: message.usage.output_tokens };
    if (message.stop_reason === "refusal") {
      return done({ decision: "wait", reason: "model declined", error: true }, null, usage);
    }
    const raw = message.parsed_output;
    if (!raw) {
      return done({ decision: "wait", reason: `no parsable output (stop: ${message.stop_reason})`, error: true }, null, usage);
    }
    return done(validateDecision(raw, req), raw, usage);
  } catch (err) {
    let reason = "unexpected error";
    if (err instanceof Anthropic.RateLimitError) reason = "rate limited";
    else if (err instanceof Anthropic.APIConnectionError) reason = "connection error or timeout";
    else if (err instanceof Anthropic.APIError) reason = `API error ${err.status ?? ""}`.trim();
    console.error("[checkpoint]", provider.name, reason, err instanceof Error ? err.message : err);
    return done({ decision: "wait", reason, error: true });
  }
}
