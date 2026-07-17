/**
 * IPC + adaptadores de la transcripcion de reuniones en vivo (Meeting Live).
 *
 * Cablea el MeetingLiveService con sus dependencias reales:
 *  - Puerto de transcripcion sobre el sidecar Python (PythonRuntimeService)
 *  - Captura de pantalla via desktopCapturer (monitor donde esta el cursor)
 *  - OCR con el ocr-service existente (tesseract es/en)
 *  - Gate de loopback: setDisplayMediaRequestHandler SOLO se instala mientras
 *    hay captura de reunion activa, para no interferir con otros usos de
 *    getDisplayMedia y limitar la superficie de captura de audio del sistema.
 */
import { BrowserWindow, app, desktopCapturer, ipcMain, screen, session } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { handleIPC } from './utils/ipc-helpers';
import { MeetingLiveService } from './meeting-live/meeting-live-service';
import type {
  MeetingLiveSource,
  MeetingTranscriptionPort,
  StartMeetingLiveInput,
} from './meeting-live/types';
import type { PythonRuntimeService } from './python-runtime-service';
import type { MeetingWorkflowService } from './meetings/meeting-workflow-service';
import { extractTextFromBase64 } from './ocr-service';
import { ensureSpeakerModel } from './meeting-live/speaker-model';
import { matchMeetingWindow, MeetingDetectorService } from './meeting-live/meeting-detector';
import { getActiveWindowInfo } from './monitoring/active-window';

/** El primer meeting_start puede tardar (arranque del sidecar). */
const MEETING_START_TIMEOUT_MS = 60_000;
const MEETING_STOP_TIMEOUT_MS = 60_000;
const SCREENSHOT_WIDTH = 1366;

function createSidecarTranscriptionPort(runtime: PythonRuntimeService): MeetingTranscriptionPort {
  return {
    async start(params) {
      await runtime.ensureSidecarRunning();
      const res = await runtime.sendCommand('meeting_start', {
        session_id: params.sessionId,
        language: params.language,
        model_size: params.modelSize,
        download_root: params.downloadRoot,
        speaker_model_path: params.speakerModelPath ?? '',
      }, MEETING_START_TIMEOUT_MS);
      if (res.ok !== true) {
        throw new Error(String(res.error ?? 'El sidecar rechazo meeting_start.'));
      }
      console.log(`[MeetingLive] Sesion iniciada (diarizacion: ${res.speaker_diarization === true ? 'activa' : 'no disponible'}).`);
    },
    pushAudio(source, audioB64) {
      return runtime.sendNotification('meeting_audio', { source, audio_b64: audioB64 });
    },
    async stop(sessionId) {
      const res = await runtime.sendCommand('meeting_stop', { session_id: sessionId }, MEETING_STOP_TIMEOUT_MS);
      return Number(res.segments_count ?? 0);
    },
    onSegment(listener) {
      runtime.on('meeting-segment', listener);
      return () => runtime.removeListener('meeting-segment', listener);
    },
    onError(listener) {
      runtime.on('meeting-error', listener);
      return () => runtime.removeListener('meeting-error', listener);
    },
  };
}

/**
 * Captura preferentemente la VENTANA de la reunion (ahi estan los tiles con
 * nombres de participantes y las slides, aunque el usuario mire otra pantalla);
 * si no hay ventana de reunion visible, cae al monitor donde esta el cursor.
 */
async function captureMeetingScreenshot(sessionId: string, sequence: number): Promise<{
  filePath: string;
  pngBase64: string;
} | null> {
  const cursorDisplay = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const aspect = cursorDisplay.size.height / Math.max(1, cursorDisplay.size.width);
  const sources = await desktopCapturer.getSources({
    types: ['window', 'screen'],
    thumbnailSize: { width: SCREENSHOT_WIDTH, height: Math.round(SCREENSHOT_WIDTH * aspect) },
  });
  const meetingWindow = sources.find(
    (item) => item.id.startsWith('window:')
      && matchMeetingWindow('', item.name) !== null
      && !item.thumbnail.isEmpty(),
  );
  const source = meetingWindow
    ?? sources.find((item) => item.display_id === String(cursorDisplay.id))
    ?? sources.find((item) => item.id.startsWith('screen:'));
  if (!source || source.thumbnail.isEmpty()) return null;

  const png = source.thumbnail.toPNG();
  const dir = path.join(app.getPath('userData'), 'meeting-live', sessionId);
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `captura-${String(sequence).padStart(3, '0')}.png`);
  await fs.promises.writeFile(filePath, png);
  return { filePath, pngBase64: png.toString('base64') };
}

/**
 * Habilita/deshabilita el loopback de audio del sistema para getDisplayMedia.
 * Sin handler instalado, Electron niega getDisplayMedia: el gate limita la
 * ventana de tiempo en la que el renderer puede capturar audio del sistema.
 */
function setMeetingLoopbackEnabled(enabled: boolean): void {
  if (!enabled) {
    session.defaultSession.setDisplayMediaRequestHandler(null);
    return;
  }
  session.defaultSession.setDisplayMediaRequestHandler((_request, callback) => {
    desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 0, height: 0 } })
      .then((sources) => {
        // El video es obligatorio en getDisplayMedia; el renderer lo descarta
        // de inmediato y conserva solo la pista de audio 'loopback'.
        callback({ video: sources[0], audio: 'loopback' });
      })
      .catch((err) => {
        console.error('[MeetingLive] No se pudo resolver la fuente para loopback:', err);
        callback({} as Electron.Streams);
      });
  });
}

function broadcastToWindows(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, payload);
  }
}

export function createMeetingLiveService(pythonRuntimeService: PythonRuntimeService): MeetingLiveService {
  return new MeetingLiveService({
    transcription: createSidecarTranscriptionPort(pythonRuntimeService),
    captureScreenshot: captureMeetingScreenshot,
    extractText: (pngBase64) => extractTextFromBase64(pngBase64),
    whisperModelsDir: path.join(app.getPath('userData'), 'models', 'whisper'),
    resolveSpeakerModel: () => ensureSpeakerModel(),
  });
}

export function registerMeetingLiveHandlers(
  meetingLiveService: MeetingLiveService,
  meetingWorkflowService: MeetingWorkflowService,
): void {
  meetingLiveService.on('status-changed', (status) => broadcastToWindows('meeting-live:status-changed', status));
  meetingLiveService.on('segment', (segment) => broadcastToWindows('meeting-live:segment', segment));
  meetingLiveService.on('error-event', (error) => broadcastToWindows('meeting-live:error', error));

  // Deteccion pasiva: la orbe recibe el aviso y pregunta "¿Tomo notas?" (HITL).
  const detector = new MeetingDetectorService({
    getActiveWindow: () => getActiveWindowInfo(),
    isCaptureActive: () => meetingLiveService.getStatus().status !== 'idle',
  });
  detector.on('meeting-detected', (detected) => broadcastToWindows('meeting-live:meeting-detected', detected));
  meetingLiveService.on('status-changed', (status: { status: string }) => {
    // Sesion iniciada: la deteccion quedo atendida. Sesion terminada: limpiar
    // cooldown para que la orbe pueda re-ofrecerse pronto si sigue la reunion.
    if (status.status === 'grabando') detector.clearPendingDetection();
    if (status.status === 'idle') detector.resetCooldown();
  });
  detector.start();

  ipcMain.handle('meeting-live:start', (_event, input?: StartMeetingLiveInput) =>
    handleIPC(async () => ({ status: await meetingLiveService.start(input ?? {}) })));

  ipcMain.handle('meeting-live:stop', () =>
    handleIPC(async () => {
      try {
        const finished = await meetingLiveService.stop();
        return {
          finished: {
            sessionId: finished.sessionId,
            title: finished.title,
            startedAt: finished.startedAt,
            endedAt: finished.endedAt,
            segmentsCount: finished.segments.length,
            screenshotsCount: finished.screenshots.length,
            transcript: finished.transcript,
          },
        };
      } finally {
        setMeetingLoopbackEnabled(false);
      }
    }));

  ipcMain.handle('meeting-live:status', () =>
    handleIPC(async () => ({
      status: meetingLiveService.getStatus(),
      // Estado, no solo evento: si la orbe se abrio DESPUES de la deteccion,
      // recupera aqui el prompt perdido al montarse.
      pendingDetection: meetingLiveService.getStatus().status === 'idle'
        ? detector.getPendingDetection()
        : null,
    })));

  ipcMain.handle('meeting-live:dismiss-detection', () =>
    handleIPC(async () => {
      detector.clearPendingDetection();
      return { dismissed: true };
    }));

  ipcMain.handle('meeting-live:audio-chunk', (_event, input: { source: MeetingLiveSource; audioB64: string }) =>
    handleIPC(async () => ({
      accepted: meetingLiveService.pushAudio(input?.source, input?.audioB64),
    })));

  ipcMain.handle('meeting-live:set-loopback', (_event, enabled: boolean) =>
    handleIPC(async () => {
      setMeetingLoopbackEnabled(enabled === true);
      return { enabled: enabled === true };
    }));

  ipcMain.handle('meeting-live:create-run', (_event, input: {
    ownerUserId: string;
    organizationId?: string | null;
    meetingTitle?: string | null;
  }) =>
    handleIPC(async () => {
      const ownerUserId = String(input?.ownerUserId ?? '').trim();
      if (!ownerUserId) throw new Error('Falta ownerUserId para crear el run de la reunion.');
      const finished = meetingLiveService.getLastFinishedSession();
      if (!finished) throw new Error('No hay una sesion de reunion finalizada para procesar.');
      const result = await meetingWorkflowService.createManualRun({
        ownerUserId,
        organizationId: input?.organizationId ?? null,
        originChannel: 'app',
        originRef: `meeting-live:${finished.sessionId}`,
        meetingTitle: input?.meetingTitle ?? finished.title,
        text: finished.transcript,
      });
      return { result };
    }));
}
