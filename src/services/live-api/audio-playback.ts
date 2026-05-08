export class LiveAudioPlayback {
  private audioContext: AudioContext | null = null;
  private audioQueue: AudioBuffer[] = [];
  private nextPlayTime = 0;
  private lastAudioTime = 0;
  private playedBuffersCount = 0;
  private readonly audioResetInterval = 30000;

  reset(): void {
    console.log('Live API: Resetting AudioContext to prevent degradation');
    this.audioContext?.close().catch(() => {});
    this.audioContext = new AudioContext({ sampleRate: 24000 });
    this.nextPlayTime = 0;
    this.playedBuffersCount = 0;
    this.audioQueue = [];
  }

  checkHealth(isDisposed: boolean): void {
    if (isDisposed) return;
    const now = Date.now();
    if (this.lastAudioTime > 0 && now - this.lastAudioTime > this.audioResetInterval) {
      this.playedBuffersCount = 0;
      this.reset();
    }
  }

  playBinary(bytes: Uint8Array, isDisposed: boolean): void {
    if (isDisposed || bytes.length < 100) return;
    let audioBytes = bytes;
    if (bytes.length % 2 !== 0) {
      audioBytes = new Uint8Array(bytes.length + 1);
      audioBytes.set(bytes);
    }
    this.playPcmBytes(audioBytes, isDisposed);
  }

  playBase64(base64Audio: string, isDisposed: boolean): void {
    if (isDisposed) return;
    try {
      const binaryString = atob(base64Audio);
      let bytes = new Uint8Array(binaryString.length);
      for (let index = 0; index < binaryString.length; index += 1) {
        bytes[index] = binaryString.charCodeAt(index);
      }
      if (bytes.length % 2 !== 0) {
        const padded = new Uint8Array(bytes.length + 1);
        padded.set(bytes);
        bytes = padded;
      }
      if (bytes.length >= 100) this.playPcmBytes(bytes, isDisposed);
    } catch (error) {
      console.error('Live API: Audio playback error', error);
    }
  }

  dispose(): void {
    this.audioContext?.close().catch(() => {});
    this.audioContext = null;
    this.audioQueue = [];
    this.nextPlayTime = 0;
    this.playedBuffersCount = 0;
    this.lastAudioTime = 0;
  }

  private playPcmBytes(bytes: Uint8Array, isDisposed: boolean): void {
    if (isDisposed) return;
    try {
      if (!this.audioContext) this.audioContext = new AudioContext({ sampleRate: 24000 });
      const pcmData = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.length / 2);
      const floatData = new Float32Array(pcmData.length);
      for (let index = 0; index < pcmData.length; index += 1) floatData[index] = pcmData[index] / 32768.0;
      const audioBuffer = this.audioContext.createBuffer(1, floatData.length, 24000);
      audioBuffer.copyToChannel(floatData, 0);
      this.audioQueue.push(audioBuffer);
      this.playNextInQueue(isDisposed);
    } catch (error) {
      console.error('Live API: Raw playback error', error);
    }
  }

  private playNextInQueue(isDisposed: boolean): void {
    if (isDisposed || this.audioQueue.length === 0) return this.checkHealth(isDisposed);
    if (!this.audioContext) {
      this.audioContext = new AudioContext({ sampleRate: 24000 });
      this.nextPlayTime = 0;
    }
    this.lastAudioTime = Date.now();
    while (this.audioQueue.length > 0) {
      const source = this.audioContext.createBufferSource();
      source.buffer = this.audioQueue.shift()!;
      source.connect(this.audioContext.destination);
      const startTime = Math.max(this.audioContext.currentTime + 0.01, this.nextPlayTime);
      this.nextPlayTime = startTime + source.buffer.duration;
      source.start(startTime);
      this.playedBuffersCount += 1;
    }
  }
}
