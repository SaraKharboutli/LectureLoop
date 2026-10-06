// Browser-side live transcription over a Deepgram WebSocket.
// Gets a temporary token from our server, streams PCM audio, and reports
// in-progress words, finished segments, and connection status.
// See spec.md > Live Transcription Client.

import { deepgramListenUrl, deepgramProtocols } from "./deepgramUrl";

export type ConnectionStatus = "connecting" | "live" | "reconnecting" | "error";

export type TranscriberEvents = {
  onInterim: (text: string) => void;
  /** A finished piece of speech. Times come from `clock()` (session seconds). */
  onFinal: (segment: { text: string; start: number; end: number }) => void;
  onStatus: (status: ConnectionStatus) => void;
};

const KEEPALIVE_MS = 8000;
const BACKOFF_MS = [1000, 2000, 4000, 8000, 8000];

export class LiveTranscriber {
  private ws: WebSocket | null = null;
  private keepAlive: ReturnType<typeof setInterval> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private attempts = 0;
  private stopped = false;

  constructor(
    private readonly sampleRate: number,
    private readonly events: TranscriberEvents,
    private readonly clock: () => number,
  ) {}

  start(): void {
    this.stopped = false;
    this.events.onStatus("connecting");
    void this.connect();
  }

  sendAudio(pcm: ArrayBuffer): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(pcm);
  }

  stop(): void {
    this.stopped = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.clearKeepAlive();
    const ws = this.ws;
    this.ws = null;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "CloseStream" }));
      setTimeout(() => ws.close(), 500);
    } else {
      ws?.close();
    }
  }

  /** Test hook: simulate a dropped connection. */
  dropConnectionForTesting(): void {
    this.ws?.close();
  }

  private async connect(): Promise<void> {
    let token: string;
    try {
      const res = await fetch("/api/stt-token", { method: "POST" });
      if (!res.ok) throw new Error(`token ${res.status}`);
      token = ((await res.json()) as { token: string }).token;
    } catch {
      this.scheduleReconnect();
      return;
    }
    if (this.stopped) return;

    const ws = new WebSocket(deepgramListenUrl(this.sampleRate), deepgramProtocols(token));
    ws.binaryType = "arraybuffer";
    this.ws = ws;

    ws.onopen = () => {
      this.attempts = 0;
      this.events.onStatus("live");
      this.clearKeepAlive();
      this.keepAlive = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "KeepAlive" }));
      }, KEEPALIVE_MS);
    };

    ws.onmessage = (e) => {
      if (typeof e.data !== "string") return;
      const msg = JSON.parse(e.data);
      if (msg.type === "Results") {
        const text: string = msg.channel?.alternatives?.[0]?.transcript ?? "";
        if (msg.is_final) {
          if (text.trim()) {
            const end = this.clock();
            this.events.onFinal({ text: text.trim(), start: Math.max(0, end - (msg.duration ?? 0)), end });
          }
          this.events.onInterim("");
        } else {
          this.events.onInterim(text);
        }
      }
    };

    ws.onclose = () => {
      this.clearKeepAlive();
      if (this.ws === ws) this.ws = null;
      if (!this.stopped) this.scheduleReconnect();
    };
  }

  private scheduleReconnect(): void {
    if (this.stopped) return;
    if (this.attempts >= BACKOFF_MS.length) {
      this.events.onStatus("error");
      return;
    }
    this.events.onStatus("reconnecting");
    const delay = BACKOFF_MS[this.attempts++];
    this.retryTimer = setTimeout(() => void this.connect(), delay);
  }

  private clearKeepAlive(): void {
    if (this.keepAlive) clearInterval(this.keepAlive);
    this.keepAlive = null;
  }
}
