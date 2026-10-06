---
doc: prd
status: approved
---

# LectureLoop — Product Requirements

LectureLoop is a mobile-first web app for a university student in a live English lecture. It listens, shows the lecture as live text, and right after the lecturer finishes a meaningful idea, offers one short multiple-choice question about what was just taught. At the end it shows what the student understood and what needs review.
Source: `scope.md > The Unique Kernel`, `scope.md > The Core Loop`.

## The Core Journey
Source: `scope.md > The Core Loop`, `scope.md > What "Working" Looks Like`.

1. The student opens LectureLoop on their phone or iPad and sees the **Start screen**: the name, a one-line explanation, a tip to place the device where it can hear the lecturer, and a **Start Learning** button.
2. They tap **Start Learning**. The browser asks for microphone permission; they allow it.
3. The **Lecture screen** opens. The top part shows the lecture as live text, updating while the lecturer speaks. The bottom part is quiet, with only a small "Listening…" state and a row of status dots for previous questions (empty at first). The student puts their attention back on the lecturer.
4. In the background, LectureLoop follows the recent lecture text and waits until the lecturer has **finished** explaining a meaningful idea that hasn't been tested yet, and enough time has passed since the last question.
5. A **Quick Check card** slides into the bottom part: the concept name, one question, and four answer choices.
6. The student taps an answer:
   - **Correct** → the card shows "Got it ✓" in green and disappears after a moment.
   - **Incorrect** → the card shows "Needs review", highlights the correct choice, and shows a one-line explanation from the lecture. It disappears after a few seconds or on tap.
   - **No answer** → when the next question is ready (or after a time limit), the card disappears. The question is kept as *unanswered*.
7. Every question asked is kept in the session and appears as a status dot (✓ / ⚠ / ○) in the bottom part. The app keeps listening, and steps 4–6 repeat a few times over the lecture, sensibly spaced.
8. If a concept was missed and the lecturer later comes back to it, LectureLoop may ask a new question about it. Answering that one correctly upgrades the concept to understood.
9. When the lecture ends, the student taps **End**. Listening stops and the **Mastery Summary screen** appears: counts of understood / needs review / unanswered, and a list of every question with its concept, status, the correct answer, and the explanation. Unanswered questions can be answered right there.
10. **Success:** the student leaves knowing which concepts from *this* lecture they already understand and exactly which ones to review.

## Screens and Layout
Three screens in one app, designed for **portrait phone and iPad** first, and still usable on a laptop.

- **Start screen:** centered, mostly white. Name, one-line description, mic tip, large Indigo **Start Learning** button.
- **Lecture screen:** split vertically.
  - **Header (thin):** app name, a calm "Listening" indicator (small pulsing Indigo dot), elapsed time, and an **End** button.
  - **Top: Live transcript** (larger part, roughly 55–60%). Lecture text scrolls up as new words arrive and always shows the latest words. Words still being recognized appear lighter, then settle.
  - **Bottom: Checkpoints area** (roughly 40–45%). Usually idle ("Listening…"). The Quick Check card appears here when there is a question; while a card is showing, this area grows to about two-thirds of the screen so the whole card fits on a phone without scrolling (build revision). Below it, a row of small status dots, one per question so far.
- **Mastery Summary screen:** heading "Lecture Mastery", three counts (understood ✓ / needs review ⚠ / unanswered ○), then a list of question rows. A **New session** button at the bottom.

Navigation is linear: Start → Lecture → Summary → (New session) → Start.

## Look and Feel
Set by the learner:
- **Colors:** White `#FFFFFF` (main background); Primary Indigo `#5B5BD6` (buttons, active indicator, accents); light Indigo tint `#EEF2FF` (cards and background panels); Dark Navy `#111827` (main text); calm green `#22C55E` **only** for correct/mastered states.
- **Proportion:** about 80% white, 15% Indigo, 5% status colors.
- **Feel:** calm, quiet, low-attention, a background companion and not a dashboard (`scope.md > Inspiration & Identity`). Soft rounded cards, generous spacing, large touch targets for a phone or iPad.
- *Assumption:* "needs review" uses a soft amber (e.g. `#F59E0B`) inside the 5% status budget, so red/alarm colors never appear. Unanswered uses a neutral gray. Typography is a clean, readable sans-serif.

## Features and Behavior

### Starting a session
- Tapping **Start Learning** asks for microphone access, then opens the Lecture screen and begins listening.
  - [ ] After allowing the mic, the header shows "Listening" and spoken English starts appearing as text within a few seconds.

### Live transcript
- Shows what the lecturer says as text, continuously, in the top area. It auto-scrolls to the newest text. In-progress words look lighter and are replaced by final text.
  - [ ] Speaking a sentence near the device shows that sentence on screen, recognizably correct for clear English speech.
  - [ ] The view stays scrolled to the latest text during a long lecture.

### Checkpoint timing (the kernel)
Source: `scope.md > The Unique Kernel`.
- A question appears **only after the lecturer has finished explaining a meaningful idea**, never at fixed intervals and never mid-explanation.
- Ideas that are trivial (a passing detail, an example name, a joke, logistics like "the exam is on Friday") are not tested.
- The same concept is not tested twice, unless it was missed and the lecturer returns to it.
- **A steady rhythm of about one quick check every 1.5 minutes** (learner decisions after live tests: "a question every minute and a half or two", "it doesn't need to wait for a big main idea", and "drop the pauses completely — the lecturer often keeps talking even after finishing an idea"). Checks happen at the end of any complete sentence; pauses play no role. When a check is due, it asks about the most recent point the lecturer has *finished* making — big or small — never about something still being explained. Cards are at least **75 seconds** apart.
  - [ ] While a recorded lecture plays, questions appear a few seconds after a point is wrapped up, not in the middle of a sentence or explanation.
  - [ ] Over several minutes of lecture, the gap between questions is never shorter than the minimum spacing.
  - [ ] No two questions test the same concept (except a re-check of a missed one).
  - [ ] Talk that is not lecture content (greetings, admin, small talk) produces no question.

### Quick Check question
- One multiple-choice question with four choices, exactly one correct, and a short concept label.
- **Grounded:** answerable using only what the lecturer has *already said* in this session. It never tests material that hasn't been taught, and never introduces facts the lecturer didn't state.
- Plausible wrong choices (not silly), choices in shuffled order.
  - [ ] For each question, the correct answer can be found in the transcript shown above it.
  - [ ] Choices are clear, short, and readable on a phone without scrolling.

### Answering and feedback
- **Correct:** "Got it ✓" in green; card dismisses itself after ~2 seconds.
- **Incorrect:** "Needs review" (amber), the correct choice highlighted, and a one-line explanation based on the lecture. It dismisses after ~8 seconds or on tap.
- **Not answered:** if the student doesn't answer, the card disappears after **1 minute** (before the next one can arrive), so a stale card never sits on screen. It is saved as unanswered.
- Each answer is final for that question (no changing answers).
  - [ ] Tapping the right choice shows the green confirmation and the card goes away by itself.
  - [ ] Tapping a wrong choice shows the correct answer and an explanation, then goes away.
  - [ ] Ignoring a card makes it disappear on its own, and a gray ○ dot is added.

### Understanding tracking
Source: `scope.md > The POC Boundary`.
- Each tested concept has a simple state: **understood ✓**, **needs review ⚠**, or **unanswered ○**.
  - Correct → understood. Incorrect → needs review. No answer → unanswered.
  - A later correct answer about a concept that needed review → understood (marked as "after review").
- The status-dot row on the Lecture screen reflects these states live.
  - [ ] After answering, the matching dot (✓ green / ⚠ amber / ○ gray) appears immediately.

### Ending and Mastery Summary
- **End** stops listening and shows the summary. A question on screen at that moment is counted as unanswered.
- Summary shows the counts and, for each question: concept, the question, the student's answer, the correct answer, the explanation, and its status.
- Unanswered questions can be answered from the summary; the result updates the counts.
  - [ ] After a session with a mix of right, wrong, and ignored questions, the counts match what happened.
  - [ ] Answering an unanswered question on the summary updates its status and the counts.

## States and Boundaries
- **First use / mic permission prompt:** the browser asks for the mic. If the student denies it, they see a plain message explaining that LectureLoop needs the microphone, how to allow it, and a **Try again** button.
- **Listening, nothing to ask yet:** the bottom area shows a calm "Listening…" state. This is normal and expected; no "no questions yet" alarms.
- **Connection or AI hiccup:** if transcription drops, the header shows "Reconnecting…" and the transcript so far stays on screen; listening resumes automatically if possible. If a question can't be created, the app silently skips that checkpoint and keeps listening, with no broken card.
- **Session ended with no questions** (e.g. very short session): the summary says no checkpoints were reached yet and shows the transcript length, not an empty or broken page.
- **Persistence:** none. A session lives only while the page is open. Refreshing or closing loses it. *Assumption:* the browser warns before leaving an active session.
- **Screen stays on:** *assumption:* while listening, the device screen should not go to sleep, if the browser allows it.
- **Language:** English only. Non-English speech is not supported in this version.

## Product Decisions
- **Live transcript on top, questions on the bottom** — the learner wants students to see the lecture as text while checkpoints appear below, "as soon as the lecturer finishes a specific idea".
- **Unanswered cards disappear and the next one follows the lecture** — the app keeps pace with the lecture instead of blocking on the student.
- **All questions are kept, answered or not** — so nothing is lost and the summary is complete.
- **Phone / iPad first** — that's what students will most likely have in the lecture.
- **Color palette and 80/15/5 proportion** — learner-specified (see Look and Feel).
- **MCQ only, English only, single session, no accounts** — from `scope.md > The POC Boundary`.
- **About one question every 1.5 minutes, about the latest finished point, no dependence on pauses** — learner decisions after two live tests (an 8-minute history lecture got one question; a 3-minute stretch with several ideas got none). Spacing: a question is due after 90 s, minimum 75 s between cards; unanswered timeout 1 minute.
- *Assumptions (agent-proposed, open to change):* amber for needs-review; answering unanswered questions on the summary; leave-page warning; keep screen awake.

## What We're Building
- Start screen with mic permission handling.
- Lecture screen: live English transcript (top), Quick Check cards and status dots (bottom), Listening/Reconnecting indicator, elapsed time, End.
- Concept-completion detection with importance filtering, no-repeat, minimum spacing, and re-check of missed concepts.
- Grounded MCQ generation with correct answer and one-line explanation.
- Correct / incorrect / unanswered feedback and per-concept understanding state.
- Mastery Summary with counts, per-question details, and answering unanswered questions.

## Deferred From the POC
- **Saving sessions / history across visits** — needs storage and possibly accounts; one session proves the loop.
- **Exporting the summary or transcript** — useful, but not needed to prove active learning during the lecture.
- **Other question types** (free-text recall, confidence checks) — MCQ gives a known correct answer and the fastest interaction.
- **Settings** (question frequency, difficulty) — sensible defaults are enough to prove timing.
- **Public deployment** — optional for the competition; may become necessary for testing on a phone/iPad (see Open Questions).

## Possible Later Enhancements
- Arabic and mixed Arabic–English lectures.
- Spaced-repetition review after class, based on the "needs review" list.
- A gentle vibration or sound option when a card appears.
- Better handling of noisy rooms, multiple speakers, and distant microphones.

## Non-Goals
- Not a note-taking, summarization, or flashcard app. Those already exist and would blur the kernel.
- No login, accounts, database, teacher view, classroom mode, sharing, or LMS integration.
- No slide uploads. Questions come only from what the lecturer said.
- No elaborate adaptive learning model.
- No demo video work at this stage.

## Open Questions
- **Testing on a phone/iPad:** browsers only allow the microphone on secure (https) pages, so using the app on the iPad/phone may require a deployed link. → Decide in `4-spec`.
- **Which speech-to-text and AI services / API keys** → `4-spec`.
- Exact spacing and timeout values → tune during the build with real lecture audio.
