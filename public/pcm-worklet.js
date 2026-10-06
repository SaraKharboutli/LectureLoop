// AudioWorklet: converts microphone audio (Float32) into 16-bit PCM chunks of ~100 ms
// and posts them to the main thread, which streams them to Deepgram.

class PcmWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
    this.chunkSamples = Math.round(sampleRate / 10); // ~100 ms
    this.buffer = new Int16Array(this.chunkSamples);
    this.filled = 0;
  }

  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (!channel) return true;
    for (let i = 0; i < channel.length; i++) {
      const s = Math.max(-1, Math.min(1, channel[i]));
      this.buffer[this.filled++] = s < 0 ? s * 0x8000 : s * 0x7fff;
      if (this.filled === this.chunkSamples) {
        this.port.postMessage(this.buffer.buffer, [this.buffer.buffer]);
        this.buffer = new Int16Array(this.chunkSamples);
        this.filled = 0;
      }
    }
    return true;
  }
}

registerProcessor("pcm-worklet", PcmWorklet);
