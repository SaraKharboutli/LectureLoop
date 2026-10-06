import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LiveTranscriber, type ConnectionStatus } from "@/lib/transcription/deepgram";

// A minimal fake of the browser WebSocket, so reconnect behavior can be tested without a network.
class FakeSocket {
  static OPEN = 1;
  static instances: FakeSocket[] = [];
  readyState = 0;
  binaryType = "";
  sent: unknown[] = [];
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((e: { data: unknown }) => void) | null = null;
  constructor(
    public url: string,
    public protocols: string[],
  ) {
    FakeSocket.instances.push(this);
  }
  open() {
    this.readyState = FakeSocket.OPEN;
    this.onopen?.();
  }
  receive(msg: object) {
    this.onmessage?.({ data: JSON.stringify(msg) });
  }
  send(data: unknown) {
    this.sent.push(data);
  }
  close() {
    this.readyState = 3;
    this.onclose?.();
  }
}

const flush = () => vi.advanceTimersByTimeAsync(0);

describe("LiveTranscriber", () => {
  let statuses: ConnectionStatus[];
  let finals: string[];
  let fetchOk: boolean;

  beforeEach(() => {
    vi.useFakeTimers();
    FakeSocket.instances = [];
    statuses = [];
    finals = [];
    fetchOk = true;
    vi.stubGlobal("WebSocket", FakeSocket);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => (fetchOk ? { ok: true, json: async () => ({ token: "temp-token" }) } : { ok: false, status: 502 })),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const make = () =>
    new LiveTranscriber(
      48000,
      {
        onInterim: () => {},
        onFinal: (s) => finals.push(s.text),
        onStatus: (s) => statuses.push(s),
      },
      () => 10,
    );

  it("connects with the temporary token and reports finished speech", async () => {
    const t = make();
    t.start();
    await flush();
    const ws = FakeSocket.instances[0];
    expect(ws.protocols).toEqual(["bearer", "temp-token"]);
    expect(ws.url).toContain("sample_rate=48000");
    ws.open();
    ws.receive({ type: "Results", is_final: true, duration: 2, channel: { alternatives: [{ transcript: "Hello there." }] } });
    expect(statuses).toEqual(["connecting", "live"]);
    expect(finals).toEqual(["Hello there."]);
    t.stop();
  });

  it("shows reconnecting after a dropped connection, then recovers with a fresh token", async () => {
    const t = make();
    t.start();
    await flush();
    FakeSocket.instances[0].open();
    FakeSocket.instances[0].close(); // network drop
    expect(statuses.at(-1)).toBe("reconnecting");
    await vi.advanceTimersByTimeAsync(1000);
    expect(FakeSocket.instances).toHaveLength(2);
    FakeSocket.instances[1].open();
    expect(statuses.at(-1)).toBe("live");
    expect(fetch).toHaveBeenCalledTimes(2);
    t.stop();
  });

  it("gives up with an error after repeated failures", async () => {
    fetchOk = false;
    const t = make();
    t.start();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(statuses.at(-1)).toBe("error");
    t.stop();
  });

  it("closes cleanly on End and does not reconnect", async () => {
    const t = make();
    t.start();
    await flush();
    const ws = FakeSocket.instances[0];
    ws.open();
    t.stop();
    expect(ws.sent).toContainEqual(JSON.stringify({ type: "CloseStream" }));
    await vi.advanceTimersByTimeAsync(10_000);
    expect(FakeSocket.instances).toHaveLength(1);
  });
});
