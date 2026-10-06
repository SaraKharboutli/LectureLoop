// DEV TOOL: one cheap request to check that the configured AI route (Vercel AI Gateway
// or Anthropic) accepts our model + structured-output request.   npm run probe-ai

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local", quiet: true });

import { evaluateCheckpoint } from "@/lib/checkpoints/evaluate";

const transcript = `[00:00] Today we're talking about the law of demand. The law of demand says that, all else being equal, when the price of a good rises, the quantity demanded falls, and when the price falls, the quantity demanded rises.
[00:20] So price and quantity demanded move in opposite directions. That's why the demand curve slopes downward. Okay, now let's look at the other side of the market, supply.`;

evaluateCheckpoint({
  transcriptWindow: transcript,
  recentTail: "Okay, now let's look at the other side of the market, supply.",
  testedConcepts: [],
  elapsedSec: 90,
  questionDue: true,
}).then((r) => {
  console.log(`provider: ${r.provider} · model: ${r.model} · ${r.latencyMs} ms`);
  console.log("usage:", r.usage);
  console.log("response:", JSON.stringify(r.response, null, 2));
  if (r.response.decision === "wait" && r.response.error) process.exit(1);
});
