// The Deepgram live-streaming URL, shared by the browser client and the STT test script.
// See spec.md > Live Transcription Client.

export function deepgramListenUrl(sampleRate: number): string {
  const params = new URLSearchParams({
    model: "nova-3",
    language: "en",
    encoding: "linear16",
    sample_rate: String(Math.round(sampleRate)),
    channels: "1",
    interim_results: "true",
    smart_format: "true",
    punctuate: "true",
    // Finalize text after short silences so sentences arrive promptly. (Pauses themselves are not used for timing.)
    endpointing: "400",
  });
  return `wss://api.deepgram.com/v1/listen?${params}`;
}

/** WebSocket subprotocols that carry a temporary (Bearer) token from a browser. */
export function deepgramProtocols(token: string): string[] {
  return ["bearer", token];
}
