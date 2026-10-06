// Deterministic safety checks on the AI's proposed question — no AI involved.
// A question is only shown if its evidence quote really appears in the transcript,
// it has 4 distinct choices, it is important, and it doesn't repeat a tested concept.
// See spec.md > Question Validator.

import { CHECKPOINT_CONFIG as C } from "./config";
import type { CheckpointDecision } from "./schema";
import type { CheckpointQuestion, CheckpointResponse, TestedConcept } from "./types";

const MIN_QUOTE_WORDS = 6;
const FUZZY_QUOTE_MATCH = 0.85;
const DUPLICATE_SIMILARITY = 0.6;

const STOPWORDS = new Set(
  "a an the of and or to in on for with by from as at is are was were be been its it this that these those how why what which who into vs versus".split(
    " ",
  ),
);

export function normalizeText(text: string): string {
  return text
    .replace(/\[\d{1,3}:\d{2}\]/g, " ")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function conceptKey(label: string): string {
  return normalizeText(label);
}

function contentWords(label: string): Set<string> {
  return new Set(
    normalizeText(label)
      .split(" ")
      .filter((w) => w && !STOPWORDS.has(w))
      .map((w) => (w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w)),
  );
}

/** Word-overlap (Jaccard) similarity between two concept labels. */
export function conceptSimilarity(a: string, b: string): number {
  const A = contentWords(a);
  const B = contentWords(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / (A.size + B.size - inter);
}

/** True if the quote appears in the transcript, exactly or with small recognition differences. */
export function isGrounded(quote: string, transcript: string): boolean {
  const q = normalizeText(quote).split(" ").filter(Boolean);
  if (q.length < MIN_QUOTE_WORDS) return false;
  const t = normalizeText(transcript).split(" ").filter(Boolean);
  if (` ${t.join(" ")} `.includes(` ${q.join(" ")} `)) return true;

  // Tolerant match: best in-order word overlap against any similar-length stretch of transcript.
  const span = Math.ceil(q.length * 1.3);
  const needed = Math.ceil(q.length * FUZZY_QUOTE_MATCH);
  const qSet = new Set(q);
  for (let start = 0; start < t.length; start++) {
    if (!qSet.has(t[start])) continue;
    const slice = t.slice(start, start + span);
    if (lcsLength(q, slice) >= needed) return true;
  }
  return false;
}

function lcsLength(a: string[], b: string[]): number {
  const prev = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    let diag = 0;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = a[i - 1] === b[j - 1] ? diag + 1 : Math.max(prev[j], prev[j - 1]);
      diag = tmp;
    }
  }
  return prev[b.length];
}

export function shuffleChoices(
  choices: string[],
  correctIndex: number,
  random: () => number = Math.random,
): { choices: string[]; correctIndex: number } {
  const order = choices.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return { choices: order.map((i) => choices[i]), correctIndex: order.indexOf(correctIndex) };
}

export function validateDecision(
  d: CheckpointDecision,
  ctx: { transcriptWindow: string; testedConcepts: TestedConcept[]; random?: () => number },
): CheckpointResponse {
  if (d.decision === "wait") return { decision: "wait", reason: d.reason || "wait" };

  const reject = (reason: string): CheckpointResponse => ({ decision: "wait", reason, rejected: true });

  if (d.importance === "low") return reject("importance low");

  const concept = d.concept.trim();
  const question = d.question.trim();
  if (!concept || !question) return reject("missing concept or question");

  const choices = d.choices.map((c) => c.trim());
  if (choices.length !== 4 || choices.some((c) => !c)) return reject("needs exactly 4 non-empty choices");
  if (new Set(choices.map((c) => c.toLowerCase())).size !== 4) return reject("duplicate choices");
  if (!Number.isInteger(d.correct_index) || d.correct_index < 0 || d.correct_index > 3) {
    return reject("correct_index out of range");
  }

  if (!isGrounded(d.evidence_quote, ctx.transcriptWindow)) return reject("evidence quote not found in transcript");

  // Duplicate / re-check rules.
  let best: TestedConcept | null = null;
  let bestSim = 0;
  for (const t of ctx.testedConcepts) {
    const sim = conceptKey(t.label) === conceptKey(concept) ? 1 : conceptSimilarity(t.label, concept);
    if (sim > bestSim) {
      best = t;
      bestSim = sim;
    }
  }
  const matches = best !== null && bestSim >= DUPLICATE_SIMILARITY;

  let kind: "new" | "recheck" = d.kind;
  let label = concept;
  if (matches && best) {
    if (best.status !== "needs_review") return reject(`concept already tested: ${best.label}`);
    if (best.questionCount >= C.MAX_QUESTIONS_PER_CONCEPT) return reject(`re-check limit reached: ${best.label}`);
    // A needs-review concept the lecturer came back to: treat as a re-check, keep the original label.
    kind = "recheck";
    label = best.label;
  } else if (kind === "recheck") {
    return reject("re-check of a concept that is not awaiting review");
  }

  const shuffled = shuffleChoices(choices, d.correct_index, ctx.random);
  const q: CheckpointQuestion = {
    concept: label,
    kind,
    question,
    choices: shuffled.choices,
    correctIndex: shuffled.correctIndex,
    explanation: d.explanation.trim(),
    evidenceQuote: d.evidence_quote.trim(),
  };
  return { decision: "ask", question: q };
}
