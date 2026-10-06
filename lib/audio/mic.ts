// Browser microphone → 16-bit PCM chunks (~100 ms each).
// Call from a user tap: the AudioContext is created before the first await,
// because iOS only lets audio start inside a user gesture.
// See spec.md > Mic Capture.

export class MicPermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MicPermissionError";
  }
}

export type MicCapture = { sampleRate: number; stop: () => void };

export async function startMic(onChunk: (pcm: ArrayBuffer) => void): Promise<MicCapture> {
  if (!navigator.mediaDevices?.getUserMedia || typeof AudioContext === "undefined") {
    throw new MicPermissionError(
      "This browser can't use the microphone here. Open LectureLoop over https (or on localhost) in a recent browser.",
    );
  }

  const ctx = new AudioContext();
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
  } catch (err) {
    void ctx.close();
    const name = err instanceof DOMException ? err.name : "";
    throw new MicPermissionError(
      name === "NotFoundError"
        ? "No microphone was found on this device."
        : "Microphone access was blocked. LectureLoop needs the microphone to hear the lecture.",
    );
  }

  await ctx.resume();
  await ctx.audioWorklet.addModule("/pcm-worklet.js");
  const source = ctx.createMediaStreamSource(stream);
  const node = new AudioWorkletNode(ctx, "pcm-worklet");
  node.port.onmessage = (e: MessageEvent<ArrayBuffer>) => onChunk(e.data);
  source.connect(node);
  // Keep the audio graph running without playing the mic back through the speakers.
  const mute = ctx.createGain();
  mute.gain.value = 0;
  node.connect(mute).connect(ctx.destination);

  return {
    sampleRate: ctx.sampleRate,
    stop: () => {
      node.port.onmessage = null;
      source.disconnect();
      node.disconnect();
      stream.getTracks().forEach((t) => t.stop());
      void ctx.close();
    },
  };
}
