/**
 * Captura de audio para transcripcion de reuniones en vivo (renderer).
 *
 * Dos fuentes hacia el sidecar (via IPC): "mic" (el usuario) y "system"
 * (loopback: lo que suena en bocinas/audifonos = los demas participantes).
 *
 * Estrategia multiplataforma para el audio del sistema:
 *  1. getDisplayMedia con audio loopback (Windows/macOS; requiere que main
 *     haya instalado el handler via meeting-live:set-loopback).
 *  2. Dispositivo "monitor" de PulseAudio/PipeWire (Linux).
 *  3. Sin audio de sistema: se degrada a solo microfono y se reporta.
 *
 * El audio viaja como PCM int16 mono 16kHz en base64, en chunks de ~1s.
 */

export type MeetingLiveSource = 'mic' | 'system';
export type SystemAudioMode = 'loopback' | 'monitor-device' | 'unavailable';

export interface MeetingCaptureStatus {
  micActive: boolean;
  systemAudioMode: SystemAudioMode;
}

const TARGET_SAMPLE_RATE = 16000;
const CHUNK_SAMPLES = TARGET_SAMPLE_RATE; // 1 segundo por chunk

// Archivo real en public/ (mismo origen): el CSP del app ("script-src 'self'")
// bloquea modulos blob:, asi que el worklet NO puede ir inline. La URL se
// resuelve relativa al index.html para funcionar en dev (http) y empaquetado (file).
const PCM_WORKLET_FILENAME = 'meeting-live-pcm-worklet.js';

function floatChunkToPcm16Base64(samples: Float32Array): string {
  const pcm = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    pcm[i] = Math.round(clamped * 32767);
  }
  const bytes = new Uint8Array(pcm.buffer);
  let binary = '';
  const STRIDE = 0x8000; // String.fromCharCode revienta con arrays enormes
  for (let i = 0; i < bytes.length; i += STRIDE) {
    binary += String.fromCharCode(...bytes.subarray(i, i + STRIDE));
  }
  return btoa(binary);
}

interface SourcePipeline {
  stream: MediaStream;
  context: AudioContext;
  /** Nodo de captura: AudioWorklet o ScriptProcessor (fallback). */
  captureNode: AudioWorkletNode | ScriptProcessorNode;
}

export class MeetingAudioCapture {
  private pipelines = new Map<MeetingLiveSource, SourcePipeline>();
  private status: MeetingCaptureStatus = { micActive: false, systemAudioMode: 'unavailable' };
  private running = false;

  constructor(private readonly onChunk: (source: MeetingLiveSource, audioB64: string) => void) {}

  getStatus(): MeetingCaptureStatus {
    return { ...this.status };
  }

  /**
   * Inicia mic + audio de sistema. El microfono es obligatorio (si falla, se
   * lanza error); el audio del sistema se degrada segun la plataforma.
   */
  async start(): Promise<MeetingCaptureStatus> {
    if (this.running) throw new Error('La captura de audio de reunion ya esta activa.');
    this.running = true;
    try {
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          // La cancelacion de eco evita que la voz de los participantes
          // (bocinas) se cuele al canal del microfono y se transcriba doble.
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      await this.attachPipeline('mic', micStream);
      this.status.micActive = true;

      this.status.systemAudioMode = await this.startSystemAudio();
      return this.getStatus();
    } catch (err) {
      this.stop();
      throw err;
    }
  }

  stop(): void {
    this.running = false;
    for (const [, pipeline] of this.pipelines) {
      if ('port' in pipeline.captureNode) pipeline.captureNode.port.onmessage = null;
      else pipeline.captureNode.onaudioprocess = null;
      pipeline.captureNode.disconnect();
      pipeline.stream.getTracks().forEach((track) => track.stop());
      void pipeline.context.close().catch(() => {});
    }
    this.pipelines.clear();
    this.status = { micActive: false, systemAudioMode: 'unavailable' };
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  private async startSystemAudio(): Promise<SystemAudioMode> {
    // 1) Loopback nativo (Windows/macOS): main ya instalo el display handler.
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      displayStream.getVideoTracks().forEach((track) => track.stop()); // solo interesa el audio
      if (displayStream.getAudioTracks().length > 0) {
        await this.attachPipeline('system', displayStream);
        return 'loopback';
      }
    } catch (err) {
      console.warn('[MeetingLive] Loopback via getDisplayMedia no disponible:', err instanceof Error ? err.message : String(err));
    }

    // 2) Linux: dispositivo "monitor" de PulseAudio/PipeWire como entrada.
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const monitor = devices.find(
        (device) => device.kind === 'audioinput' && /monitor/i.test(device.label),
      );
      if (monitor) {
        const monitorStream = await navigator.mediaDevices.getUserMedia({
          audio: { deviceId: { exact: monitor.deviceId }, echoCancellation: false, noiseSuppression: false },
        });
        await this.attachPipeline('system', monitorStream);
        return 'monitor-device';
      }
    } catch (err) {
      console.warn('[MeetingLive] Dispositivo monitor no disponible:', err instanceof Error ? err.message : String(err));
    }

    console.warn('[MeetingLive] Sin audio del sistema: la transcripcion sera solo del microfono.');
    return 'unavailable';
  }

  private async attachPipeline(source: MeetingLiveSource, stream: MediaStream): Promise<void> {
    // AudioContext a 16kHz: Chromium remuestrea la entrada automaticamente.
    const context = new AudioContext({ sampleRate: TARGET_SAMPLE_RATE });
    const sourceNode = context.createMediaStreamSource(stream);

    let pending = new Float32Array(CHUNK_SAMPLES);
    let filled = 0;
    const accumulate = (blockIn: Float32Array) => {
      if (!this.running) return;
      let block = blockIn;
      while (block.length > 0) {
        const room = CHUNK_SAMPLES - filled;
        const take = Math.min(room, block.length);
        pending.set(block.subarray(0, take), filled);
        filled += take;
        block = block.subarray(take);
        if (filled === CHUNK_SAMPLES) {
          this.onChunk(source, floatChunkToPcm16Base64(pending));
          pending = new Float32Array(CHUNK_SAMPLES);
          filled = 0;
        }
      }
    };

    let captureNode: AudioWorkletNode | ScriptProcessorNode;
    try {
      // Via preferida: AudioWorklet desde archivo same-origin (compatible CSP).
      const workletUrl = new URL(PCM_WORKLET_FILENAME, window.location.href).toString();
      await context.audioWorklet.addModule(workletUrl);
      const workletNode = new AudioWorkletNode(context, 'soflia-pcm-capture', {
        numberOfInputs: 1,
        numberOfOutputs: 0,
      });
      workletNode.port.onmessage = (event: MessageEvent<Float32Array>) => accumulate(event.data);
      sourceNode.connect(workletNode);
      captureNode = workletNode;
    } catch (err) {
      // Fallback: ScriptProcessorNode (deprecado pero universal). La captura de
      // la reunion NUNCA debe morir por no poder cargar el modulo del worklet.
      console.warn('[MeetingLive] AudioWorklet no disponible, usando ScriptProcessor:', err instanceof Error ? err.message : String(err));
      const processorNode = context.createScriptProcessor(4096, 1, 1);
      processorNode.onaudioprocess = (event) => accumulate(event.inputBuffer.getChannelData(0).slice(0));
      sourceNode.connect(processorNode);
      // Chromium exige conectar el ScriptProcessor a un destino para que procese.
      processorNode.connect(context.destination);
      captureNode = processorNode;
    }
    this.pipelines.set(source, { stream, context, captureNode });
  }
}
