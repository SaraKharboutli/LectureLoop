---
doc: scope
status: approved
---

# LectureLoop

An AI companion that listens to a live English lecture and turns it into an active study session, with brief, well-timed questions while the lecture happens.

## The Unique Kernel
**Active learning *during* the lecture, not after it.** The AI follows what is being taught in real time and decides *when* a meaningful concept has been fully explained, *what* to ask about it (grounded only in what the lecturer actually said), and *how* the student's answer changes what happens next. Other tools transcribe, summarize, or quiz you after class. This one makes the lecture itself the first study session, and it does so without competing with the lecturer for attention.

## Who It's For
A university student sitting in a live English lecture, in any subject (biology, CS, history, economics, law, …). Today they listen passively for an hour, then spend another hour or more later re-studying the same material from the beginning, which is when understanding, recall, testing, and finding weak spots actually happen.

## The Core Loop
The student opens the app and presses **Start Learning**, then puts their attention back on the lecturer. The app listens in the background, transcribes, and waits. When the lecturer finishes explaining a meaningful, not-yet-tested idea, and enough time has passed since the last interruption, a small **Quick Check** card appears with one multiple-choice question. The student taps an answer and sees "Got it ✓", or a one-line clarification if they missed it. The card disappears, the concept is marked understood or needs-review, and the app goes back to listening. A missed concept may be re-checked later. When the lecture ends, the student presses **End** and sees a mastery summary.

> Listen → understand → wait → find a useful checkpoint → briefly interact → disappear → keep listening.

Why they'd come back: they leave the lecture having already studied part of it, and they know exactly which concepts need review.

## Inspiration & Identity
Calm, quiet, low-attention. It should feel like a background companion, not a dashboard. Mostly idle while listening; checkpoints are small, brief, and dismiss themselves quickly. "The AI should enhance the lecture, not replace it and not distract from it." (Visual details to be set in the PRD.)

## Why This Matters to the Learner
Students lose a lot of time because the lecture is passive and the real studying happens afterwards, from scratch. The learner wants the hour spent in the lecture to count as real active study. They are also using this project to learn how to work effectively with AI coding agents from idea to finished product.

## What "Working" Looks Like
A student opens the web app in a browser, presses **Start Learning**, and a real English lecture plays near the microphone (a live speaker, or a recorded lecture played aloud). The transcript is captured live. After the lecturer finishes explaining a concept, and not every N seconds, a Quick Check MCQ appears that is clearly about what was *just* taught. The student answers and sees immediate feedback, and the card goes away. This repeats a few times, sensibly spaced, over several minutes. Pressing **End** shows a Lecture Mastery summary listing each tested concept as understood ✓ or needs review ⚠.

**The "oh, that's cool" beat:** the lecturer finishes a point, and a few seconds later a question appears that is exactly about that point. It didn't interrupt mid-explanation and it didn't ask about anything not yet taught.

## The POC Boundary
- English only: audio, transcription, questions, explanations, UI, summary.
- Live browser-microphone audio → streaming speech-to-text.
- AI concept-completion detection over a rolling window of recent transcript (has a meaningful concept been finished, is it important, has it already been tested).
- Interruption control: cooldown / minimum spacing, importance threshold, no repeat of already-mastered concepts.
- One interaction type: a single grounded MCQ with known correct answer and a short explanation.
- Simple per-concept understanding state (understood / needs review), with optional re-check of missed concepts.
- End-of-lecture mastery summary.
- Single user, single session, in-browser state only. No database.

## Later
- Arabic and mixed Arabic–English lectures.
- Other interaction types: active-recall (free text), confidence checks, adaptive follow-ups.
- Saving sessions / history; export of the summary for later review.
- Deployment to a public URL (e.g., Vercel), optional for the competition.
- Smarter spaced repetition / adaptive learning model.
- Robustness for noisy classrooms, multiple speakers, far-field microphones.

## Explicitly Cut
- **Login, signup, accounts:** not needed to prove the kernel; single-user is enough.
- **Database / backend infrastructure:** one session in memory is enough to prove the loop.
- **Native iOS/Android apps, app stores:** a browser web app proves the idea faster.
- **Teacher dashboard, admin, classroom/multi-user mode, social/sharing:** different users and problems; the kernel is the individual student's experience.
- **Full note-taking, flashcards, recording library, LMS features:** these are what existing tools already do; adding them blurs the differentiation.
- **Slide uploading:** questions must be grounded in what the lecturer *said*; slides add scope and a second source of truth.
- **Dozens of settings, complex personalization, elaborate adaptive algorithms, complicated analytics:** "do not overengineer"; simple mastery states are enough for the POC.
- **Multilingual support in v1:** would multiply the transcription and prompt surface; English-first proves the idea.
- **Demo video work (for now):** handled separately later, at the learner's request.
