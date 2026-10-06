// Server-only: exchanges the secret Deepgram API key for a short-lived token
// the browser can use to open its live transcription connection.

const GRANT_URL = "https://api.deepgram.com/v1/auth/grant";

export async function grantDeepgramToken(ttlSeconds = 60): Promise<string> {
  const key = process.env.DEEPGRAM_API_KEY;
  if (!key) throw new Error("DEEPGRAM_API_KEY is not set");

  const res = await fetch(GRANT_URL, {
    method: "POST",
    headers: { Authorization: `Token ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ ttl_seconds: ttlSeconds }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Deepgram token request failed: ${res.status}`);
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("Deepgram token response had no access_token");
  return data.access_token;
}
