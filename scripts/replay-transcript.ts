// DEV TOOL: replays a written lecture through the real checkpoint engine
// (timing rules → prompt → Claude → validator) at simulated speaking speed,
// and prints a timeline of when LectureLoop would ask, and what.
//
//   npm run replay -- fixtures/lectures/biology-photosynthesis.txt
//   npm run replay -- fixtures/lectures/economics-supply-demand.txt --model claude-opus-5-5
//   options: --model <id>   --answers cic   (simulated student: c=correct, i=incorrect, u=unanswered, repeating)
//            --whole-sentences   (idealized input; by default sentences are fragmented like real speech-to-text)

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local", quiet: true });

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { CHECKPOINT_CONFIG as C, getClaudeProvider, getModel } from "@/lib/checkpoints/config";
import { evaluateCheckpoint } from "@/lib/checkpoints/evaluate";
import {
  initialSchedulerState,
  onEvaluationFinished,
  onEvaluationStarted,
  onSpeech,
  shouldEvaluate,
} from "@/lib/checkpoints/scheduler";
import type { CheckpointQuestion, ConceptStatus, TestedConcept } from "@/lib/checkpoints/types";
import { conceptKey } from "@/lib/checkpoints/validate";
import { buildWindow, formatClock } from "@/lib/checkpoints/window";
import { fixtureToSegments } from "@/lib/dev/fixtureSegments";

const PRICES: Record<string, { input: number; output: number }> = {
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-opus-5-5": { input: 4, output: 20 },
};

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

type Asked = CheckpointQuestion & { at: number; result: "correct" | "incorrect" | "unanswered" };

function testedConcepts(asked: Asked[]): TestedConcept[] {
  const byKey = new Map<string, Asked[]>();
  for (const q of asked) byKey.set(conceptKey(q.concept), [...(byKey.get(conceptKey(q.concept)) ?? []), q]);
  return [...byKey.values()].map((qs) => {
    const answered = qs.filter((q) => q.result !== "unanswered");
    const status: ConceptStatus = answered.length
      ? answered[answered.length - 1].result === "correct"
        ? "understood"
        : "needs_review"
      : "unanswered";
    return { label: qs[0].concept, status, questionCount: qs.length };
  });
}

async function main() {
  const file = process.argv.slice(2).find((a) => !a.startsWith("--") && a.endsWith(".txt"));
  if (!file) {
    console.error("Usage: npm run replay -- <fixture.txt> [--model <id>] [--answers cic]");
    process.exit(1);
  }
  const model = arg("model") ?? getModel();
  const pattern = (arg("answers") ?? "cic").toLowerCase();
  // Default: fragment sentences like real speech-to-text does. --whole-sentences for the idealized version.
  const fragment = !process.argv.includes("--whole-sentences");
  const segments = fixtureToSegments(readFileSync(file, "utf8"), { fragment });
  const duration = segments[segments.length - 1].end;

  const out: string[] = [];
  const log = (line = "") => {
    console.log(line);
    out.push(line);
  };

  log(
    `# Replay: ${basename(file)}  ·  model ${model} via ${getClaudeProvider()?.name ?? "NO KEY"}  ·  ${formatClock(duration)} of lecture  ·  ${fragment ? "fragmented like live STT" : "whole sentences"}  ·  answers "${pattern}"`,
  );
  log("");

  let sched = initialSchedulerState;
  const asked: Asked[] = [];
  let evals = 0;
  let rejected = 0;
  let errors = 0;
  let inTok = 0;
  let outTok = 0;
  let totalLatency = 0;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    sched = onSpeech(sched, seg.end, seg.text);
    const now = seg.end;
    // Same triggers as the live app: a finished sentence, or the fallback timer (pauses are not used).
    let decision = shouldEvaluate(sched, "boundary", now);
    if (!decision.evaluate) decision = shouldEvaluate(sched, "timer", now);
    if (!decision.evaluate) continue;

    sched = onEvaluationStarted(sched);
    evals++;
    const heard = segments.slice(0, i + 1);
    const { transcriptWindow, recentTail } = buildWindow(heard);
    const result = await evaluateCheckpoint(
      {
        transcriptWindow,
        recentTail,
        testedConcepts: testedConcepts(asked),
        elapsedSec: now,
        questionDue: decision.due,
      },
      { model },
    );
    totalLatency += result.latencyMs;
    if (result.usage) {
      inTok += result.usage.inputTokens;
      outTok += result.usage.outputTokens;
    }
    const shownAt = now + result.latencyMs / 1000;
    const r = result.response;
    sched = onEvaluationFinished(sched, r.decision, shownAt);

    const lastWords = seg.text.length > 90 ? "…" + seg.text.slice(-90) : seg.text;
    if (r.decision === "wait") {
      if (r.error) errors++;
      if (r.rejected) {
        rejected++;
        log(`[${formatClock(now)}] REJECTED (${r.reason}) — proposed: ${result.raw?.concept ?? "?"} · "${result.raw?.question ?? ""}"`);
      } else {
        log(`[${formatClock(now)}] wait${decision.due ? " (due)" : ""}${r.error ? " [ERROR]" : ""} — ${r.reason}   ⟵ just said: "${lastWords}"`);
      }
      continue;
    }

    const q = r.question;
    const answer = pattern[asked.length % pattern.length];
    const res = answer === "c" ? "correct" : answer === "i" ? "incorrect" : "unanswered";
    asked.push({ ...q, at: shownAt, result: res });
    log("");
    log(
      `[${formatClock(shownAt)}] ★ ASK #${asked.length} (${q.kind}${decision.due ? ", due" : ""}) — ${q.concept}   [${(result.latencyMs / 1000).toFixed(1)}s]`,
    );
    log(`    ⟵ just said: "${lastWords}"`);
    log(`    Q: ${q.question}`);
    q.choices.forEach((c, k) => log(`       ${k === q.correctIndex ? "✓" : " "} ${String.fromCharCode(65 + k)}. ${c}`));
    log(`    Why: ${q.explanation}`);
    log(`    Quote: "${q.evidenceQuote}"`);
    log(`    (simulated student: ${res})`);
    log("");
  }

  const gaps = asked.slice(1).map((q, k) => q.at - asked[k].at);
  const price = PRICES[model];
  const cost = price ? (inTok * price.input + outTok * price.output) / 1e6 : NaN;
  log("## Summary");
  log(`- Evaluations: ${evals} · questions: ${asked.length} · rejected by validator: ${rejected} · errors: ${errors}`);
  log(`- Concepts: ${asked.map((q) => q.concept).join(" | ") || "(none)"}`);
  log(`- Smallest gap between questions: ${gaps.length ? Math.round(Math.min(...gaps)) + "s" : "n/a"} (rule: ≥ ${C.MIN_GAP_SEC}s)`);
  log(`- Average AI latency: ${evals ? (totalLatency / evals / 1000).toFixed(1) : 0}s`);
  log(
    `- Tokens: ${inTok} in / ${outTok} out · cost ≈ $${cost.toFixed(4)} · ≈ $${((cost / duration) * 3600).toFixed(2)} per lecture-hour`,
  );

  mkdirSync("tmp/replay", { recursive: true });
  const outFile = `tmp/replay/${basename(file, ".txt")}.${model}.md`;
  writeFileSync(outFile, out.join("\n"), "utf8");
  console.log(`\nSaved: ${outFile}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
