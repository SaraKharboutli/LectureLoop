---
doc: spec
status: approved
---

# LectureLoop — Technical Spec

## How This Works, In Plain Language

LectureLoop is a website that runs in the phone or iPad browser. It has four working parts:

1. **The ears (microphone + speech-to-text).** The browser records the lecture from the microphone and streams the sound, a few times per second, to **Deepgram**. Deepgram is an outside service that turns speech into text in real time. It sends back the words as they are spoken, and it also tells us when the speaker **pauses**. The pauses are our natural "the lecturer might have finished a thought" moments.
2. **The timing rules (the scheduler).** These are plain code in the app, not AI. They decide whether it is even worth asking the AI right now. Has the lecture been going for at least a minute? Has it been at least 2 minutes since the last question? Has enough new material been said since we last checked? Is the lecturer pausing? If any answer is "no", we keep listening and spend nothing.
3. **The brain (Claude).** When the timing rules say "maybe now", the app sends the last few minutes of lecture text to **Claude**, Anthropic's AI model, along with the list of concepts already tested. Claude answers in a fixed format (structured output, so the app always knows where each piece is). The answer is either **"wait"** (the idea isn't finished, or isn't important) or **"ask"**, which comes with the concept, one question, four choices, the correct one, a one-line explanation, and a **word-for-word quote** from the lecture that proves the answer.
4. **The safety check and the memory.** Before a question is shown, the app checks it with simple code. The quote must really appear in the transcript (this protects against made-up facts). There must be four different choices. The concept must not have been tested already. If any check fails, the question is thrown away silently. The app then remembers each question and the student's answer **in the page's memory only** (no database), and builds the summary from that at the end.

Why this shape: the only "intelligent" judgment, whether an idea is finished and what to ask about it, goes to the AI. Everything that must be **predictable** is ordinary code that we can test: spacing between questions, no repeats, grounding check, scoring. One AI call does both jobs (deciding *and* writing the question), which keeps it simpler and faster than chaining several AI calls.

The **secret keys** for Deepgram and Claude live only on the server side of the website, never in the browser. For Deepgram, the server hands the browser a **temporary pass** (valid for a minute) to open the live connection. For Claude, the browser asks our own server, and the server talks to Claude.

## The Core Journey Through the System
PRD ref: `prd.md > The Core Journey`.

1. Student taps **Start Learning** → `StartScreen` calls `startSession()` in the `useLectureSession` hook.
2. The browser asks for the mic (`getUserMedia`). If denied → reducer sets `micError` → `MicPermissionError` view with **Try again**.
3. Mic allowed → `mic.ts` starts an `AudioContext` with the `pcm-worklet` and produces small chunks of 16-bit audio.
4. `deepgram.ts` calls our `/api/stt-token` → the server asks Deepgram for a temporary token → the browser opens a WebSocket to Deepgram with that token → audio chunks stream out, and transcript messages stream back.
5. Interim words → reducer `interim` (shown lighter in `TranscriptPane`). Final words → reducer `segments` (shown in normal text). Pause signals (`speech_final` / `UtteranceEnd`) → the scheduler is consulted.
6. `scheduler.ts` says **evaluate** only when all timing rules pass (see Checkpoint Scheduler). The hook then POSTs `/api/checkpoint` with the recent transcript window and the concepts so far.
7. `/api/checkpoint` builds the prompt (`prompt.ts`) → calls Claude with the JSON schema (`schema.ts`) → runs `validate.ts` (grounding quote, choices, duplicates, importance) → shuffles choices → returns `{ decision: "wait" }` or `{ decision: "ask", question }`.
8. `ask` → reducer adds the question and makes it active → `QuickCheckCard` slides into `CheckpointArea`.
9. Student taps a choice → reducer records the result → the card shows ✓ / "Needs review" → it auto-dismisses after 2 s / 8 s. No tap within 90 s → it is recorded as unanswered and dismissed. `StatusDots` update immediately.
10. Steps 5–9 repeat. Any concept needing review is passed to the next `/api/checkpoint` calls as "may re-check if the lecturer returns to it".
11. **End** → the hook stops the mic, sends `CloseStream` to Deepgram and closes the socket. The reducer moves to `summary`, and any active card counts as unanswered → `SummaryScreen` renders counts and rows. Answering an unanswered row dispatches the same answer action (`answeredFrom: "summary"`).

```
 Mic ─► pcm-worklet ─► deepgram.ts ══WebSocket══► Deepgram (speech→text)
                          │  ▲                         │
                          │  └── /api/stt-token ◄──────┘ (temporary token)
                          ▼
              reducer (transcript, questions, concepts) ──► UI screens
                          │
                   scheduler.ts ("is it worth asking now?")
                          │ yes
                          ▼
                 /api/checkpoint ──► Claude (decide + write MCQ)
                          │
                    validate.ts (quote really in transcript? no repeat? 4 choices?)
                          ▼
                     QuickCheckCard
```

## Stack

| Piece | Choice | Docs |
|---|---|---|
| Framework | **Next.js** (App Router, latest stable at build time) + **TypeScript** + React | https://nextjs.org/docs |
| Styling | **Tailwind CSS** (bundled with `create-next-app`) | https://tailwindcss.com/docs |
| Speech-to-text | **Deepgram** live streaming, model **`nova-3`**, English | https://developers.deepgram.com/docs/live-streaming-audio |
| AI | **Claude** via `@anthropic-ai/sdk`, structured outputs | https://docs.claude.com/en/api/overview |
| Schema / validation | **zod** | https://zod.dev |
| Tests | **Vitest** for the pure logic modules | https://vitest.dev |
| Hosting (for phone/iPad) | **Vercel** (free Hobby plan), connected to the GitHub repo | https://vercel.com/docs |

Rationale (agent-recommended, needs learner agreement at review):
- **Next.js:** one project holds both the screens and the small server parts (token + AI routes), so there is no separate backend. It also deploys to Vercel in one click, which matters because phones/iPads need an `https` link for the mic.
- **Deepgram over OpenAI Realtime or the browser's built-in speech recognition:** Deepgram has mature live streaming with **pause/end-of-speech signals** (useful for timing), short-lived browser tokens, and **$200 free credit** (≈ hundreds of lecture hours at about $0.29–0.46 per hour). The browser's built-in recognition is free but unreliable on iPad/iPhone for long sessions. OpenAI Realtime would mean one account instead of two, but its browser setup is more complex. **Tradeoff accepted: two accounts/keys.**
- **Claude model (learner decision):** default **`claude-sonnet-5-5`** for the POC "to minimize cost". It is configurable via env var `CLAUDE_MODEL`, so **`claude-opus-5-5`** can be swapped in without code changes. The learner wants to **compare Sonnet 5.5 vs Opus 5.5 later, specifically on idea-completion timing**, so the replay script takes a `--model` flag and prints a side-by-side timeline. Rough cost: under ~$1–2 per lecture-hour on Sonnet 5.5 (measured in the build by logging token usage).
- **Optional route (build revision):** if `AI_GATEWAY_API_KEY` is set, the same Claude request goes through Vercel AI Gateway (`https://ai-gateway.vercel.sh`, model `anthropic/claude-sonnet-5.5`) instead of Anthropic directly. It was tried for free credits, but the gateway requires a card on file and its free tier excludes Claude, so direct Anthropic stays the default. See `devpost/checklist.md > Revisions`.
- **No paid infrastructure (learner decision):** only Deepgram's free credit and pay-per-use Claude credit. Hosting uses Vercel's **free** Hobby plan, and only because phone/iPad need `https` for the mic. No database, no paid add-ons.
- **No Deepgram SDK in the browser:** a plain `WebSocket` is enough and avoids a dependency. Server-side Deepgram calls use plain `fetch`.

**Verify early in the build (unverified details):**
1. The browser WebSocket auth format for a temporary token. Expected: `new WebSocket(url, ["bearer", token])`. The Deepgram docs confirm Bearer auth and the `Sec-WebSocket-Protocol` mechanism but don't show the exact array.
2. Claude structured-output syntax in the current TypeScript SDK (`output_config.format` / `messages.parse`). Read the SDK docs before writing the route.
3. The Vercel function duration limit for `/api/checkpoint` (set `maxDuration`).

## Where It Runs and How Someone Tries It

- **Requirements:** Node.js 20+ (installed: 24 LTS), a Deepgram API key (Member role or higher), an Anthropic API key.
- **Keys:** copy `.env.example` → `.env.local` and fill in `DEEPGRAM_API_KEY`, `ANTHROPIC_API_KEY`, and optionally `CLAUDE_MODEL`. `.env.local` is git-ignored. **Keys are never pasted into chat or committed.**
- **Run locally (laptop):** `npm install` then `npm run dev` → open http://localhost:3000. The mic works on `localhost`. Play a recorded English lecture out loud near the laptop, or speak.
- **Run on phone/iPad:** browsers only allow the mic on `https`. Deploy to **Vercel**: import the GitHub repo, add the same env vars in Vercel → Settings → Environment Variables, deploy, and open the `https://….vercel.app` link on the device. Deployment is optional for the competition; it is recommended here because the learner's target devices are phone/iPad.
- **Live deployment:** https://lecture-loop-three.vercel.app (Vercel Hobby, auto-deploys from `main` of https://github.com/SaraKharboutli/LectureLoop). The `*-frdc1.vercel.app` deployment URLs are behind Vercel Authentication; the production domain above is public. Env vars set in Vercel: `DEEPGRAM_API_KEY`, `ANTHROPIC_API_KEY`, `CLAUDE_MODEL`.
- **Demo/recording (for `6-ship`, later):** the deployed link on an iPad, or localhost on a laptop, with a real lecture playing aloud.
- **Public link caution:** anyone with the URL could use the app on the learner's credits. Set a monthly spend limit in the Anthropic Console. Deepgram usage draws from the free credit.

## Look and Feel
Carried from `prd.md > Look and Feel` and `scope.md > Inspiration & Identity`.

- **Tailwind theme tokens** (in `globals.css` `@theme`):
  `--color-paper: #FFFFFF` (background) · `--color-primary: #5B5BD6` (Start button, listening dot, accents, focus rings) · `--color-tint: #EEF2FF` (cards, panels) · `--color-ink: #111827` (text) · `--color-success: #22C55E` (correct / understood only) · `--color-review: #F59E0B` (needs review) · `--color-idle: #9CA3AF` (unanswered, interim words).
- **Proportion:** ~80% white, ~15% Indigo, ~5% status colors. No red anywhere.
- **Type:** Inter (via `next/font`). Transcript 17–18px with relaxed line-height. Question text 18–20px, semibold. Buttons are big tap targets (min 48px tall).
- **Shapes and motion:** rounded-2xl cards on `--color-tint` with a soft shadow. The card slides up/fades in (~200 ms) and fades out. The "Listening" dot pulses slowly. Nothing flashes.
- **Layout:** mobile-first portrait, max content width ~720px centered on large screens. Lecture screen is a full-height flex column: thin header, transcript (~58%), checkpoint area (~42%).
- **Copy tone:** short, calm, kind. "Got it ✓", "Needs review", "Listening…", "Reconnecting…".

## Components

### Mic Capture
`lib/audio/mic.ts` + `public/pcm-worklet.js`. Requests the mic (`echoCancellation`, `noiseSuppression`, `autoGainControl` on) and creates an `AudioContext` inside the Start tap (required by iOS). An `AudioWorkletNode` converts Float32 samples to **Int16 PCM** and posts ~100 ms chunks. Exposes `start(onChunk)`, `stop()`, and `sampleRate`. Throws a typed `MicPermissionError` on denial.
PRD ref: `prd.md > Starting a session`, `prd.md > States and Boundaries` (mic permission).

### STT Token Route
`app/api/stt-token/route.ts` (POST). Calls `POST https://api.deepgram.com/v1/auth/grant` with header `Authorization: Token ${DEEPGRAM_API_KEY}` and body `{ "ttl_seconds": 60 }`, and returns `{ token }`. Never returns the API key. `Cache-Control: no-store`.
PRD ref: `prd.md > Starting a session`.

### Live Transcription Client
`lib/transcription/deepgram.ts`. Opens:
`wss://api.deepgram.com/v1/listen?model=nova-3&language=en&encoding=linear16&sample_rate=<ctx rate>&channels=1&interim_results=true&smart_format=true&punctuate=true&endpointing=400`
with the temporary token. It emits:
- `interim(text)` for `Results` with `is_final: false`
- `final({ text, start, end })` for `Results` with `is_final: true` and non-empty text (a final ending in `. ? !` is a check point)
- `status("live" | "reconnecting" | "error")`
(Pause events were removed by learner decision; see `checklist.md > Revisions`.)

It sends `{"type":"KeepAlive"}` every 8 s. On an unexpected close it fetches a new token and reconnects (backoff 1 s, 2 s, 4 s, max 5 tries → `error`). On end it sends `{"type":"CloseStream"}`.
PRD ref: `prd.md > Live transcript`, `prd.md > States and Boundaries` (connection hiccup).

### Checkpoint Scheduler
`lib/checkpoints/scheduler.ts`. **Pure function**, unit-tested: `shouldEvaluate(state, now) → boolean`. Constants live in one place, `lib/checkpoints/config.ts`:

| Rule | Value |
|---|---|
| Warm-up: lecture speech before the first evaluation | ≥ 45 s |
| Question **due** (`TARGET_GAP`) — the AI is told to ask about the latest finished point | 90 s since the last question (or since the start) |
| Minimum gap between questions shown (`MIN_GAP`) | ≥ 75 s (learner decision: "a question every 1.5–2 minutes"; was 120 s) |
| New speech since the last evaluation | ≥ 20 s (15 s after a "wait") |
| Trigger | **the end of any complete sentence** (a final transcript segment ending in . ? !) — pauses are not used at all (learner decision); **or** a fallback timer every 5 s when a question is ≥ 20 s overdue or 90 s pass with no finished sentence |
| In-flight | max 1 request at a time; a response that arrives after **End** is ignored |
| Unanswered card timeout | 60 s (was 90 s) |
| Max questions per concept | 2 (the original + one re-check) |

The request carries `questionDue`. When it is false, the AI asks only if a significant idea was clearly just wrapped up; when true, it asks about the most recent finished point of any size, and waits only if nothing complete and non-trivial was said. The rhythm is regular, but the *content* and exact moment still come from the lecture: never mid-explanation of the point being asked, never ungrounded.
PRD ref: `prd.md > Checkpoint timing (the kernel)`.

### Checkpoint Route (AI decision + question)
`app/api/checkpoint/route.ts` (POST, `maxDuration = 60`).

**Request:** `{ transcriptWindow: string, recentTail: string, testedConcepts: { label: string, status: "understood" | "needs_review" | "unanswered" }[], elapsedSec: number }`.
- `transcriptWindow`: final segments from the last ~8 minutes (capped ~1,800 words), one line per segment prefixed with `[mm:ss]`.
- `recentTail`: the last ~30 s, repeated separately so the model can judge whether the lecturer is still mid-explanation.

**Claude call** (`prompt.ts`, `schema.ts`): model `process.env.CLAUDE_MODEL ?? "claude-sonnet-5-5"`, `output_config: { effort: "low", format: <JSON schema> }`, adaptive thinking (the default on both Sonnet 5.5 and Opus 5.5). The same request works for either model. Server-side refusal fallback enabled (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`). Typed SDK errors are caught: 429/5xx/timeout → `{ decision: "wait", error: true }`.

The system prompt states the rules:
1. Ask only about an idea whose explanation is **complete**, meaning the lecturer has wrapped it up or moved on. If `recentTail` is still developing that idea, answer `wait`.
2. Only **important** ideas: core definitions, mechanisms, cause→effect, key distinctions. Never examples' names, jokes, logistics, or passing details.
3. The question must be answerable **solely** from the transcript. Add no outside facts.
4. Never repeat a concept in `testedConcepts`, except a `needs_review` one that the lecturer has **revisited**. That is a `recheck`, and the question must be different.
5. One correct answer, three plausible distractors, all short (≤ 12 words).
6. `evidence_quote` is copied **verbatim** from the transcript.

**Output schema** (all fields required; on `wait`, the content fields are empty strings, `correct_index` is 0, and `choices` is `[]`):
```
decision: "ask" | "wait"
reason: string                 // one short sentence (for logs / debugging)
concept: string                // short label, e.g. "Light-dependent reactions"
kind: "new" | "recheck"
importance: "high" | "medium" | "low"
question: string
choices: string[]              // exactly 4 when asking
correct_index: integer 0..3
explanation: string            // one sentence, grounded in the lecture
evidence_quote: string         // verbatim span from transcriptWindow
```

**Response to the browser:** `{ decision: "wait", reason }` or `{ decision: "ask", question: { concept, kind, question, choices, correctIndex, explanation, evidenceQuote } }`, with choices **shuffled server-side** so the correct answer isn't always A.
PRD ref: `prd.md > Checkpoint timing (the kernel)`, `prd.md > Quick Check question`.

### Question Validator
`lib/checkpoints/validate.ts`. **Pure**, unit-tested. Rejects (turns into `wait`) when:
- `importance` is `"low"`;
- not exactly 4 non-empty, distinct (case-insensitive) choices, or `correct_index` out of range;
- **grounding fails:** `evidence_quote` has fewer than 6 words, or it is not found in `transcriptWindow` after normalizing (lowercase, strip punctuation, collapse spaces). A tolerant fallback accepts it if ≥ 85% of the quote's words appear in order;
- **duplicate:** `kind: "new"` but the concept's label word-overlap with an already-tested label is ≥ 0.6; or `kind: "recheck"` for a concept that isn't `needs_review`, or that already has 2 questions.
PRD ref: `prd.md > Quick Check question` (grounded), `prd.md > Checkpoint timing (the kernel)` (no repeats).

### Session State
`lib/session/types.ts`, `lib/session/reducer.ts` (pure, unit-tested), and `lib/session/useLectureSession.ts`. The hook wires mic + transcription + scheduler + checkpoint fetch into the reducer, and also owns timers (card timeout, auto-dismiss, fallback trigger), wake lock and the leave-page warning.
Actions: `START`, `MIC_ERROR`, `CONNECTION`, `INTERIM`, `FINAL_SEGMENT`, `EVAL_STARTED`, `EVAL_DONE`, `QUESTION_SHOWN`, `ANSWER`, `CARD_TIMEOUT`, `CARD_DISMISSED`, `END`, `RESET`.
PRD ref: `prd.md > Understanding tracking`, `prd.md > Ending and Mastery Summary`.

### Visual identity and wide layout (final review)
- `components/Logo.tsx` (`LogoMark`, `Wordmark`) and `app/icon.svg` (browser-tab icon; replaces the default Next.js favicon).
- `lib/checkpoints/highlight.ts` (`findQuoteWords`, pure + tested) maps the active question's `evidenceQuote` onto transcript words (exact match, then the same tolerant match as the validator); `TranscriptPane` highlights them and scrolls the first one into view while the card is open.
- `LectureScreen` switches to two columns at the `lg` breakpoint (≥ 1024 px): transcript left, `CheckpointArea` as a fixed 440–480 px right column.
- Dev-only `&autostart=1` (with `?devfeed=`) starts the fixture feed without a tap, for headless screenshots.
PRD ref: `prd.md > Look and Feel`.

### Saved Lectures
`lib/session/savedLectures.ts` (pure helpers + guarded `localStorage` access) and `components/MyLectures.tsx` / `components/SavedLectureScreen.tsx`. Added at final review (learner decision).
- Key `lectureloop.lectures.v1` holds a JSON array of `{ id, savedAt, durationSec, transcript, questions }` (newest first, max 30 kept; oldest dropped). Every read/write is wrapped in try/catch, so private mode or full storage just means nothing is saved, never a crash.
- Saved when a session reaches the summary (only if it heard something); re-saved when the student answers from the summary.
- Retrying a question appends a copy (`kind: "recheck"`, unanswered) to that lecture, so `deriveConcepts` turns a later correct answer into "understood after review".
PRD ref: `prd.md > My lectures (saved on this device)`.

### Device Helpers
`lib/device.ts`. `navigator.wakeLock.request("screen")` while listening; it fails quietly if unsupported and is re-requested when the page becomes visible again. The `beforeunload` warning is active only while listening.
PRD ref: `prd.md > States and Boundaries`.

### Screens
- `components/LectureLoopApp.tsx`: picks the screen from `phase`.
- `components/StartScreen.tsx`: name, one-liner, mic tip, **Start Learning**. `components/MicPermissionError.tsx` shows the help text and **Try again**.
- `components/LectureScreen.tsx`: header (name, Listening/Reconnecting dot, elapsed `mm:ss`, **End**), then `TranscriptPane` (auto-scroll to bottom unless the user scrolled up; interim text in `--color-idle`), then `CheckpointArea` ("Listening…" idle state, or `QuickCheckCard`) with `StatusDots` below.
- `components/QuickCheckCard.tsx`: concept chip, question, 4 choice buttons, then a feedback state (✓ green or "Needs review" amber with the correct choice highlighted and the explanation). Tap to dismiss.
- `components/SummaryScreen.tsx`: "Lecture Mastery", three counts (by concept), rows for every question (concept, question, your answer, correct answer, explanation, status). Unanswered rows show the choices so they can be answered. If there are no questions, it shows "No checkpoints were reached in this session" and the transcript word count. **New session** resets.
PRD ref: `prd.md > Screens and Layout`, `prd.md > Answering and feedback`, `prd.md > Ending and Mastery Summary`.

## Data Model

All state lives in **React memory in the open page**: no database, no localStorage. Refresh/close = session gone (per PRD). Shape:

```ts
type Segment = { id: string; text: string; start: number; end: number }   // seconds since session start

type Question = {
  id: string; conceptKey: string; concept: string; kind: "new" | "recheck";
  question: string; choices: string[]; correctIndex: number;
  explanation: string; evidenceQuote: string;
  askedAt: number;                                   // seconds since start
  answerIndex: number | null;
  result: "correct" | "incorrect" | "unanswered";
  answeredFrom?: "live" | "summary";
};

type ConceptStatus = "understood" | "needs_review" | "unanswered";
// Derived, not stored: from the concept's questions in order —
//   any answered question → status of the LATEST answered one;
//   "understood" after an earlier "incorrect" → afterReview = true;
//   no answered question → "unanswered".

type Session = {
  phase: "start" | "listening" | "summary";
  connection: "idle" | "connecting" | "live" | "reconnecting" | "error";
  micError: string | null;
  startedAt: number | null;                         // epoch ms
  segments: Segment[]; interim: string;
  questions: Question[];
  activeQuestionId: string | null;
  activeFeedback: null | "correct" | "incorrect";
  sched: { lastEvalSpeechSec: number; lastQuestionAt: number | null; inFlight: boolean; lastVerdict: "wait" | "ask" | null };
};
```
`conceptKey` = the concept label lowercased with punctuation stripped. Data flow: Deepgram → `segments` → the window string → `/api/checkpoint` → `questions` → derived concept statuses → `StatusDots` / `SummaryScreen`.

## File Structure

```
lecture-loop/
├── app/
│   ├── layout.tsx                 # fonts, metadata, viewport (mobile)
│   ├── page.tsx                   # renders <LectureLoopApp/>
│   ├── globals.css                # Tailwind + LectureLoop color tokens
│   └── api/
│       ├── stt-token/route.ts     # server: Deepgram temporary token
│       └── checkpoint/route.ts    # server: Claude decide + MCQ, validated
├── components/
│   ├── LectureLoopApp.tsx         # screen switcher
│   ├── StartScreen.tsx
│   ├── MicPermissionError.tsx
│   ├── LectureScreen.tsx          # header + transcript + checkpoint area
│   ├── TranscriptPane.tsx
│   ├── CheckpointArea.tsx
│   ├── QuickCheckCard.tsx
│   ├── StatusDots.tsx
│   └── SummaryScreen.tsx
├── lib/
│   ├── audio/mic.ts               # mic → 16-bit PCM chunks
│   ├── transcription/deepgram.ts  # live WebSocket client + reconnect
│   ├── checkpoints/
│   │   ├── config.ts              # all timing constants in one place
│   │   ├── scheduler.ts           # "is it worth asking now?" (pure)
│   │   ├── prompt.ts              # system prompt + request builder
│   │   ├── schema.ts              # zod/JSON schema for Claude output
│   │   ├── validate.ts            # grounding + duplicate + shape checks (pure)
│   │   └── window.ts              # builds transcriptWindow / recentTail
│   ├── session/
│   │   ├── types.ts
│   │   ├── reducer.ts             # all state changes (pure)
│   │   ├── mastery.ts             # derived concept statuses + counts (pure)
│   │   └── useLectureSession.ts   # wires everything together
│   └── device.ts                  # wake lock, leave-page warning
├── public/
│   └── pcm-worklet.js             # AudioWorklet: Float32 → Int16
├── tests/                         # Vitest unit tests for pure modules
├── scripts/
│   ├── replay-transcript.ts       # dev: replays a lecture text through scheduler + real AI route logic
│   └── stt-file-test.ts           # dev: streams a WAV to Deepgram to verify live STT + token auth
├── fixtures/lectures/             # TEST-ONLY sample lecture texts (labeled as such)
├── .env.example                   # variable names only, no secrets
├── README.md                      # what it is, setup, env vars, run, deploy, limits
├── LICENSE                        # MIT (repo must be open source)
├── devpost/                       # Devpost learning workspace (scope, prd, spec, checklist)
└── .agents/ .claude/ agent/ skills-lock.json   # Devpost Learn Skill Pack (installed)
```

## External Services and Dependencies

### Deepgram
- **Token:** `POST https://api.deepgram.com/v1/auth/grant`, header `Authorization: Token <DEEPGRAM_API_KEY>`, body `{"ttl_seconds":60}` → `{ "access_token": "<jwt>", "expires_in": 60 }`. The key needs Member role or higher. The token only has to be valid when the WebSocket opens. Docs: https://developers.deepgram.com/guides/fundamentals/token-based-authentication
- **Live:** `wss://api.deepgram.com/v1/listen?...` (params above). Send binary Int16 PCM frames. It receives `Results` messages (`channel.alternatives[0].transcript`, `is_final`, `speech_final`, `start`, `duration`) and `UtteranceEnd` messages (`last_word_end`). Docs: https://developers.deepgram.com/docs/live-streaming-audio, https://developers.deepgram.com/docs/understanding-end-of-speech-detection
- **Cost:** Nova-3 streaming ≈ $0.0048–0.0077/min (≈ $0.29–0.46 per hour). $200 free signup credit.

### Anthropic (Claude)
- `@anthropic-ai/sdk` → `client.messages.create` / `parse` with `output_config.format` (JSON schema). Default model `claude-sonnet-5-5` ($2 / $10 per million input/output tokens); comparison model `claude-opus-5-5` ($4 / $20). Docs: https://docs.claude.com/en/docs/build-with-claude/structured-outputs
- Each call is ~2–3k input tokens and a few hundred output tokens plus thinking. Estimated 40–80 calls per lecture-hour after scheduler gating. The replay script logs `usage` to measure the real cost.
- Needs an API key from https://console.anthropic.com with prepaid credit (and a spend limit).

### Vercel
- Free Hobby plan. Import the GitHub repo, set env vars, auto-deploys on push. Docs: https://vercel.com/docs/deployments

## Important Failure Modes

- **Mic denied or unavailable** → `MicPermissionError` with how-to-allow text and **Try again**. Nothing else starts.
- **Deepgram connection drops** (network, token, timeout) → header shows "Reconnecting…", the transcript stays, and it auto-reconnects with a fresh token. After 5 failed tries: "Connection lost". **End** still works and shows the summary of what was captured.
- **Claude slow, failing, or producing a bad/ungrounded question** → the checkpoint is skipped silently (`wait`), the scheduler tries again after more speech, and no broken card is ever shown. Server logs record the reason.
- **Premature or trivial questions** (quality failure, not a crash) → reduced by the pause trigger, `recentTail` rule, importance filter and `MIN_GAP`. Measured with the replay script on two subjects, and tuned in `config.ts` / `prompt.ts`.

## What Was Simplified and Why

- **One AI call decides *and* writes the question** instead of a separate "concept detector" and "question writer". This halves latency and cost. The fuller version would add a cheaper first-pass detector, with a second call only when a concept is complete.
- **Rolling ~8-minute window** instead of the whole lecture plus a running concept map. Questions must be about recent material anyway. The fuller version would keep a compact running outline of the whole lecture for cross-topic questions.
- **Timing rules are fixed constants** in `config.ts` instead of adapting to each student. The fuller version would adapt spacing to answer speed and accuracy.
- **In-page memory only** instead of saved sessions. That's enough for one lecture, per the PRD.
- **Grounding check by quote matching** instead of a second AI "fact-check" pass. It is deterministic, free and instant. The fuller version could add a verifier model.
- **No abuse protection on the public link** beyond provider spend limits. The fuller version would add rate limiting or an access code.

## Decisions and Open Issues

**Learner decisions (from scope/PRD):** English-only, MCQ-only, phone/iPad-first, transcript-top / questions-bottom, unanswered cards vanish but are kept, color palette, no accounts/DB.

**Learner decisions at spec review:**
1. **Deepgram free credit for transcription + Claude for AI.** Accepted tradeoff: two accounts/keys.
2. **`claude-sonnet-5-5` as the POC default "to minimize cost"**, kept configurable (`CLAUDE_MODEL`) to compare against `claude-opus-5-5` later, specifically on idea-completion timing. The replay script supports `--model` for that comparison.
3. **No paid infrastructure unless the competition demo actually requires it.** Vercel's free Hobby plan is used only for the `https` link that phone/iPad need. A GitHub account (also required for submission) and a Vercel account are needed at the deploy step.

**Implementation details derived by the agent** (no learner decision needed): Next.js + TypeScript + Tailwind, file layout, timing constants (start values to tune), the validator rules, Vitest.

**Learner uncertainty discussed:** the learner's goal is to learn *when to let an agent decide*. In this spec, routine technical choices (framework, file layout, constants, validation rules) were made by the agent and explained. Choices with **cost, accounts, or product-quality tradeoffs** (which paid services, which model, whether to deploy publicly) are left to the learner. That split is the practical answer to the question, and the build will follow it: the agent proceeds on routine steps and stops only for consequential ones.

**Verification plan (how we'll know the kernel works without a live classroom):**
- Unit tests for `scheduler`, `validate`, `reducer`, `mastery`.
- `scripts/replay-transcript.ts` replays two test lecture texts from different subjects (e.g. biology and economics; **test fixtures, clearly labeled**) at simulated speed through the real scheduler + prompt + validator + Claude. Check: questions only after a point is wrapped up, ≥ 2 min apart, every evidence quote present in the transcript, no duplicate concepts. It also logs token usage for the real cost.
- `scripts/stt-file-test.ts` streams a speech WAV (generated locally with Windows text-to-speech from a fixture) to Deepgram using the **same temporary-token WebSocket handshake** as the browser, to confirm live transcription works.
- Browser check of the UI flows. Finally, the learner's **live test** on phone/iPad with a real recorded lecture playing aloud.

**Open (carried from PRD):** exact `MIN_GAP` / timeout values get tuned during the build. Deployment needs the learner's GitHub/Vercel accounts (at the deploy step).
