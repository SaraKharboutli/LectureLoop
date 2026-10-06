# LectureLoop

**Turn a live lecture into an active study session.** LectureLoop listens to an English lecture through your phone, iPad, or laptop microphone, shows the lecture as live text, and about every minute and a half gives you one short multiple-choice question about a point the lecturer has *just finished* explaining. At the end you get a Lecture Mastery summary showing what you understood and what needs review.

> The AI should enhance the lecture, not replace it, and not distract from it.

**Try it:** https://lecture-loop-three.vercel.app (allow the microphone, then play or give an English lecture).

Built for the Devpost hackathon **Build With AI: Basics** using the Devpost Learn Skill Pack (planning docs in [`devpost/`](devpost/)).

---

## The problem

Students often spend an hour passively listening to a lecture, then another hour or more re-studying the same material from scratch, because that is when the real work of recalling, testing yourself, and finding weak spots happens. Note-takers and summarizers help *after* class. LectureLoop moves the active-learning part **into** the lecture itself.

## What it does

1. **Start Learning**: the app asks for the microphone and starts listening.
2. **Live transcript**: the lecture appears as text at the top of the screen while it is spoken.
3. **Quick Checks**: at the end of a sentence, roughly every 1.5 minutes, a small card slides in with one multiple-choice question about the most recent point the lecturer finished making. It never asks about something still being explained, and never about anything that wasn't said.
4. **Feedback**: a correct answer shows "Got it ✓" and the card closes itself. A wrong answer shows "Needs review", the correct answer, and a one-line explanation from the lecture. An ignored card disappears after a minute and is kept as "not answered".
5. **Understanding tracking**: each concept is *understood*, *needs review*, or *not answered*. A missed concept can be re-checked later if the lecturer comes back to it.
6. **End → Lecture Mastery**: counts per status, every question with your answer, the correct answer and the explanation. Questions you missed can be answered right there.

Everything is designed for a quick glance: calm colors, big tap targets, and cards that fit a phone screen without scrolling.

## How it works

```
 Mic ─► AudioWorklet (16-bit PCM) ─► Deepgram live speech-to-text (WebSocket, short-lived token)
                                          │ finished sentences
                                          ▼
                              timing rules (plain code)
               "a sentence just ended; is a question due? enough new speech?"
                                          │ yes
                                          ▼
                      /api/checkpoint ─► Claude (structured JSON output)
                 "has a point been finished? write one grounded MCQ + a verbatim quote"
                                          │
                                          ▼
              validator (plain code): quote really in transcript? 4 distinct choices?
                           not already tested? not trivial?
                                          │
                                          ▼
                                 Quick Check card
```

- **Speech-to-text:** [Deepgram](https://developers.deepgram.com/docs/live-streaming-audio) `nova-3`, streamed straight from the browser. The secret API key stays on the server, which only hands the browser a 60-second token ([`app/api/stt-token`](app/api/stt-token/route.ts)).
- **Deciding when and what to ask:** [Claude](https://docs.claude.com) (`claude-sonnet-5-5` by default) receives the last few minutes of transcript, the last ~30 seconds ("what is being said right now"), the concepts already tested, and whether a question is *due*. It answers in a fixed JSON format ([`lib/checkpoints/schema.ts`](lib/checkpoints/schema.ts)), either *wait* or *ask* with the question, four choices, the answer, an explanation, and an evidence quote. The rules it follows are in [`lib/checkpoints/prompt.ts`](lib/checkpoints/prompt.ts).
- **Grounding check:** before any question is shown, [`lib/checkpoints/validate.ts`](lib/checkpoints/validate.ts) confirms the evidence quote actually appears in the transcript (tolerating small recognition differences), that there are 4 distinct choices, and that the concept hasn't been tested already. Anything that fails is silently skipped. Choices are shuffled on the server.
- **Timing rules:** [`lib/checkpoints/scheduler.ts`](lib/checkpoints/scheduler.ts) and [`config.ts`](lib/checkpoints/config.ts). Checks happen only at the end of a complete sentence (pauses don't matter). A question becomes due after 90 s, cards are at least 75 s apart, and one request runs at a time.
- **State:** everything lives in page memory ([`lib/session/`](lib/session/)). There are no accounts and no database, and closing the page ends the session.

## Tech stack

Next.js (App Router) · React · TypeScript · Tailwind CSS · Deepgram live streaming · Anthropic TypeScript SDK (structured outputs) · zod · Vitest

## Getting started

### Requirements

- Node.js 20+ and Git
- A **Deepgram** API key with the **Member** role or higher ([console.deepgram.com](https://console.deepgram.com); new accounts get free credit). A key with the default role can transcribe but can't issue the browser tokens.
- An **Anthropic** API key ([console.anthropic.com](https://console.anthropic.com)). Setting a monthly spend limit is recommended.

### Setup

```bash
git clone https://github.com/SaraKharboutli/LectureLoop.git
cd LectureLoop
npm install
```

Copy `.env.example` to `.env.local` and fill in your keys:

| Variable | Required | Purpose |
|---|---|---|
| `DEEPGRAM_API_KEY` | yes | Live speech-to-text (server-side only; the browser gets short-lived tokens) |
| `ANTHROPIC_API_KEY` | yes* | Claude decides when to ask and writes the question |
| `CLAUDE_MODEL` | no | Defaults to `claude-sonnet-5-5`; `claude-opus-5-5` also works |
| `AI_GATEWAY_API_KEY` | no | *Alternative to `ANTHROPIC_API_KEY`: send the same Claude request through Vercel AI Gateway |

`.env.local` is git-ignored. Never commit real keys.

### Run

```bash
npm run dev
```

Open http://localhost:3000 in Chrome or Edge (tested; recent Safari supports the same browser features), tap **Start Learning**, allow the microphone, and play an English lecture out loud (or give one yourself). The first question usually appears after a minute and a half.

Phones and tablets only allow the microphone on `https` pages, so to use LectureLoop on an iPad or phone, deploy it (below).

### Deploy (Vercel, free Hobby plan)

1. Push the repo to GitHub.
2. In [Vercel](https://vercel.com/new), import the repository (framework preset: Next.js).
3. Add `DEEPGRAM_API_KEY`, `ANTHROPIC_API_KEY` (and optionally `CLAUDE_MODEL`) under **Settings → Environment Variables**.
4. Deploy and open the `https://…vercel.app` URL on your device.

A public URL lets anyone use your API credit. Keep a spend limit on your Anthropic account. If the credit runs out, the app keeps transcribing but stops showing questions.

## Developer tools

```bash
npm test                     # unit tests: timing rules, validator, session state, transcriber reconnects
npm run replay -- fixtures/lectures/history-cold-war-end.txt              # replay a lecture through the real engine
npm run replay -- fixtures/lectures/biology-photosynthesis.txt --model claude-opus-5-5   # compare models
npm run stt-test -- path/to/speech.wav    # stream a 16-bit mono WAV to Deepgram with the browser's token handshake
npm run probe-ai             # one cheap request to check the Claude key/model
```

- `npm run replay` prints a timeline of every check (when, ask or wait, and why), the full questions with evidence quotes, the smallest gap between questions, latency, and estimated cost per lecture-hour. By default it splits sentences into fragments the way live speech-to-text does.
- [`fixtures/lectures/`](fixtures/lectures/) holds **test-only** lecture texts written for this project (biology, economics, history).
- **Development-only test mode:** `http://localhost:3000/?devfeed=history&speed=8` replays a fixture instead of the microphone (useful where the mic isn't available). It only works under `npm run dev`. In production builds the option is ignored and its route returns 404.
- In development, every Claude decision (with the exact transcript it saw) is appended to `tmp/checkpoint-log.jsonl` for tuning.

## Measured results (replays of the test lectures, Claude Sonnet 5.5)

| Lecture (fragmented like live STT) | Length | Questions | Smallest gap | Cost / lecture-hour |
|---|---|---|---|---|
| History: end of the Cold War (conversational, no summaries) | 5:39 | 4 | 80 s | ≈ $0.49 |
| Biology: photosynthesis | 8:04 | 6 | 66 s* | ≈ $0.67 |
| Economics: supply and demand | 7:13 | 6 | 65 s* | ≈ $0.60 |

\*Measured before the minimum gap was raised from 60 s to 75 s. In every run, every evidence quote was found in the transcript and the validator rejected nothing. Average Claude latency was about 3 seconds. Deepgram streaming is about $0.29–0.46 per hour.

## Limitations (honest list)

- **English only.** Arabic and mixed Arabic–English lectures are planned, not built.
- **Multiple choice only.** Free-recall and confidence questions are future ideas.
- **No saving.** A session lives in the open page. Refreshing or closing it loses the session (the app warns you first).
- **Audio quality matters.** It works best when the device clearly hears one speaker. Noisy rooms, far-away microphones, and several speakers are not handled specially.
- **The AI can still be wrong.** The grounding check guarantees the quoted evidence was really said, but a question can still be imperfectly worded or slightly off-target.
- **Screen wake lock** depends on browser support. If unsupported, the device may dim during a long lecture.

## Project structure

```
app/                 Next.js app: page, layout, API routes
  api/checkpoint/    Claude decision + validated question
  api/stt-token/     short-lived Deepgram token for the browser
  api/dev-fixture/   development-only fixture feed (404 in production)
components/          Start, Lecture (transcript + quick checks), Summary screens
lib/audio/           microphone → 16-bit PCM
lib/transcription/   Deepgram live client, token helper
lib/checkpoints/     timing rules, prompt, schema, validator, transcript window
lib/session/         session state (reducer), mastery, the hook that wires it all
lib/device.ts        wake lock + leave-page warning
public/pcm-worklet.js
scripts/             replay, STT test, AI probe
fixtures/lectures/   test-only lecture texts
tests/               Vitest unit tests
devpost/             Devpost Learn planning: scope, PRD, spec, build checklist
.agents/skills/      the Devpost Learn Skill Pack used to plan and build this project
```

## How this was built

Planned and built with the [Devpost Learn Skill Pack](https://github.com/challengepost/learn-ai-basics) (plan before you build): [`devpost/scope.md`](devpost/scope.md) → [`devpost/prd.md`](devpost/prd.md) → [`devpost/spec.md`](devpost/spec.md) → [`devpost/checklist.md`](devpost/checklist.md). The **Revisions** section of the checklist records what real testing changed. For example, live tests with a recorded lecture showed that waiting for the lecturer to pause produced far too few questions, which led to the current sentence-based rhythm.

## License

[MIT](LICENSE)
