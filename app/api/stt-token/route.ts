// POST /api/stt-token — hands the browser a short-lived Deepgram token.
// The secret API key never leaves the server.

import { grantDeepgramToken } from "@/lib/transcription/grantToken";

export const runtime = "nodejs";

export async function POST() {
  try {
    const token = await grantDeepgramToken(60);
    return Response.json({ token }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[stt-token]", err instanceof Error ? err.message : err);
    return Response.json({ error: "Could not start transcription" }, { status: 502 });
  }
}
