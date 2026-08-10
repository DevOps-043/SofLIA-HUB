// Reproduce tanto chunks PCM16 del sidecar como MP3 de ElevenLabs.
// Encola por frase (gapless) y expone un AudioNode para que la orbe analice
// la señal (meyda) y anime el "habla" estilo Jarvis.

export class OrbTtsPlayback {
  private ctx: AudioContext | null = null;
  private output: GainNode | null = null;
  private nextStartTime = 0;
  private activeSources = new Set<AudioBufferSourceNode>();
  private onDrained: (() => void) | null = null;
  private ttsFinished = false;
  private generation = 0;

  /** Nodo de salida (post-mezcla) para conectar analizadores de audio. */
  getOutputNode(): AudioNode | null {
    this.ensureContext();
    return this.output;
  }

  getContext(): AudioContext | null {
    return this.ctx;
  }

  isPlaying(): boolean {
    return this.activeSources.size > 0;
  }

  /** Callback cuando termina de sonar el último chunk tras el fin del TTS. */
  setOnDrained(cb: (() => void) | null): void {
    this.onDrained = cb;
  }

  /** Marca que el sidecar terminó de sintetizar (tts_end). */
  markTtsFinished(): void {
    this.ttsFinished = true;
    if (this.activeSources.size === 0) this.notifyDrained();
  }

  enqueueChunk(audioBase64: string, sampleRate: number): void {
    this.enqueuePcm(base64ToInt16(audioBase64), sampleRate);
  }

  enqueuePcm(pcm: Int16Array, sampleRate: number): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.output) return;
    this.ttsFinished = false;

    if (pcm.length === 0) return;
    const buffer = ctx.createBuffer(1, pcm.length, sampleRate);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < pcm.length; i++) channel[i] = pcm[i] / 32768;

    this.enqueueBuffer(buffer);
  }

  /** Decodifica un bloque MP3 de ElevenLabs y lo agrega a la cola gapless. */
  async enqueueEncoded(audioBase64: string): Promise<void> {
    const ctx = this.ensureContext();
    if (!ctx || !this.output) return;
    const generation = this.generation;
    const encoded = base64ToArrayBuffer(audioBase64);
    if (!encoded.byteLength) throw new Error('ElevenLabs devolvió un audio vacío.');
    let buffer: AudioBuffer;
    try {
      buffer = await ctx.decodeAudioData(encoded);
    } catch {
      throw new Error('No se pudo decodificar el audio de ElevenLabs.');
    }
    if (generation !== this.generation) return;
    this.ttsFinished = false;
    this.enqueueBuffer(buffer);
  }

  private enqueueBuffer(buffer: AudioBuffer): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.output || buffer.length === 0) return;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.output);
    const startAt = Math.max(ctx.currentTime + 0.02, this.nextStartTime);
    source.start(startAt);
    this.nextStartTime = startAt + buffer.duration;
    this.activeSources.add(source);
    source.onended = () => {
      this.activeSources.delete(source);
      if (this.ttsFinished && this.activeSources.size === 0) this.notifyDrained();
    };
  }

  stop(): void {
    this.generation += 1;
    for (const source of this.activeSources) {
      try { source.stop(); } catch { /* ya detenido */ }
    }
    this.activeSources.clear();
    this.nextStartTime = 0;
    this.ttsFinished = false;
    this.onDrained = null;
  }

  dispose(): void {
    this.stop();
    this.onDrained = null;
    void this.ctx?.close().catch(() => undefined);
    this.ctx = null;
    this.output = null;
  }

  private notifyDrained(): void {
    this.ttsFinished = false;
    const callback = this.onDrained;
    this.onDrained = null;
    callback?.();
  }

  private ensureContext(): AudioContext | null {
    if (!this.ctx) {
      // Contexto a la tasa NATIVA del dispositivo: cada AudioBuffer conserva su
      // propia sample rate (Piper o ElevenLabs) y WebAudio remuestrea
      // UNA sola vez con alta calidad. Forzar la tasa degradaba los agudos.
      this.ctx = new AudioContext();
      this.output = this.ctx.createGain();
      this.output.gain.value = 1;
      this.output.connect(this.ctx.destination);
      this.nextStartTime = 0;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => undefined);
    return this.ctx;
  }
}

function base64ToInt16(base64: string): Int16Array {
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Int16Array(bytes.buffer, 0, Math.floor(bytes.length / 2));
  } catch {
    return new Int16Array(0);
  }
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  } catch {
    return new ArrayBuffer(0);
  }
}
