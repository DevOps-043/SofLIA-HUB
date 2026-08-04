/**
 * MeetingLiveService: orquesta una sesion de transcripcion de reunion en vivo.
 *
 * Responsabilidad unica: ciclo de vida de la sesion (estado, segmentos,
 * capturas periodicas, transcript final). NO captura audio (renderer), NO
 * transcribe (sidecar via MeetingTranscriptionPort) y NO genera la minuta
 * (pipeline de meetings existente). Dependencias inyectadas para testeo.
 *
 * Eventos: 'status-changed' (MeetingLiveSessionInfo), 'segment', 'error'.
 */
import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import { buildMeetingTranscript, isMeaningfulOcrChange } from './transcript-builder';
import { ParticipantNameCollector } from './participant-names';
import type {
  FinishedMeetingLiveSession,
  MeetingLiveScreenshot,
  MeetingLiveSegment,
  MeetingLiveServiceDeps,
  MeetingLiveSessionInfo,
  MeetingLiveSource,
  MeetingLiveStatus,
  StartMeetingLiveInput,
} from './types';

const DEFAULT_SCREENSHOT_INTERVAL_MS = 75_000;
const MIN_SCREENSHOT_INTERVAL_MS = 15_000;
/** Chunk PCM16 de 1s a 16kHz ≈ 43KB en base64; 1MB cubre holgado y frena abusos. */
const MAX_AUDIO_CHUNK_B64_LENGTH = 1_000_000;
/** Al detener, el sidecar puede tener ventanas encoladas por transcribir. */
const STOP_DRAIN_TIMEOUT_MS = 45_000;

interface ActiveSession {
  sessionId: string;
  title: string;
  startedAt: Date;
  segments: MeetingLiveSegment[];
  screenshots: MeetingLiveScreenshot[];
  screenshotTimer: NodeJS.Timeout | null;
  screenshotSequence: number;
  screenshotInFlight: boolean;
  lastOcrText: string;
  nameCollector: ParticipantNameCollector;
  unsubscribeSegment: () => void;
  unsubscribeError: () => void;
}

export class MeetingLiveService extends EventEmitter {
  private status: MeetingLiveStatus = 'idle';
  private session: ActiveSession | null = null;
  private lastFinished: FinishedMeetingLiveSession | null = null;
  private lastError: string | null = null;

  constructor(private readonly deps: MeetingLiveServiceDeps) {
    super();
  }

  getStatus(): MeetingLiveSessionInfo {
    return {
      status: this.status,
      sessionId: this.session?.sessionId ?? null,
      title: this.session?.title ?? null,
      startedAt: this.session?.startedAt.toISOString() ?? null,
      segmentsCount: this.session?.segments.length ?? 0,
      screenshotsCount: this.session?.screenshots.length ?? 0,
      lastError: this.lastError,
    };
  }

  getLastFinishedSession(): FinishedMeetingLiveSession | null {
    return this.lastFinished;
  }

  async start(input: StartMeetingLiveInput = {}): Promise<MeetingLiveSessionInfo> {
    if (this.status !== 'idle') {
      throw new Error('Ya hay una sesion de transcripcion en curso. Detenla antes de iniciar otra.');
    }
    const sessionId = randomUUID();
    const startedAt = this.now();
    this.lastError = null;

    // La diarizacion es best-effort: si el modelo no se puede resolver, la
    // sesion arranca igual con la etiqueta generica "participantes".
    let speakerModelPath: string | null = null;
    if (this.deps.resolveSpeakerModel) {
      try {
        speakerModelPath = await this.deps.resolveSpeakerModel();
      } catch (err) {
        console.warn('[MeetingLive] Modelo de hablantes no disponible:', err instanceof Error ? err.message : String(err));
      }
    }

    const title = input.title?.trim() || `Reunion ${startedAt.toLocaleString('es-MX')}`;
    await this.deps.transcription.start({
      sessionId,
      language: (input.language || 'es').trim(),
      modelSize: (input.modelSize || 'small').trim(),
      downloadRoot: this.deps.whisperModelsDir,
      speakerModelPath,
      // Sesgo de vocabulario: mejora nombres propios y terminos del dominio.
      initialPrompt: `Reunion de trabajo en espanol (Mexico): ${title}. Terminos frecuentes: SofLIA, IRIS, minuta.`,
    });

    const session: ActiveSession = {
      sessionId,
      title,
      startedAt,
      segments: [],
      screenshots: [],
      screenshotTimer: null,
      screenshotSequence: 0,
      screenshotInFlight: false,
      lastOcrText: '',
      nameCollector: new ParticipantNameCollector(),
      unsubscribeSegment: this.deps.transcription.onSegment((segment) => {
        if (segment.sessionId !== sessionId) return; // evento de una sesion vieja
        const clean: MeetingLiveSegment = {
          source: segment.source,
          speaker: segment.speaker,
          text: segment.text,
          t0Ms: segment.t0Ms,
          t1Ms: segment.t1Ms,
        };
        session.segments.push(clean);
        this.emit('segment', clean);
        this.emitStatus();
      }),
      unsubscribeError: this.deps.transcription.onError((error) => {
        if (error.sessionId !== sessionId) return;
        this.lastError = error.message;
        this.emit('error-event', { message: error.message });
        this.emitStatus();
      }),
    };
    this.session = session;
    this.status = 'grabando';
    this.startScreenshotTimer(input.screenshotIntervalMs);
    this.emitStatus();
    return this.getStatus();
  }

  /** Reenvia un chunk de audio del renderer al sidecar. Ignorado fuera de sesion. */
  pushAudio(source: MeetingLiveSource, audioB64: string): boolean {
    if (this.status !== 'grabando' || !this.session) return false;
    if (source !== 'mic' && source !== 'system') return false;
    if (typeof audioB64 !== 'string' || !audioB64 || audioB64.length > MAX_AUDIO_CHUNK_B64_LENGTH) {
      return false;
    }
    return this.deps.transcription.pushAudio(source, audioB64);
  }

  async stop(): Promise<FinishedMeetingLiveSession> {
    const session = this.session;
    if (this.status !== 'grabando' || !session) {
      throw new Error('No hay una sesion de transcripcion activa.');
    }
    this.status = 'finalizando';
    this.emitStatus();
    if (session.screenshotTimer) clearInterval(session.screenshotTimer);

    try {
      // El stop del sidecar vuelca las ventanas pendientes ANTES de responder:
      // los ultimos meeting_segment llegan durante este await.
      await this.withTimeout(
        this.deps.transcription.stop(session.sessionId),
        STOP_DRAIN_TIMEOUT_MS,
        'El sidecar no termino de volcar la transcripcion a tiempo.',
      );
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : String(err);
      console.warn(`[MeetingLive] stop() con drenado incompleto: ${this.lastError}`);
    } finally {
      session.unsubscribeSegment();
      session.unsubscribeError();
    }

    const endedAt = this.now();
    const participantsDetected = session.nameCollector.getConfirmedNames();
    const finished: FinishedMeetingLiveSession = {
      sessionId: session.sessionId,
      title: session.title,
      startedAt: session.startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
      segments: session.segments,
      screenshots: session.screenshots,
      participantsDetected,
      transcript: buildMeetingTranscript({
        title: session.title,
        startedAt: session.startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
        segments: session.segments,
        screenshots: session.screenshots,
        participantsDetected,
      }),
    };
    this.lastFinished = finished;
    this.session = null;
    this.status = 'idle';
    this.emitStatus();
    return finished;
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  private startScreenshotTimer(requestedIntervalMs?: number): void {
    const session = this.session;
    if (!session) return;
    if (requestedIntervalMs === 0) return; // capturas desactivadas explicitamente
    const intervalMs = Math.max(
      MIN_SCREENSHOT_INTERVAL_MS,
      requestedIntervalMs ?? DEFAULT_SCREENSHOT_INTERVAL_MS,
    );
    session.screenshotTimer = setInterval(() => {
      void this.captureScreenshotTick(session);
    }, intervalMs);
  }

  private async captureScreenshotTick(session: ActiveSession): Promise<void> {
    // Una captura lenta (OCR incluido) no debe encimarse con la siguiente.
    if (session.screenshotInFlight || this.session !== session) return;
    session.screenshotInFlight = true;
    try {
      session.screenshotSequence += 1;
      const shot = await this.deps.captureScreenshot(session.sessionId, session.screenshotSequence);
      if (!shot || this.session !== session) return;

      const capturedAtMs = this.now().getTime() - session.startedAt.getTime();
      let ocrText = '';
      let namesVisible: string[] = [];
      if (this.deps.extractText) {
        try {
          const rawText = await this.deps.extractText(shot.pngBase64);
          // Los nombres se cosechan del OCR CRUDO de cada captura: aunque la
          // slide no cambie (dedupe), los tiles de participantes siguen ahi.
          namesVisible = session.nameCollector.addFromOcr(rawText, capturedAtMs);
          if (isMeaningfulOcrChange(session.lastOcrText, rawText)) {
            ocrText = rawText;
            session.lastOcrText = rawText;
          }
        } catch (err) {
          console.warn('[MeetingLive] OCR de captura fallo (se guarda sin texto):', err instanceof Error ? err.message : String(err));
        }
      }

      session.screenshots.push({
        filePath: shot.filePath,
        ocrText,
        namesVisible,
        capturedAtMs,
      });
      this.emitStatus();
    } catch (err) {
      console.warn('[MeetingLive] Captura de pantalla fallo:', err instanceof Error ? err.message : String(err));
    } finally {
      session.screenshotInFlight = false;
    }
  }

  private emitStatus(): void {
    this.emit('status-changed', this.getStatus());
  }

  private now(): Date {
    return this.deps.now ? this.deps.now() : new Date();
  }

  private withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(message)), ms);
      promise.then(
        (value) => { clearTimeout(timer); resolve(value); },
        (err) => { clearTimeout(timer); reject(err); },
      );
    });
  }
}
