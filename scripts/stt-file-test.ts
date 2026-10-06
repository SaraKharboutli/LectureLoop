// DEV TOOL: proves live transcription works end to end without a microphone.
// 1) gets a temporary Deepgram token exactly like /api/stt-token does,
// 2) opens the live WebSocket with the same URL + subprotocol auth as the browser,
// 3) streams a 16-bit mono WAV at real-time pace and prints what comes back.
//
//   npm run stt-test -- tmp/speech.wav

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local", quiet: true });

import { readFileSync } from "node:fs";
import WebSocket from "ws";
import { grantDeepgramToken } from "@/lib/transcription/grantToken";
import { deepgramListenUrl, deepgramProtocols } from "@/lib/transcription/deepgramUrl";

function readWav(path: string): { pcm: Buffer; sampleRate: number } {
  const buf = readFileSync(path);
  if (buf.toString("ascii", 0, 4) !== "RIFF") throw new Error("Not a WAV file");
  let offset = 12;
  let sampleRate = 16000;
  while (offset < buf.length) {
    const id = buf.toString("ascii", offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    if (id === "fmt ") {
      const channels = buf.readUInt16LE(offset + 10);
      sampleRate = buf.readUInt32LE(offset + 12);
      const bits = buf.readUInt16LE(offset + 22);
      if (channels !== 1 || bits !== 16) throw new Error(`Need 16-bit mono WAV (got ${channels}ch ${bits}bit)`);
    }
    if (id === "data") return { pcm: buf.subarray(offset + 8, offset + 8 + size), sampleRate };
    offset += 8 + size + (size % 2);
  }
  throw new Error("WAV has no data chunk");
}

async function main() {
  const file = process.argv[2] ?? "tmp/speech.wav";
  const { pcm, sampleRate } = readWav(file);
  // --direct-key skips the temporary token (Node-only diagnostic; the browser never sees the key).
  const direct = process.argv.includes("--direct-key");
  const protocols = direct
    ? ["token", process.env.DEEPGRAM_API_KEY ?? ""]
    : deepgramProtocols(await grantDeepgramToken(60));
  console.log(`${direct ? "direct key" : "token ok"} · ${sampleRate} Hz · ${(pcm.length / 2 / sampleRate).toFixed(1)}s of audio`);

  const ws = new WebSocket(deepgramListenUrl(sampleRate), protocols);
  const finals: string[] = [];
  let pauses = 0;

  ws.on("message", (data) => {
    const msg = JSON.parse(data.toString());
    if (msg.type === "Results") {
      const text: string = msg.channel?.alternatives?.[0]?.transcript ?? "";
      if (msg.is_final && text) {
        finals.push(text);
        console.log(`final [${msg.start.toFixed(1)}s]${msg.speech_final ? " (pause)" : ""}: ${text}`);
      }
      if (msg.speech_final) pauses++;
    } else if (msg.type === "UtteranceEnd") {
      pauses++;
      console.log(`  · UtteranceEnd at ${msg.last_word_end}s`);
    }
  });

  await new Promise<void>((resolve, reject) => {
    ws.once("open", () => resolve());
    ws.once("error", reject);
    ws.once("unexpected-response", (_req, res) => reject(new Error(`WebSocket rejected: HTTP ${res.statusCode}`)));
  });
  console.log(direct ? "websocket open (direct key)" : "websocket open (temporary token accepted)");

  const chunkBytes = Math.round(sampleRate * 0.1) * 2; // 100 ms
  for (let i = 0; i < pcm.length; i += chunkBytes) {
    ws.send(pcm.subarray(i, i + chunkBytes));
    await new Promise((r) => setTimeout(r, 100));
  }
  ws.send(JSON.stringify({ type: "CloseStream" }));
  await new Promise((r) => ws.once("close", r));

  console.log(`\nDone · ${finals.length} final segments · ${pauses} pause signals`);
  console.log(`Transcript: ${finals.join(" ")}`);
  if (finals.length === 0) process.exit(1);
}

main().catch((err) => {
  console.error("STT test failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
