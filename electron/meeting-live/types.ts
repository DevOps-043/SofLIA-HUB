/**
 * Contratos de la transcripcion de reuniones en vivo (Meeting Live).
 *
 * Flujo: el renderer captura audio (loopback del sistema + microfono) y lo
 * envia en chunks PCM16 16kHz mono base64; el sidecar Python transcribe con
 * faster-whisper; este modulo orquesta la sesion, toma capturas de pantalla
 * periodicas (con OCR) y arma el transcript que alimenta el pipeline de
 * meetings existente (resumen ejecutivo + minuta via MeetingWorkflowService).
 */

export type MeetingLiveSource = 'mic' | 'system';

export type MeetingLiveStatus = 'idle' | 'grabando' | 'finalizando';

export interface MeetingLiveSegment {
  source: MeetingLiveSource;
  /**
   * Hablante detectado: "usuario" (la voz local), "participante-N"
   * (diarizacion por huella de voz en ambos canales: el mic tambien puede
   * traer voces remotas por bocinas) o "participantes" (sin modelo).
   */
  speaker: string;
  text: string;
  /** Milisegundos desde el inicio de la sesion (linea de tiempo por fuente). */
  t0Ms: number;
  t1Ms: number;
}

export interface MeetingLiveScreenshot {
  filePath: string;
  /** Texto OCR ya deduplicado; vacio si el OCR fallo o no aporta. */
  ocrText: string;
  /** Nombres de participantes visibles en ESTA captura (tiles de la reunion). */
  namesVisible: string[];
  capturedAtMs: number;
}

export interface StartMeetingLiveInput {
  title?: string;
  /** Idioma para Whisper (default "es"). */
  language?: string;
  /** Tamaño del modelo faster-whisper (default "small"). */
  modelSize?: string;
  /** Intervalo entre capturas de pantalla; 0 desactiva las capturas. */
  screenshotIntervalMs?: number;
}

export interface MeetingLiveSessionInfo {
  status: MeetingLiveStatus;
  sessionId: string | null;
  title: string | null;
  startedAt: string | null;
  segmentsCount: number;
  screenshotsCount: number;
  lastError: string | null;
}

export interface FinishedMeetingLiveSession {
  sessionId: string;
  title: string;
  startedAt: string;
  endedAt: string;
  segments: MeetingLiveSegment[];
  screenshots: MeetingLiveScreenshot[];
  /** Participantes confirmados por OCR (vistos en 2+ capturas). */
  participantsDetected: string[];
  /** Transcript en texto listo para el pipeline de meetings. */
  transcript: string;
}

/**
 * Puerto hacia el motor de transcripcion (sidecar Python). Desacopla el
 * servicio del PythonRuntimeService concreto y permite fakes en tests.
 */
export interface MeetingTranscriptionPort {
  start(params: {
    sessionId: string;
    language: string;
    modelSize: string;
    downloadRoot: string;
    /** Ruta del modelo de embeddings de voz; null desactiva la diarizacion. */
    speakerModelPath: string | null;
    /** Sesgo de vocabulario para Whisper (titulo de la reunion, terminos). */
    initialPrompt?: string;
  }): Promise<void>;
  /** Fire-and-forget; false si el sidecar no esta disponible. */
  pushAudio(source: MeetingLiveSource, audioB64: string): boolean;
  /** Vuelca lo pendiente y devuelve el total de segmentos emitidos. */
  stop(sessionId: string): Promise<number>;
  onSegment(listener: (segment: MeetingLiveSegment & { sessionId: string }) => void): () => void;
  onError(listener: (error: { sessionId: string; message: string }) => void): () => void;
}

/** Captura una pantalla y devuelve el PNG guardado; null si no fue posible. */
export type MeetingScreenshotCapture = (sessionId: string, sequence: number) => Promise<{
  filePath: string;
  pngBase64: string;
} | null>;

export interface MeetingLiveServiceDeps {
  transcription: MeetingTranscriptionPort;
  captureScreenshot: MeetingScreenshotCapture;
  /** OCR opcional sobre el PNG base64; si falta, las capturas van sin texto. */
  extractText?: (pngBase64: string) => Promise<string>;
  /** Directorio raiz para modelos Whisper (userData/models/whisper). */
  whisperModelsDir: string;
  /**
   * Resuelve (descargando si hace falta) el modelo de diarizacion. null =
   * sesion sin separacion de voces; nunca debe bloquear el inicio.
   */
  resolveSpeakerModel?: () => Promise<string | null>;
  now?: () => Date;
}
