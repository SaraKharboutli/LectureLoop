---
doc: checklist
status: approved
---

# Build Checklist

Build mode: fast (learner: "I don't want you to tell me when each step is finished. Stop only when there is something you want to consult me on, and leave explaining how it works for the end, at submission time.")

## Slices

- [x] **1. A lecture text goes in, well-timed grounded questions come out**
  Becomes usable: `npm run replay -- fixtures/lectures/<file>.txt` replays a lecture at simulated speed through the real timing rules, prompt, Claude call and validator, and prints a timeline: when each question would appear, its concept, question, choices, answer, the evidence quote, and why other moments were skipped. Also prints token usage / estimated cost. `--model` switches between Sonnet 5.5 and Opus 5.5.
  Why now: This is the kernel (`scope.md > The Unique Kernel`): *when* to ask and *what* to ask, grounded in what was said. It is also the biggest risk (AI judgment quality), so it is proven first without needing audio. Bootstrapping (Next.js scaffold, deps, env, Vitest) lives here.
  PRD ref: `prd.md > Checkpoint timing (the kernel)`, `prd.md > Quick Check question`
  Spec ref: `spec.md > Checkpoint Scheduler`, `spec.md > Checkpoint Route (AI decision + question)`, `spec.md > Question Validator`, `spec.md > File Structure`, `spec.md > External Services and Dependencies`
  Build: Scaffold Next.js + TypeScript + Tailwind; add `.env.example`, `@anthropic-ai/sdk`, zod, Vitest. Implement `lib/checkpoints/{config,scheduler,window,prompt,schema,validate}.ts` and `app/api/checkpoint/route.ts` (handler logic in a callable function shared with the script). Write two TEST-ONLY lecture fixtures (biology + economics, ~8–10 min of speech each, with clear concept boundaries plus filler/logistics). Write `scripts/replay-transcript.ts`. Unit tests for scheduler and validator.
  Verify (mechanical): `npm test` passes (scheduler: warm-up, MIN_GAP, new-speech, in-flight; validator: ungrounded quote rejected, duplicate concept rejected, bad choices rejected). `npm run replay` on both fixtures with Sonnet 5.5: ≥ 3 questions per fixture, all ≥ 120 s apart, every evidence quote found in the transcript, no duplicate concepts, no question about logistics/filler, no question asked before its concept's explanation ended (checked by reading the timeline against the fixture). `npm run build` succeeds.
  Learner check: Read the printed timeline for one fixture next to the lecture text. Do the questions feel like the right moments and the right things to ask?
  Commit: `Add checkpoint engine: timing rules, grounded MCQ generation, replay script`

- [x] **2. Start Learning shows the lecture as live text**
  Becomes usable: Open the app, tap Start Learning, allow the mic, and spoken English appears in the top transcript area within seconds (in-progress words lighter). Header shows Listening, elapsed time, and End (End stops listening for now).
  Why now: Live audio → text is the second big risk (browser audio format, temporary-token WebSocket auth) and everything live depends on it.
  PRD ref: `prd.md > Starting a session`, `prd.md > Live transcript`, `prd.md > Screens and Layout`
  Spec ref: `spec.md > Mic Capture`, `spec.md > STT Token Route`, `spec.md > Live Transcription Client`, `spec.md > Screens`, `spec.md > Look and Feel`
  Build: `public/pcm-worklet.js`, `lib/audio/mic.ts`, `app/api/stt-token/route.ts`, `lib/transcription/deepgram.ts` (incl. KeepAlive, CloseStream, reconnect), session types + reducer (transcript actions), `StartScreen`, `LectureScreen`, `TranscriptPane`, theme tokens + Inter font. `scripts/stt-file-test.ts` streams a WAV (made with Windows text-to-speech from a fixture) through the same token + WebSocket handshake.
  Verify (mechanical): `npm run stt-test` prints a transcript that matches the fixture text closely, proving the token route and WebSocket params work. Dev server starts clean; `/api/stt-token` returns a token and no API key; Start screen and Lecture screen render in the browser at phone width with the spec colors; reducer unit tests for interim/final segments pass.
  Learner check: On the laptop at http://localhost:3000, tap Start Learning, play a recorded English lecture (or speak) near the mic, and watch the words appear.
  Commit: `Add live transcription: mic capture, Deepgram streaming, lecture screen`

- [x] **3. Quick Check cards appear during the lecture and record answers**
  Becomes usable: While listening, after the lecturer finishes an idea, a Quick Check card slides into the bottom area; tapping an answer shows "Got it ✓" or "Needs review" plus explanation; unanswered cards vanish after 90 s; status dots show ✓ / ⚠ / ○ live; missed concepts can be re-checked later.
  Why now: Joins slice 1 (kernel) and slice 2 (live text) into the core loop; this is where early learner feedback can still reshape timing and card design.
  PRD ref: `prd.md > Checkpoint timing (the kernel)`, `prd.md > Answering and feedback`, `prd.md > Understanding tracking`
  Spec ref: `spec.md > Session State`, `spec.md > Checkpoint Scheduler`, `spec.md > Screens`, `spec.md > Data Model`
  Build: `useLectureSession` wires pause events + fallback timer → scheduler → `/api/checkpoint` → reducer; `CheckpointArea`, `QuickCheckCard`, `StatusDots`; card timeouts and auto-dismiss; `lib/session/mastery.ts`. A **development-only** transcript feed (`?devfeed=<fixture>`, active only under `npm run dev`, clearly labeled, never in production) replays a fixture into the same reducer so the live loop can be verified without a microphone.
  Verify (mechanical): Unit tests for reducer answer/timeout/re-check and mastery derivation pass. In the browser with `?devfeed=biology` (accelerated), cards appear only at concept boundaries and ≥ MIN_GAP apart, correct/incorrect/ignored paths each produce the right feedback and dot. `npm run build` passes and the dev feed is absent from the production build.
  Learner check: With a recorded lecture playing aloud near the laptop, use LectureLoop for ~6–8 minutes: answer one question right, one wrong, ignore one. Do the timing and card feel right?
  Commit: `Add live Quick Check cards, answer feedback, and understanding tracking`

- [x] **4. End shows the Lecture Mastery summary**
  Becomes usable: Tap End → listening stops → Lecture Mastery shows counts (understood / needs review / unanswered) and every question with your answer, the correct answer, and explanation; unanswered questions can be answered there; New session starts over.
  Why now: Closes the core loop (`scope.md > What "Working" Looks Like`); needs the question data from slice 3.
  PRD ref: `prd.md > Ending and Mastery Summary`, `prd.md > The Core Journey` (steps 9–10)
  Spec ref: `spec.md > Screens`, `spec.md > Session State`, `spec.md > Data Model`
  Build: `END`/`RESET` actions (active card → unanswered, stop mic + CloseStream, ignore late AI responses), `SummaryScreen` with answerable unanswered rows and empty-session state.
  Verify (mechanical): Reducer tests: End with an active card counts it unanswered; answering from summary updates counts; late checkpoint response after End is ignored. Browser (dev feed): mixed session → counts match; zero-question session shows the "No checkpoints" state.
  Learner check: After a short session, tap End and check the summary matches what you did; answer one unanswered question there.
  Commit: `Add Lecture Mastery summary`

- [x] **5. It behaves calmly when things go wrong, and stays awake**
  Becomes usable: Denied mic shows how to allow it plus Try again; a dropped connection shows Reconnecting… and recovers; screen stays on while listening; leaving mid-session asks for confirmation; layout is checked at phone and iPad sizes.
  Why now: These states matter in a real lecture hall and for a trustworthy demo, but only after the loop works.
  PRD ref: `prd.md > States and Boundaries`, `prd.md > Look and Feel`
  Spec ref: `spec.md > Important Failure Modes`, `spec.md > Device Helpers`, `spec.md > Live Transcription Client`, `spec.md > Look and Feel`
  Build: `MicPermissionError`, reconnect status in header, `lib/device.ts` (wake lock, beforeunload), responsive/visual polish pass against Look and Feel.
  Verify (mechanical): Browser: denying mic (or simulated `NotAllowedError`) shows the error view; forcing the WebSocket closed shows Reconnecting… then Listening again (verified with a fake-WebSocket unit test, `tests/transcriber.test.ts`, because the browser pane blocks the microphone); screenshots at 390×844 and 820×1180 match the palette and layout; `npm test` and `npm run build` pass.
  Learner check: Try denying the mic once, then allow it; turn Wi-Fi off for a few seconds during a session and back on.
  Commit: `Handle mic denial, reconnects, wake lock, and polish layout`

- [x] **6. Open it on your phone or iPad**
  Becomes usable: A free `https://…vercel.app` link runs LectureLoop on the learner's phone/iPad with the mic; README explains setup, env vars, running, and deploying.
  Why now: The target devices need `https`; the repo docs are required for submission and for deploying.
  PRD ref: `prd.md > Screens and Layout` (phone/iPad first), `prd.md > Open Questions` (testing on phone/iPad)
  Spec ref: `spec.md > Where It Runs and How Someone Tries It`, `spec.md > External Services and Dependencies`
  Build: `README.md` (what/why, how it works, setup, env vars without secrets, run, replay/STT scripts, deploy, limitations, cost notes), `LICENSE` (MIT); push to the learner's GitHub repo (private until `6-ship`); Vercel import with env vars (free Hobby plan, no paid add-ons).
  Verify (mechanical): Production deployment succeeds; `/api/stt-token` and `/api/checkpoint` work on the deployed URL; `git ls-files` contains no `.env.local` or learner profile; README commands run as written on a clean install.
  Learner check: Open the link on your iPad/phone, start a session with a lecture playing aloud, and complete one Quick Check.
  Commit: `Add README, license, and deployment notes`

- [x] **7. My lectures: come back to what needs review**
  Becomes usable: Ended sessions are saved on the device; the Start screen lists them; opening one shows its summary and lecture text and lets you retry missed/wrong questions; lectures can be deleted.
  Why now: Added at final review — the learner chose it so the product doesn't end at the summary (the student leaves with a review list they can return to).
  PRD ref: `prd.md > My lectures (saved on this device)`
  Spec ref: `spec.md > Saved Lectures`
  Build: `lib/session/savedLectures.ts`, save on summary in the session hook, `MyLectures` list on the Start screen, `SavedLectureScreen` (reusing the summary view) with retry and delete.
  Verify (mechanical): unit tests for save/load/update/retry/limit; dev-feed session → End → reload → lecture listed and opens with its questions and text; `npm run build`.
  Learner check: (learner asked for no extra check-ins; covered by the mechanical check)
  Commit: `Add My lectures: save sessions on the device and retry missed questions`

## Hands-on Checkpoints

- [x] Early usable behavior explored — after slice 3 (live cards on localhost with a real recorded lecture). Three learner tests on a recorded history lecture; feedback (too few questions, don't depend on pauses, aim for one every 1.5–2 min) applied and confirmed: "two questions in about 3 minutes" — see Revisions.
- [x] Final kick-the-tires exploration and feedback completed — learner tested the deployed app on an iPad with a lecture: "the site worked fine on the iPad and everything is fine". Their one change request (save lectures/questions to come back to) became slice 7.

## Final Review

- [x] Add "My lectures" (save sessions on the device, retry missed questions) — learner-requested at final review; built as slice 7, verified (unit tests + dev-feed session → End → reload → open → retry → "✓ after review"), committed. Learner asked for no further check-in: "if you see the lecture and the questions are saved, move on".
- [x] Final review complete — feedback resolved and learner confirms ready to ship ("consider it ready" once My lectures is in).

## Code Tour and App Map

- [x] Learning activity complete — brief recap (learner asked for explanations at the end without extra exercises)
- [x] Optional edit and transfer reflection addressed — edit not applicable (learner declined extra check-ins); reflection question offered in the final message
- [x] `devpost/app-map.html` generated from finished code, checked, and shown, including a project-grounded practice to reuse

Activity and evidence: Recap connected to the learner's goal (working effectively with agents): their live-test observations ("8 min → 1 question", "3 min → none") plus the dev decision log diagnosed the pause-based timing flaw; fix and before/after replay results recorded in Revisions.
Route and stops: Reference route only (not toured live): `lib/session/reducer.ts` FINAL_SEGMENT → `lib/checkpoints/scheduler.ts` shouldEvaluate → `lib/checkpoints/evaluate.ts` / `validate.ts` → `components/QuickCheckCard.tsx` → `lib/session/mastery.ts` / `savedLectures.ts`.
Edit outcome: Not applicable (no extra exercise requested).
Reflection: Offered once in the closing message; optional.
Activity mode: Recap + app map (static reference).

## Revisions

- Added a "GOOD MOMENT" rule to the checkpoint prompt (ask only when the last sentences close a thought) — the first replay showed questions about completed ideas popping up while the lecturer was mid-way through the *next* explanation; after the change, all 6 replay questions landed at natural breaks.
- Checkpoint area grows to about two-thirds of the screen while a card is showing (transcript shrinks), and an answered card keeps only the correct choice and the student's pick — on a 375×812 phone the card + feedback did not fit in the planned 42% area without scrolling.
- Optional Vercel AI Gateway route added (`AI_GATEWAY_API_KEY`, same prompt/schema/effort, no server-side fallback) — the learner tried it to use free credits, but the gateway requires a card on file and its free tier does not include Claude models; the learner chose the direct Anthropic API. The code supports both; direct Anthropic is the default path.
- Deepgram keys need the Member role or higher — a Default-role key can transcribe but cannot issue the browser's temporary tokens (403 from `/v1/auth/grant`).
- The development-only `?devfeed` test mode cannot activate in production (env-gated; `/api/dev-fixture` returns 404), but its inert code is still present in one client bundle — acceptable for a POC; a stricter build could split it into a dev-only module.
- Final-review design polish (learner asked for an honest judge-style design review, then approved all four suggestions): logo + tab icon, "how it works" strip, source-sentence highlighting while a card is open, and a two-column laptop layout. Verified with unit tests (`tests/highlight.test.ts`), headless Edge screenshots at 1440×960, and a 375 px phone check (no horizontal overflow). Found and fixed along the way: React dev mode ran the new dev-only autostart twice (duplicated transcript in screenshots) — guarded with a ref; ESLint was scanning the headless-browser profile in `tmp/` — `tmp/**` now ignored. One unreproduced observation: a dev-feed session in the browser pane jumped to the summary once right after an emulated viewport resize mid-session; a repeat run without the resize behaved normally.
- Slices 2–4 were written while waiting for API keys and verified together (unit tests + dev-feed browser run + the learner's live tests); because their code is intertwined (one session hook drives transcript, cards and summary), they are committed together as one working step so every commit builds.
- First live test (learner, 8-min recorded history lecture): only one question, and the second appeared only when the recording was stopped. Cause: speech-to-text finalizes text at every breath, so most checks saw a half-finished sentence and the strict "natural break" rule waited; the fixture replays had used whole sentences and hid this. Changes: (1) checks run only after a complete sentence; (2) the prompt treats transitions as ideal moments and says untested completed ideas must not pile up; (3) replays now fragment sentences like live STT by default (`--whole-sentences` for the old mode); (4) learner decision — ask about every complete idea: `MIN_GAP` 120 s → 60 s, card timeout 90 s → 60 s; (5) dev-only decision log at `tmp/checkpoint-log.jsonl`. Result on fragmented replays: 6/6 core ideas questioned in each lecture, all grounded, ~65 s apart, ≈ $0.55 per lecture-hour.
- Second live test (learner): 3 minutes of a recorded lecture with several ideas, no question. The log showed only two checks in 2.5 minutes — a recorded lecturer rarely stops after a full sentence, so pause-based checks were scarce. Learner decisions: drop pauses completely; aim for a question about every 1.5–2 minutes; it need not wait for a major idea. Changes: checks fire at the end of any complete sentence (Deepgram pause/UtteranceEnd events removed); a question becomes "due" after 90 s and the prompt then asks about the latest finished point of any size; `MIN_GAP` 75 s; added a third, conversational history fixture. Result on fragmented replays of all three subjects: 4–6 grounded questions per 5–8 minutes, ~80 s apart on the history lecture, no rejections, ≈ $0.50–0.65 per lecture-hour.

