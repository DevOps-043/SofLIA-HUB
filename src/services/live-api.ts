/**
 * Live API Service - WebSocket bidirectional audio with Gemini
 * Desktop version: uses direct getUserMedia (no offscreen document needed)
 */

import { GOOGLE_API_KEY, LIVE_API_URL, MODELS } from '../config';
import { getApiKeyWithCache } from './api-keys';

export interface LiveCallbacks {
  onTextResponse: (text: string) => void;
  onAudioResponse: (audioData: string) => void;
  onError: (error: Error) => void;
  onClose: () => void;
  onReady: () => void;
}

export class LiveClient {
  private ws: WebSocket | null = null;
  private callbacks: LiveCallbacks;
  private isConnected: boolean = false;
  private setupComplete: boolean = false;
  private audioContext: AudioContext | null = null;
  private audioQueue: AudioBuffer[] = [];
  private nextPlayTime: number = 0;
  private lastAudioTime: number = 0;
  private audioResetInterval: number = 30000;
  private sessionStartTime: number = 0;
  private maxSessionDuration: number = 14 * 60 * 1000;
  private sessionCheckInterval: ReturnType<typeof setInterval> | null = null;
  private playedBuffersCount: number = 0;

  constructor(callbacks: LiveCallbacks) {
    this.callbacks = callbacks;
  }

  private resetAudioContext() {
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
    }
    this.audioContext = new AudioContext({ sampleRate: 24000 });
    this.nextPlayTime = 0;
    this.playedBuffersCount = 0;
  }

  private checkAudioContextHealth() {
    const now = Date.now();
    if (this.lastAudioTime > 0 && (now - this.lastAudioTime) > this.audioResetInterval) {
      this.playedBuffersCount = 0;
      this.resetAudioContext();
    }
  }

  private startSessionCheck() {
    if (this.sessionCheckInterval) clearInterval(this.sessionCheckInterval);
    this.sessionCheckInterval = setInterval(() => {
      const elapsed = Date.now() - this.sessionStartTime;
      if (elapsed >= this.maxSessionDuration) {
        this.autoReconnect();
      }
    }, 30000);
  }

  private async autoReconnect() {
    if (this.sessionCheckInterval) {
      clearInterval(this.sessionCheckInterval);
      this.sessionCheckInterval = null;
    }
    if (this.ws) { this.ws.close(); this.ws = null; }
    await new Promise(resolve => setTimeout(resolve, 500));
    try {
      await this.connect();
    } catch (error) {
      this.callbacks.onError(new Error('Reconexión automática fallida'));
    }
  }

  async connect(): Promise<void> {
    let apiKey = await getApiKeyWithCache('google');
    if (!apiKey) apiKey = GOOGLE_API_KEY;

    return new Promise((resolve, reject) => {
      try {
        if (!apiKey) { reject(new Error('API key de Google no configurada')); return; }
        if (!LIVE_API_URL) { reject(new Error('URL de Live API no configurada')); return; }

        const url = `${LIVE_API_URL}?key=${apiKey}`;
        this.ws = new WebSocket(url);

        const timeout = setTimeout(() => {
          if (!this.isConnected) { this.ws?.close(); reject(new Error('Tiempo de conexión agotado')); }
        }, 15000);

        this.ws.onopen = () => {
          clearTimeout(timeout);
          this.isConnected = true;
          this.sessionStartTime = Date.now();
          this.startSessionCheck();

          const setupMessage: any = {
            setup: {
              model: `models/${MODELS.LIVE}`,
              generationConfig: {
                responseModalities: ['AUDIO'],
                speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: 'Aoede' }
                  }
                }
              },
              systemInstruction: {
                parts: [{
                  text: 'Eres Lia, una asistente de productividad amigable y eficiente. Responde siempre en español de forma concisa y útil. Cuando el usuario pregunte sobre información actual, noticias, clima, eventos recientes o cualquier dato que requiera información actualizada, usa la herramienta de búsqueda de Google para obtener información precisa y actual.'
                }]
              },
              tools: [{ googleSearch: {} }]
            }
          };

          this.send(setupMessage);
        };

        this.ws.onmessage = async (event) => {
          try {
            let data: any;
            if (event.data instanceof Blob) {
              const text = await event.data.text();
              try { data = JSON.parse(text); } catch {
                const arrayBuffer = await event.data.arrayBuffer();
                this.handleBinaryAudio(new Uint8Array(arrayBuffer));
                return;
              }
            } else {
              data = JSON.parse(event.data);
            }

            if (data.setupComplete) {
              this.setupComplete = true;
              this.callbacks.onReady();
              resolve();
              return;
            }

            if (data.error) {
              const errorMessage = data.error.message || 'Error del servidor';
              this.callbacks.onError(new Error(errorMessage));
              return;
            }

            if (data.serverContent) {
              this.processServerContent(data.serverContent);
            }
          } catch (e) {
            console.error('Live API: Message processing error', e);
          }
        };

        this.ws.onerror = () => {
          clearTimeout(timeout);
          this.isConnected = false;
          const msg = !navigator.onLine ? 'Sin conexión a internet' : 'Error de conexión WebSocket';
          this.callbacks.onError(new Error(msg));
          reject(new Error(msg));
        };

        this.ws.onclose = (event) => {
          this.isConnected = false;
          this.setupComplete = false;
          let closeReason = event.reason || '';
          if (event.code === 1006) closeReason = 'Conexión cerrada inesperadamente.';
          else if (event.code === 1008) closeReason = 'API key sin acceso a Live API.';
          if (closeReason) this.callbacks.onError(new Error(closeReason));
          this.callbacks.onClose();
        };

        setTimeout(() => {
          if (this.isConnected && !this.setupComplete) {
            this.setupComplete = true;
            this.callbacks.onReady();
            resolve();
          }
        }, 3000);

      } catch (error) {
        reject(error);
      }
    });
  }

  private processServerContent(content: any) {
    if (!content.modelTurn?.parts) return;
    for (const part of content.modelTurn.parts) {
      if (part.text) this.callbacks.onTextResponse(part.text);
      if (part.inlineData?.data) {
        this.callbacks.onAudioResponse(part.inlineData.data);
        this.playAudio(part.inlineData.data);
      }
    }
  }

  private handleBinaryAudio(bytes: Uint8Array) {
    if (bytes.length < 100) return;
    let audioBytes = bytes;
    if (bytes.length % 2 !== 0) {
      audioBytes = new Uint8Array(bytes.length + 1);
      audioBytes.set(bytes);
    }
    this.playRawAudio(audioBytes);
  }

  private async playRawAudio(bytes: Uint8Array) {
    try {
      if (!this.audioContext) this.audioContext = new AudioContext({ sampleRate: 24000 });
      const pcmData = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.length / 2);
      const floatData = new Float32Array(pcmData.length);
      for (let i = 0; i < pcmData.length; i++) floatData[i] = pcmData[i] / 32768.0;
      const audioBuffer = this.audioContext.createBuffer(1, floatData.length, 24000);
      audioBuffer.copyToChannel(floatData, 0);
      this.audioQueue.push(audioBuffer);
      this.playNextInQueue();
    } catch (e) {
      console.error('Live API: Raw audio playback error', e);
    }
  }

  private async playAudio(base64Audio: string) {
    try {
      if (!this.audioContext) this.audioContext = new AudioContext({ sampleRate: 24000 });
      const binaryString = atob(base64Audio);
      let bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
      if (bytes.length % 2 !== 0) {
        const padded = new Uint8Array(bytes.length + 1);
        padded.set(bytes);
        bytes = padded;
      }
      if (bytes.length < 100) return;
      const pcmData = new Int16Array(bytes.buffer);
      const floatData = new Float32Array(pcmData.length);
      for (let i = 0; i < pcmData.length; i++) floatData[i] = pcmData[i] / 32768.0;
      const audioBuffer = this.audioContext.createBuffer(1, floatData.length, 24000);
      audioBuffer.copyToChannel(floatData, 0);
      this.audioQueue.push(audioBuffer);
      this.playNextInQueue();
    } catch (e) {
      console.error('Live API: Audio playback error', e);
    }
  }

  private playNextInQueue() {
    if (this.audioQueue.length === 0) { this.checkAudioContextHealth(); return; }
    if (!this.audioContext) { this.audioContext = new AudioContext({ sampleRate: 24000 }); this.nextPlayTime = 0; }
    this.lastAudioTime = Date.now();
    while (this.audioQueue.length > 0) {
      const buffer = this.audioQueue.shift()!;
      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(this.audioContext.destination);
      const currentTime = this.audioContext.currentTime;
      const startTime = Math.max(currentTime + 0.01, this.nextPlayTime);
      this.nextPlayTime = startTime + buffer.duration;
      source.start(startTime);
      this.playedBuffersCount++;
    }
  }

  send(data: any) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(data));
  }

  sendAudioChunk(base64Audio: string) {
    if (!this.isReady()) return;
    this.send({
      realtimeInput: {
        audio: { data: base64Audio, mimeType: 'audio/pcm;rate=16000' }
      }
    });
  }

  sendText(text: string) {
    if (!this.isReady()) return;
    this.send({
      clientContent: {
        turns: [{ role: 'user', parts: [{ text }] }],
        turnComplete: true
      }
    });
  }

  isReady(): boolean {
    return this.isConnected && this.ws?.readyState === WebSocket.OPEN && this.setupComplete;
  }

  disconnect() {
    this.isConnected = false;
    this.setupComplete = false;
    if (this.sessionCheckInterval) { clearInterval(this.sessionCheckInterval); this.sessionCheckInterval = null; }
    if (this.audioContext) { this.audioContext.close(); this.audioContext = null; }
    this.audioQueue = [];
    this.nextPlayTime = 0;
    this.playedBuffersCount = 0;
    this.lastAudioTime = 0;
    if (this.ws) { this.ws.close(); this.ws = null; }
  }
}

/**
 * Desktop AudioCapture - uses direct getUserMedia (no offscreen document needed in Electron)
 */
export class AudioCapture {
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private onAudioData: ((base64: string) => void) | null = null;

  async start(onAudioData: (base64: string) => void): Promise<void> {
    this.onAudioData = onAudioData;

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, sampleRate: 16000, echoCancellation: true, noiseSuppression: true }
      });

      this.audioContext = new AudioContext({ sampleRate: 16000 });
      const source = this.audioContext.createMediaStreamSource(this.stream);

      // Use ScriptProcessorNode for audio chunk processing (4096 samples per chunk)
      this.scriptProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);
      this.scriptProcessor.onaudioprocess = (event) => {
        if (!this.onAudioData) return;
        const inputData = event.inputBuffer.getChannelData(0);

        // Convert Float32 to Int16 PCM
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        // Convert to base64
        const bytes = new Uint8Array(pcmData.buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);

        this.onAudioData(base64);
      };

      source.connect(this.scriptProcessor);
      this.scriptProcessor.connect(this.audioContext.destination);

    } catch (e: any) {
      let errorMessage = 'Error al acceder al micrófono';
      if (e.name === 'NotAllowedError') errorMessage = 'Permiso de micrófono denegado.';
      else if (e.name === 'NotFoundError') errorMessage = 'No se encontró ningún micrófono.';
      throw new Error(errorMessage);
    }
  }

  stop() {
    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
      this.scriptProcessor = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    this.onAudioData = null;
  }
}
