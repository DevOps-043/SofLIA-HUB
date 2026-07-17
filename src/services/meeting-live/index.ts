/**
 * Servicio renderer de transcripcion de reuniones en vivo.
 *
 * Orquesta: gate de loopback en main → sesion en MeetingLiveService (main) →
 * captura local de audio (mic + sistema) → chunks por IPC. Al detener, main
 * devuelve el transcript final; createRunFromLastSession lo manda al pipeline
 * de meetings existente (resumen ejecutivo + minuta con revision HITL).
 */
import { MeetingAudioCapture, type MeetingCaptureStatus } from './audio-capture';

export type { MeetingCaptureStatus, SystemAudioMode } from './audio-capture';

export interface MeetingLiveStatusPayload {
  status: 'idle' | 'grabando' | 'finalizando';
  sessionId: string | null;
  title: string | null;
  startedAt: string | null;
  segmentsCount: number;
  screenshotsCount: number;
  lastError: string | null;
}

export interface MeetingLiveSegmentPayload {
  source: 'mic' | 'system';
  /** "usuario", "participante-N" (diarizacion) o "participantes". */
  speaker: string;
  text: string;
  t0Ms: number;
  t1Ms: number;
}

export interface MeetingDetectedPayload {
  platform: 'zoom' | 'teams' | 'meet' | 'webex';
  platformLabel: string;
  windowTitle: string;
}

export interface FinishedMeetingSummary {
  sessionId: string;
  title: string;
  startedAt: string;
  endedAt: string;
  segmentsCount: number;
  screenshotsCount: number;
  transcript: string;
}

export interface StartLiveMeetingInput {
  title?: string;
  language?: string;
  screenshotIntervalMs?: number;
}

interface MeetingLiveBridge {
  start(input?: StartLiveMeetingInput): Promise<{ success: boolean; error?: string; status?: MeetingLiveStatusPayload }>;
  stop(): Promise<{ success: boolean; error?: string; finished?: FinishedMeetingSummary }>;
  getStatus(): Promise<{
    success: boolean;
    error?: string;
    status?: MeetingLiveStatusPayload;
    pendingDetection?: MeetingDetectedPayload | null;
  }>;
  dismissDetection(): Promise<{ success: boolean }>;
  pushAudioChunk(input: { source: 'mic' | 'system'; audioB64: string }): Promise<{ success: boolean }>;
  setLoopback(enabled: boolean): Promise<{ success: boolean }>;
  createRun(input: { ownerUserId: string; organizationId?: string | null; meetingTitle?: string | null }): Promise<{ success: boolean; error?: string; result?: unknown }>;
  onSegment(cb: (payload: MeetingLiveSegmentPayload) => void): void;
  onStatusChanged(cb: (payload: MeetingLiveStatusPayload) => void): void;
  onError(cb: (payload: { message: string }) => void): void;
  onMeetingDetected(cb: (payload: MeetingDetectedPayload) => void): void;
  removeListeners(): void;
}

function getBridge(): MeetingLiveBridge {
  const bridge = (window as { meetingLive?: MeetingLiveBridge }).meetingLive;
  if (!bridge) throw new Error('El puente meetingLive no esta disponible (preload no cargado).');
  return bridge;
}

let activeCapture: MeetingAudioCapture | null = null;

/**
 * Inicia la sesion completa (main + captura local). Si la captura de audio
 * falla, revierte la sesion en main para no dejar estado colgado.
 */
export async function startLiveMeeting(input: StartLiveMeetingInput = {}): Promise<{
  status: MeetingLiveStatusPayload;
  capture: MeetingCaptureStatus;
}> {
  if (activeCapture) throw new Error('Ya hay una reunion en captura.');
  const bridge = getBridge();

  await bridge.setLoopback(true);
  const started = await bridge.start(input);
  if (!started.success || !started.status) {
    await bridge.setLoopback(false);
    throw new Error(started.error || 'No se pudo iniciar la transcripcion en vivo.');
  }

  const capture = new MeetingAudioCapture((source, audioB64) => {
    void bridge.pushAudioChunk({ source, audioB64 }).catch(() => {});
  });
  try {
    const captureStatus = await capture.start();
    activeCapture = capture;
    return { status: started.status, capture: captureStatus };
  } catch (err) {
    capture.stop();
    await bridge.stop().catch(() => {});
    await bridge.setLoopback(false).catch(() => {});
    throw err instanceof Error ? err : new Error(String(err));
  }
}

/** Detiene captura y sesion; devuelve el resumen con el transcript final. */
export async function stopLiveMeeting(): Promise<FinishedMeetingSummary> {
  const bridge = getBridge();
  activeCapture?.stop();
  activeCapture = null;
  const result = await bridge.stop();
  if (!result.success || !result.finished) {
    throw new Error(result.error || 'No se pudo detener la transcripcion en vivo.');
  }
  return result.finished;
}

/** Manda la ultima sesion finalizada al pipeline de meetings (minuta + HITL). */
export async function createRunFromLastSession(input: {
  ownerUserId: string;
  organizationId?: string | null;
  meetingTitle?: string | null;
}): Promise<unknown> {
  const result = await getBridge().createRun(input);
  if (!result.success) {
    throw new Error(result.error || 'No se pudo crear el run de la reunion.');
  }
  return result.result;
}

export async function getLiveMeetingStatus(): Promise<MeetingLiveStatusPayload> {
  const result = await getBridge().getStatus();
  if (!result.success || !result.status) {
    throw new Error(result.error || 'No se pudo consultar el estado de la transcripcion.');
  }
  return result.status;
}

/**
 * Estado completo incluyendo la deteccion pendiente. Permite a la orbe
 * recuperar el prompt "¿Tomo notas?" si la deteccion ocurrio antes de que la
 * ventana existiera (el evento broadcast se habria perdido).
 */
export async function getLiveMeetingSnapshot(): Promise<{
  status: MeetingLiveStatusPayload;
  pendingDetection: MeetingDetectedPayload | null;
}> {
  const result = await getBridge().getStatus();
  if (!result.success || !result.status) {
    throw new Error(result.error || 'No se pudo consultar el estado de la transcripcion.');
  }
  return { status: result.status, pendingDetection: result.pendingDetection ?? null };
}

/** Marca la deteccion pendiente como atendida (el usuario la rechazo). */
export async function dismissMeetingDetection(): Promise<void> {
  await getBridge().dismissDetection().catch(() => {});
}

export function isCapturing(): boolean {
  return activeCapture !== null;
}

export function onLiveMeetingSegment(cb: (payload: MeetingLiveSegmentPayload) => void): void {
  getBridge().onSegment(cb);
}

export function onLiveMeetingStatusChanged(cb: (payload: MeetingLiveStatusPayload) => void): void {
  getBridge().onStatusChanged(cb);
}

export function onLiveMeetingError(cb: (payload: { message: string }) => void): void {
  getBridge().onError(cb);
}

export function onMeetingDetected(cb: (payload: MeetingDetectedPayload) => void): void {
  getBridge().onMeetingDetected(cb);
}

export function removeLiveMeetingListeners(): void {
  getBridge().removeListeners();
}

/** true si el puente del preload esta disponible (ventana Electron real). */
export function isMeetingLiveAvailable(): boolean {
  return Boolean((window as { meetingLive?: unknown }).meetingLive);
}
