# Test lecture fixtures

**These are test fixtures, not real lectures.** They were written for this project to exercise LectureLoop's checkpoint engine without a microphone. Each one reads like a spoken English lecture (filler, logistics, an anecdote, and several core concepts with clear wrap-ups, plus one concept the lecturer comes back to).

They are used by:
- `npm run replay -- fixtures/lectures/<file>.txt`: replays the text at speaking speed through the real timing rules, prompt, Claude call, and validator.
- `npm run stt-test`: a fixture is turned into speech with Windows text-to-speech and streamed to Deepgram.
- The development-only `?devfeed=<name>` option in the app (`npm run dev` only).

Blank lines mark longer pauses (paragraph breaks).
