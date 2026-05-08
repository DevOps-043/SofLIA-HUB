export class AudioCapture {
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private analyser: AnalyserNode | null = null;
  private onAudioData: ((base64: string) => void) | null = null;

  async start(onAudioData: (base64: string) => void): Promise<void> {
    this.onAudioData = onAudioData;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, sampleRate: 16000, echoCancellation: true, noiseSuppression: true },
      });
      this.audioContext = new AudioContext({ sampleRate: 16000 });
      const source = this.audioContext.createMediaStreamSource(this.stream);
      this.scriptProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);
      this.scriptProcessor.onaudioprocess = (event) => this.emitAudioProcess(event);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      source.connect(this.analyser);
      this.analyser.connect(this.scriptProcessor);
      this.scriptProcessor.connect(this.audioContext.destination);
    } catch (error: any) {
      let errorMessage = 'Error al acceder al micrófono';
      if (error.name === 'NotAllowedError') errorMessage = 'Permiso de micrófono denegado.';
      else if (error.name === 'NotFoundError') errorMessage = 'No se encontró ningún micrófono.';
      throw new Error(errorMessage);
    }
  }

  stop(): void {
    this.scriptProcessor?.disconnect();
    this.analyser?.disconnect();
    this.audioContext?.close();
    this.stream?.getTracks().forEach((track) => track.stop());
    this.scriptProcessor = null;
    this.analyser = null;
    this.audioContext = null;
    this.stream = null;
    this.onAudioData = null;
  }

  getVolumeLevel(): number {
    if (!this.analyser) return 0;
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);
    let sum = 0;
    for (const value of dataArray) sum += value;
    return sum / dataArray.length;
  }

  private emitAudioProcess(event: AudioProcessingEvent): void {
    if (!this.onAudioData) return;
    const inputData = event.inputBuffer.getChannelData(0);
    const pcmData = new Int16Array(inputData.length);
    for (let index = 0; index < inputData.length; index += 1) {
      const sample = Math.max(-1, Math.min(1, inputData[index]));
      pcmData[index] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
    }
    const bytes = new Uint8Array(pcmData.buffer);
    let binary = '';
    for (let index = 0; index < bytes.length; index += 1) {
      binary += String.fromCharCode(bytes[index]);
    }
    this.onAudioData(btoa(binary));
  }
}
