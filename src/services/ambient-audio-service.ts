import { MEDIA_BUDGET, type MediaRef } from '../shared/multimodal-input';
import {
  acquireMicrophoneStream,
  acquireSystemAudioStream,
  isPermissionDenied,
} from './audio-capture/sources';
import {
  AMBIENT_SAMPLE_RATE,
  encodePcm16ToWav,
  floatToPcm16,
  toBase64,
  wavDurationSeconds,
} from './audio-capture/wav';

/**
 * Escucha puntual del entorno para un turno del chat.
 *
 * Tres reglas gobiernan este servicio y ninguna es negociable: solo arranca por
 * peticion explicita del usuario en el turno, dura como maximo el limite
 * configurado, y el audio se descarta al resolverse o cancelarse el turno sin
 * escribirse en ningun almacenamiento persistente.
 */

export type AmbientSource = 'sistema' | 'microfono';

export interface AmbientCaptureStatus {
  active: boolean;
  source: AmbientSource | null;
  elapsedSeconds: number;
}

export type AmbientCaptureOutcome =
  | { ok: true; media: MediaRef; source: AmbientSource; durationSeconds: number }
  | { ok: false; reason: 'no-autorizado' | 'fuente-no-disponible' | 'permiso-denegado' | 'sin-audio'; detail: string };

interface Pipeline {
  stream: MediaStream;
  context: AudioContext;
  node: AudioWorkletNode | ScriptProcessorNode;
}

const PCM_WORKLET_FILENAME = 'meeting-live-pcm-worklet.js';

export class AmbientAudioCapture {
  private pipeline: Pipeline | null = null;
  /** Activa desde antes de conectar los nodos hasta el cierre de la captura. */
  private capturing = false;
  private samples: Float32Array[] = [];
  private totalSamples = 0;
  private source: AmbientSource | null = null;
  private startedAt = 0;
  private stopTimer: ReturnType<typeof setTimeout> | null = null;
  private resolveStop: (() => void) | null = null;

  getStatus(): AmbientCaptureStatus {
    return {
      active: this.pipeline !== null,
      source: this.source,
      elapsedSeconds: this.startedAt ? Math.floor((Date.now() - this.startedAt) / 1000) : 0,
    };
  }

  /**
   * Captura durante el intervalo indicado y devuelve el audio del turno.
   *
   * `authorizedByUser` no tiene valor por omision a proposito: el modelo no
   * puede iniciar una escucha por su cuenta, y un parametro opcional habria
   * hecho que ese caso pasara desapercibido.
   */
  async listen(input: {
    source: AmbientSource;
    seconds: number;
    authorizedByUser: boolean;
  }): Promise<AmbientCaptureOutcome> {
    if (!input.authorizedByUser) {
      return {
        ok: false,
        reason: 'no-autorizado',
        detail: 'La escucha solo puede iniciarla el usuario de forma explicita en el turno.',
      };
    }

    const duracion = Math.max(1, Math.min(MEDIA_BUDGET.maxAmbientAudioSeconds, Math.floor(input.seconds)));
    const adquirido = await this.acquire(input.source);
    if (!adquirido.ok) return adquirido;

    this.startedAt = Date.now();
    this.source = input.source;

    await new Promise<void>((resolve) => {
      this.resolveStop = resolve;
      this.stopTimer = setTimeout(() => this.stop(), duracion * 1000);
    });

    const muestras = this.drain();
    if (!muestras.length) {
      return { ok: false, reason: 'sin-audio', detail: 'No se capturo audio durante la escucha.' };
    }

    const wav = encodePcm16ToWav(floatToPcm16(muestras));
    return {
      ok: true,
      source: input.source,
      durationSeconds: wavDurationSeconds(muestras.length),
      media: {
        kind: 'inline',
        mimeType: 'audio/wav',
        base64: toBase64(wav),
        durationSeconds: wavDurationSeconds(muestras.length),
      },
    };
  }

  /** Detencion explicita del usuario: conserva lo capturado hasta ese instante. */
  stop(): void {
    if (this.stopTimer) {
      clearTimeout(this.stopTimer);
      this.stopTimer = null;
    }
    this.teardown();
    const resolver = this.resolveStop;
    this.resolveStop = null;
    resolver?.();
  }

  /** Cancelacion del turno: descarta el audio sin devolverlo. */
  cancel(): void {
    this.samples = [];
    this.totalSamples = 0;
    this.stop();
  }

  private async acquire(source: AmbientSource): Promise<{ ok: true } | AmbientCaptureOutcome> {
    try {
      if (source === 'sistema') {
        const resultado = await acquireSystemAudioStream();
        if (!resultado.stream) {
          return {
            ok: false,
            reason: 'fuente-no-disponible',
            detail: `${resultado.detail ?? 'No hay captura de salida de audio en esta plataforma.'} Puedo escuchar por el microfono si lo prefieres.`,
          };
        }
        await this.attach(resultado.stream);
        return { ok: true };
      }
      await this.attach(await acquireMicrophoneStream());
      return { ok: true };
    } catch (error) {
      if (isPermissionDenied(error)) {
        return {
          ok: false,
          reason: 'permiso-denegado',
          detail: 'El sistema operativo denego el permiso de captura de audio.',
        };
      }
      return {
        ok: false,
        reason: 'fuente-no-disponible',
        detail: 'No pude abrir la fuente de audio solicitada.',
      };
    }
  }

  private async attach(stream: MediaStream): Promise<void> {
    const context = new AudioContext({ sampleRate: AMBIENT_SAMPLE_RATE });
    const sourceNode = context.createMediaStreamSource(stream);
    // La bandera se activa ANTES de conectar los nodos: `this.pipeline` solo
    // existe al final de este metodo, y el audio empieza a fluir en cuanto se
    // conectan, asi que condicionar la acumulacion al pipeline perdia los
    // primeros bloques de cada escucha.
    this.capturing = true;
    const acumular = (bloque: Float32Array) => {
      if (!this.capturing) return;
      this.samples.push(new Float32Array(bloque));
      this.totalSamples += bloque.length;
    };

    let node: AudioWorkletNode | ScriptProcessorNode;
    try {
      // El worklet se sirve como archivo del mismo origen: la CSP del renderer
      // bloquea los modulos `blob:`.
      const workletUrl = new URL(PCM_WORKLET_FILENAME, window.location.href).toString();
      await context.audioWorklet.addModule(workletUrl);
      const workletNode = new AudioWorkletNode(context, 'soflia-pcm-capture', { numberOfInputs: 1, numberOfOutputs: 0 });
      workletNode.port.onmessage = (event: MessageEvent<Float32Array>) => acumular(event.data);
      sourceNode.connect(workletNode);
      node = workletNode;
    } catch {
      const processor = context.createScriptProcessor(4096, 1, 1);
      processor.onaudioprocess = (event) => acumular(event.inputBuffer.getChannelData(0));
      sourceNode.connect(processor);
      processor.connect(context.destination);
      node = processor;
    }

    // El dispositivo puede desaparecer a mitad de la escucha (audifonos
    // desconectados): se libera y se declara la interrupcion.
    stream.getTracks().forEach((track) => track.addEventListener('ended', () => this.stop()));
    this.pipeline = { stream, context, node };
  }

  private teardown(): void {
    this.capturing = false;
    const activo = this.pipeline;
    this.pipeline = null;
    this.source = null;
    this.startedAt = 0;
    if (!activo) return;
    if ('port' in activo.node) activo.node.port.onmessage = null;
    else activo.node.onaudioprocess = null;
    activo.node.disconnect();
    activo.stream.getTracks().forEach((track) => track.stop());
    void activo.context.close().catch(() => undefined);
  }

  private drain(): Float32Array {
    const total = new Float32Array(this.totalSamples);
    let offset = 0;
    for (const bloque of this.samples) {
      total.set(bloque, offset);
      offset += bloque.length;
    }
    // El audio no se conserva mas alla del turno que lo consume.
    this.samples = [];
    this.totalSamples = 0;
    return total;
  }
}

export const ambientAudioCapture = new AmbientAudioCapture();
