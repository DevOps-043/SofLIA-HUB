import type { PythonRuntimeService } from '../python-runtime-service';
import type { MeetingTranscriptionPort } from './types';
const MEETING_START_TIMEOUT_MS = 60_000;
const MEETING_STOP_TIMEOUT_MS = 60_000;
export function createSidecarTranscriptionPort(runtime: PythonRuntimeService): MeetingTranscriptionPort {
  let activeSessionId: string | null = null;
  let unavailable = false;
  const invalidate = () => { unavailable = true; };
  return {
    async start(params) {
      unavailable = false; activeSessionId = params.sessionId;
      runtime.removeListener('sidecar-unavailable', invalidate); runtime.on('sidecar-unavailable', invalidate);
      try {
        await runtime.ensureSidecarRunning();
        if (unavailable) throw new Error('El proceso local de transcripción fue detenido.');
        const res = await runtime.sendCommand('meeting_start', {
          session_id: params.sessionId,
          language: params.language,
          model_size: params.modelSize,
          download_root: params.downloadRoot,
          speaker_model_path: params.speakerModelPath ?? '',
          initial_prompt: params.initialPrompt ?? '',
        }, MEETING_START_TIMEOUT_MS);
        if (res.ok !== true) {
          throw new Error(String(res.error ?? 'El sidecar rechazo meeting_start.'));
        }
        if (unavailable) throw new Error('El proceso local de transcripción fue detenido.');
        console.log(`[MeetingLive] Sesion iniciada (diarizacion: ${res.speaker_diarization === true ? 'activa' : 'no disponible'}).`);
      } catch (error) { activeSessionId = null; runtime.removeListener('sidecar-unavailable', invalidate); throw error; }
    },
    pushAudio(source, audioB64) {
      if (unavailable || !activeSessionId) return false;
      return runtime.sendNotification('meeting_audio', { source, audio_b64: audioB64 });
    },
    async stop(sessionId) {
      if (activeSessionId !== sessionId) return 0;
      activeSessionId = null;
      runtime.removeListener('sidecar-unavailable', invalidate);
      if (unavailable) throw new Error('El proceso local se detuvo; el drenado de la transcripción quedó incompleto.');
      const res = await runtime.sendCommand('meeting_stop', { session_id: sessionId }, MEETING_STOP_TIMEOUT_MS);
      return Number(res.segments_count ?? 0);
    },
    onSegment(listener) {
      runtime.on('meeting-segment', listener);
      return () => runtime.removeListener('meeting-segment', listener);
    },
    onError(listener) {
      let observing = true;
      const unavailableNotice = () => { if (observing && activeSessionId) listener({ sessionId: activeSessionId, message: 'El proceso local de transcripción se detuvo. Detén la reunión y vuelve a iniciarla para continuar.' }); };
      runtime.on('sidecar-unavailable', unavailableNotice);
      runtime.on('meeting-error', listener);
      // La sesión pudo revocarse entre start() y el montaje del consumidor.
      if (unavailable) queueMicrotask(unavailableNotice);
      return () => { observing = false; runtime.removeListener('meeting-error', listener); runtime.removeListener('sidecar-unavailable', unavailableNotice); };
    },
  };
}


