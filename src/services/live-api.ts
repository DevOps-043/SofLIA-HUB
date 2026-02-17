/**
 * Live API Service - WebSocket bidirectional audio with Gemini
 * Desktop version: uses direct getUserMedia (no offscreen document needed)
 * Synchronized with Extension version for feature parity
 */

import { GOOGLE_API_KEY, LIVE_API_URL, MODELS } from '../config';
import { getApiKeyWithCache } from './api-keys';

export interface LiveCallbacks {
  onTextResponse: (text: string) => void;
  onAudioResponse: (audioData: string) => void;  // base64 PCM audio
  onError: (error: Error) => void;
  onClose: () => void;
  onReady: () => void;
  onGroundingMetadata?: (metadata: any) => void;
  onFunctionCall?: (functionCall: { name: string; args: any }) => Promise<string>; // Execute function and return result
}

export class LiveClient {
  private ws: WebSocket | null = null;
  private callbacks: LiveCallbacks;
  private isConnected: boolean = false;
  private isConnecting: boolean = false; // Prevent concurrent connection attempts
  private setupComplete: boolean = false;
  private audioContext: AudioContext | null = null;
  private audioQueue: AudioBuffer[] = [];
  private nextPlayTime: number = 0;  // For seamless audio scheduling
  private lastAudioTime: number = 0;  // Track last audio playback
  private audioResetInterval: number = 30000;  // Reset audio context every 30 seconds of silence
  private sessionStartTime: number = 0;  // Track session start for 15-min limit
  private maxSessionDuration: number = 14 * 60 * 1000;  // 14 minutes (before 15-min limit)
  private sessionCheckInterval: ReturnType<typeof setInterval> | null = null;
  private playedBuffersCount: number = 0;  // Track buffers to reset periodically
  private retriedWithoutTools: boolean = false;  // Track if we already retried without tools
  private isDisposed: boolean = false; // Track if the client was explicitly disconnected

  constructor(callbacks: LiveCallbacks) {
    this.callbacks = callbacks;
  }

  // Reset audio context to prevent degradation
  private resetAudioContext() {
    console.log("Live API: Resetting AudioContext to prevent degradation");
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
    }
    this.audioContext = new AudioContext({ sampleRate: 24000 });
    this.nextPlayTime = 0;
    this.playedBuffersCount = 0;
    this.audioQueue = []; // Clear queue on reset
  }

  // Check if audio context needs reset (only during silence, never during active speech)
  private checkAudioContextHealth() {
    if (this.isDisposed) return;
    const now = Date.now();
    // Only reset if there's been significant silence
    if (this.lastAudioTime > 0 && (now - this.lastAudioTime) > this.audioResetInterval) {
      this.playedBuffersCount = 0;
      this.resetAudioContext();
    }
  }

  // Start session timeout checking
  private startSessionCheck() {
    if (this.sessionCheckInterval) clearInterval(this.sessionCheckInterval);
    this.sessionCheckInterval = setInterval(() => {
      if (this.isDisposed) return;
      const elapsed = Date.now() - this.sessionStartTime;
      if (elapsed >= this.maxSessionDuration) {
        console.log("Live API: Approaching 15-min session limit, auto-reconnecting...");
        this.autoReconnect();
      }
    }, 30000);
  }

  // Auto-reconnect to avoid session timeout
  private async autoReconnect() {
    if (this.isDisposed) return;
    this.disconnect(true); // Soft disconnect for reconnect
    await new Promise(resolve => setTimeout(resolve, 500));
    try {
      this.isDisposed = false; // Allow reconnection
      await this.connect();
      console.log("Live API: Auto-reconnect successful");
    } catch (error) {
      console.error("Live API: Auto-reconnect failed", error);
      this.callbacks.onError(new Error("Reconexión automática fallida. Reintenta manualmente."));
    }
  }

  async connect(): Promise<void> {
    if (this.isConnected || this.isConnecting) return;
    this.isConnecting = true;
    this.isDisposed = false;
    
    let apiKey = await getApiKeyWithCache('google');
    if (!apiKey) apiKey = GOOGLE_API_KEY;

    return new Promise((resolve, reject) => {
      try {
        if (!apiKey) {
          this.isConnecting = false;
          reject(new Error('API key de Google no configurada.'));
          return;
        }
        if (!LIVE_API_URL) {
          this.isConnecting = false;
          reject(new Error('URL de Live API no configurada.'));
          return;
        }

        const url = `${LIVE_API_URL}?key=${apiKey}`;
        console.log("Live API: Connecting to:", MODELS.LIVE);
        
        if (this.ws) this.ws.close();
        this.ws = new WebSocket(url);

        const timeout = setTimeout(() => {
          if (!this.isConnected) {
            this.ws?.close();
            reject(new Error('Tiempo de conexión agotado'));
          }
        }, 15000);

        this.ws.onopen = () => {
          clearTimeout(timeout);
          this.isConnected = true;
          this.isConnecting = false;
          this.sessionStartTime = Date.now();
          this.startSessionCheck();

          // Build tools array
          const tools: any[] = [];
          if (!this.retriedWithoutTools) {
            tools.push({ googleSearch: {} });
          }

          const setupMessage: any = {
            setup: {
              model: `models/${MODELS.LIVE}`,
              generationConfig: {
                responseModalities: ["AUDIO"],
                speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: "Aoede" }
                  }
                }
              },
              systemInstruction: {
                parts: [{
                  text: `Eres Lia, la asistente de productividad e investigación de SofLIA Hub. 

REGLAS OBLIGATORIAS:
1. Responde SIEMPRE en ESPAÑOL. No uses inglés incluso si el usuario lo hace.
2. Formato de respuesta PLANO:
   USER_QUERY: [Resumen]
   SOFLIA_RESPONSE: [Respuesta extensa en párrafos continuos]
3. PROHIBIDO: No uses negritas (**), no uses encabezados (#), no uses listas.
4. PROHIBIDO: No devuelvas tu plan de respuesta o pensamientos internos. Solo el resultado final.
5. Usa Google Search si es necesario información actualizada.`
                }]
              }
            }
          };

          if (tools.length > 0) {
            setupMessage.setup.tools = tools;
          }

          this.send(setupMessage);
        };

        this.ws.onmessage = async (event) => {
          if (this.isDisposed) return;
          try {
            let data: any;
            if (event.data instanceof Blob) {
              const text = await event.data.text();
              try {
                data = JSON.parse(text);
              } catch {
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
              console.error("Live API Error:", data.error);
              this.callbacks.onError(new Error(data.error.message || 'Error de servidor'));
              return;
            }

            if (data.serverContent) {
              this.processServerContent(data.serverContent);
            }
          } catch (e) {
            console.error("Live API Message processing error", e);
          }
        };

        this.ws.onerror = (ev) => {
          clearTimeout(timeout);
          this.isConnected = false;
          this.isConnecting = false;
          const msg = !navigator.onLine ? 'Sin conexión a internet' : 'Error de conexión WebSocket';
          console.error("Live API: WebSocket error", ev);
          if (!this.isDisposed) {
            this.callbacks.onError(new Error(msg));
          }
          reject(new Error(msg));
        };

        this.ws.onclose = (event) => {
          const wasSetupComplete = this.setupComplete;
          this.isConnected = false;
          this.isConnecting = false;
          this.setupComplete = false;

          if (this.isDisposed) return; // Ignore expected close

          const reason = (event.reason || '').toLowerCase();
          if (!wasSetupComplete && !this.retriedWithoutTools && (reason.includes('invalid') || reason.includes('argument'))) {
            this.retriedWithoutTools = true;
            this.connect().then(resolve).catch(reject);
            return;
          }

          let closeReason = event.reason || '';
          if (event.code === 1006) closeReason = 'Conexión cerrada inesperadamente.';
          else if (event.code === 1008) closeReason = 'API key sin acceso a Live API.';
          
          if (closeReason && !wasSetupComplete) {
            this.callbacks.onError(new Error(closeReason));
          }
          this.callbacks.onClose();
        };

        setTimeout(() => {
          if (this.isConnected && !this.setupComplete) {
            this.setupComplete = true;
            this.callbacks.onReady();
            this.isConnecting = false;
            resolve();
          }
        }, 3000);

      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  private async processServerContent(content: any) {
    if (this.isDisposed || !content.modelTurn?.parts) return;
    console.log("Live API: Received server content parts:", content.modelTurn.parts.length);
    
    for (const part of content.modelTurn.parts) {
      if (part.text) {
        console.log("Live API: Text response received:", part.text.substring(0, 50) + "...");
        this.callbacks.onTextResponse(part.text);
      }
      if (part.inlineData?.data) {
        this.callbacks.onAudioResponse(part.inlineData.data);
        this.playAudio(part.inlineData.data);
      }
      if (part.functionCall) {
        console.log("Live API: Tool call received:", part.functionCall.name);
        await this.handleFunctionCall(part.functionCall);
      }
    }

    // Extract grounding metadata if available in serverContent
    if (content.modelTurn?.groundingMetadata) {
      console.log("Live API: Grounding metadata received");
      this.callbacks.onGroundingMetadata?.(content.modelTurn.groundingMetadata);
    }
  }

  private async handleFunctionCall(functionCall: { name: string; args: any }) {
    if (this.isDisposed || !this.callbacks.onFunctionCall) return;
    try {
      const result = await this.callbacks.onFunctionCall(functionCall);
      this.send({
        toolResponse: {
          functionResponses: [{
            name: functionCall.name,
            response: { result }
          }]
        }
      });
    } catch (error: any) {
      this.send({
        toolResponse: {
          functionResponses: [{
            name: functionCall.name,
            response: { error: error.message || "Failed" }
          }]
        }
      });
    }
  }

  private handleBinaryAudio(bytes: Uint8Array) {
    if (this.isDisposed || bytes.length < 100) return;
    let audioBytes = bytes;
    if (bytes.length % 2 !== 0) {
      audioBytes = new Uint8Array(bytes.length + 1);
      audioBytes.set(bytes);
    }
    this.playRawAudio(audioBytes);
  }

  private async playRawAudio(bytes: Uint8Array) {
    if (this.isDisposed) return;
    try {
      if (!this.audioContext) this.audioContext = new AudioContext({ sampleRate: 24000 });
      const pcmData = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.length / 2);
      const floatData = new Float32Array(pcmData.length);
      for (let i = 0; i < pcmData.length; i++) floatData[i] = pcmData[i] / 32768.0;
      const audioBuffer = this.audioContext.createBuffer(1, floatData.length, 24000);
      audioBuffer.copyToChannel(floatData, 0);
      this.audioQueue.push(audioBuffer);
      this.playNextInQueue();
    } catch (e) { console.error("Live API: Raw playback error", e); }
  }

  private async playAudio(base64Audio: string) {
    if (this.isDisposed) return;
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
    } catch (e) { console.error("Live API: Audio playback error", e); }
  }

  private playNextInQueue() {
    if (this.isDisposed || this.audioQueue.length === 0) { this.checkAudioContextHealth(); return; }
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
    if (!this.isDisposed && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  sendAudioChunk(base64Audio: string) {
    if (this.isDisposed || !this.isReady()) return;
    this.send({
      realtimeInput: {
        audio: {
          data: base64Audio,
          mimeType: "audio/pcm;rate=16000"
        }
      }
    });
  }

  sendText(text: string) {
    if (this.isDisposed || !this.isReady()) return;
    this.send({
      clientContent: {
        turns: [{ role: "user", parts: [{ text }] }],
        turnComplete: true
      }
    });
  }

  endAudioTurn() {
    if (this.isDisposed || !this.isReady()) return;
    this.send({ clientContent: { turnComplete: true } });
  }

  isReady(): boolean {
    return !this.isDisposed && this.isConnected && this.ws?.readyState === WebSocket.OPEN && this.setupComplete;
  }

  disconnect(soft: boolean = false) {
    console.log(`Live API: Disconnecting (soft: ${soft})...`);
    if (!soft) this.isDisposed = true;
    
    this.isConnected = false;
    this.isConnecting = false;
    this.setupComplete = false;
    this.retriedWithoutTools = false;

    if (this.sessionCheckInterval) {
      clearInterval(this.sessionCheckInterval);
      this.sessionCheckInterval = null;
    }

    if (this.audioContext) {
      try {
        this.audioContext.close();
      } catch (e) {}
      this.audioContext = null;
    }

    this.audioQueue = [];
    this.nextPlayTime = 0;
    this.playedBuffersCount = 0;
    this.lastAudioTime = 0;

    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {}
      this.ws = null;
    }
  }
}

/**
 * Desktop AudioCapture - uses direct getUserMedia (no offscreen document needed in Electron)
 */
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
        audio: { channelCount: 1, sampleRate: 16000, echoCancellation: true, noiseSuppression: true }
      });

      this.audioContext = new AudioContext({ sampleRate: 16000 });
      const source = this.audioContext.createMediaStreamSource(this.stream);

      this.scriptProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);
      this.scriptProcessor.onaudioprocess = (event) => {
        if (!this.onAudioData) return;
        const inputData = event.inputBuffer.getChannelData(0);

        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        const bytes = new Uint8Array(pcmData.buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);

        this.onAudioData(base64);
      };

      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;

      source.connect(this.analyser);
      this.analyser.connect(this.scriptProcessor);
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
    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
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

  getVolumeLevel(): number {
    if (!this.analyser) return 0;
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);
    let sum = 0;
    for (const value of dataArray) sum += value;
    return sum / dataArray.length;
  }
}
