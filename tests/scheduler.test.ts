import { describe, expect, it } from "vitest";
import { CHECKPOINT_CONFIG as C } from "@/lib/checkpoints/config";
import {
  endsSentence,
  initialSchedulerState,
  onEvaluationFinished,
  onEvaluationStarted,
  onSpeech,
  shouldEvaluate,
  type SchedulerState,
} from "@/lib/checkpoints/scheduler";

const at = (speechSec: number, extra: Partial<SchedulerState> = {}): SchedulerState => ({
  ...initialSchedulerState,
  speechSec,
  atSentenceEnd: true,
  ...extra,
});

describe("shouldEvaluate at a finished sentence", () => {
  it("waits during warm-up", () => {
    expect(shouldEvaluate(at(C.WARMUP_SEC - 1), "boundary", C.WARMUP_SEC - 1).reason).toBe("warm-up");
  });

  it("checks at the end of a sentence once warm-up has passed", () => {
    expect(shouldEvaluate(at(C.WARMUP_SEC), "boundary", C.WARMUP_SEC).evaluate).toBe(true);
  });

  it("does not check in the middle of a sentence", () => {
    expect(shouldEvaluate(at(200, { atSentenceEnd: false }), "boundary", 200).reason).toBe("mid-sentence");
  });

  it("never runs two evaluations at once", () => {
    expect(shouldEvaluate(at(200, { inFlight: true }), "boundary", 200).reason).toBe("in-flight");
  });

  it("keeps cards at least MIN_GAP apart", () => {
    const s = at(300, { lastQuestionAt: 250, lastEvalSpeechSec: 240 });
    expect(shouldEvaluate(s, "boundary", 250 + C.MIN_GAP_SEC - 1).reason).toBe("cooldown");
    expect(shouldEvaluate(s, "boundary", 250 + C.MIN_GAP_SEC).evaluate).toBe(true);
  });

  it("requires some new speech since the last check", () => {
    const s = at(100, { lastEvalSpeechSec: 100 - C.MIN_NEW_SPEECH_SEC + 1 });
    expect(shouldEvaluate(s, "boundary", 100).reason).toBe("not-enough-new-speech");
  });

  it("uses the shorter threshold after a wait verdict", () => {
    const s = at(100, { lastEvalSpeechSec: 100 - C.MIN_NEW_SPEECH_AFTER_WAIT_SEC, lastVerdict: "wait" });
    expect(shouldEvaluate(s, "boundary", 100).evaluate).toBe(true);
  });
});

describe("question due (about every TARGET_GAP)", () => {
  it("is due once TARGET_GAP has passed since the last question", () => {
    const s = at(500, { lastQuestionAt: 400, lastEvalSpeechSec: 450 });
    expect(shouldEvaluate(s, "boundary", 400 + C.TARGET_GAP_SEC - 1).due).toBe(false);
    expect(shouldEvaluate(s, "boundary", 400 + C.TARGET_GAP_SEC).due).toBe(true);
  });

  it("counts from the start of the lecture before the first question", () => {
    expect(shouldEvaluate(at(C.TARGET_GAP_SEC), "boundary", C.TARGET_GAP_SEC).due).toBe(true);
  });
});

describe("timer fallback", () => {
  it("fires when a question is overdue even if no sentence has ended", () => {
    const now = 400 + C.TARGET_GAP_SEC + C.DUE_GRACE_SEC;
    const s = at(now, { atSentenceEnd: false, lastQuestionAt: 400, lastEvalSpeechSec: now - C.MIN_NEW_SPEECH_AFTER_WAIT_SEC });
    expect(shouldEvaluate(s, "timer", now)).toMatchObject({ evaluate: true, due: true });
  });

  it("does not fire early when nothing is overdue", () => {
    const s = at(450, { atSentenceEnd: false, lastQuestionAt: 400, lastEvalSpeechSec: 420 });
    expect(shouldEvaluate(s, "timer", 470).evaluate).toBe(false);
  });

  it("fires after a very long stretch with no finished sentence", () => {
    const s = at(300, { atSentenceEnd: false, lastQuestionAt: 280, lastEvalSpeechSec: 300 - C.NO_BOUNDARY_FALLBACK_SEC });
    expect(shouldEvaluate(s, "timer", 280 + C.MIN_GAP_SEC).evaluate).toBe(true);
  });
});

describe("state transitions", () => {
  it("marks in-flight and remembers where the evaluation started", () => {
    const s = onEvaluationStarted(at(130));
    expect(s.inFlight).toBe(true);
    expect(s.lastEvalSpeechSec).toBe(130);
  });

  it("records the question time only for ask verdicts", () => {
    const base = onEvaluationStarted(at(130));
    expect(onEvaluationFinished(base, "wait", 135).lastQuestionAt).toBeNull();
    expect(onEvaluationFinished(base, "ask", 135).lastQuestionAt).toBe(135);
  });

  it("only moves speech time forward", () => {
    expect(onSpeech(at(50), 40, "x.").speechSec).toBe(50);
    expect(onSpeech(at(50), 60, "x.").speechSec).toBe(60);
  });

  it("detects finished sentences", () => {
    expect(endsSentence("Photosynthesis is the process plants, algae,")).toBe(false);
    expect(endsSentence("and some bacteria use to convert light.")).toBe(true);
    expect(endsSentence('Why does this happen?"')).toBe(true);
    expect(onSpeech(at(0), 5, "so the price falls").atSentenceEnd).toBe(false);
  });
});
