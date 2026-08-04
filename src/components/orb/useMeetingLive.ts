/**
 * Estado y acciones de la toma de notas de reunion desde la orbe.
 *
 * Flujo HITL: el detector (main) avisa que hay una reunion activa → la orbe
 * muestra el prompt "¿Tomo notas?" con el aviso de consentimiento → solo si el
 * usuario acepta se inicia la captura. Al detener, el transcript pasa al
 * pipeline de meetings (minuta + resumen ejecutivo con revision humana).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createRunFromLastSession,
  dismissMeetingDetection,
  getLiveMeetingSnapshot,
  isMeetingLiveAvailable,
  onLiveMeetingError,
  onLiveMeetingStatusChanged,
  onMeetingDetected,
  removeLiveMeetingListeners,
  startLiveMeeting,
  stopLiveMeeting,
  type MeetingDetectedPayload,
  type SystemAudioMode,
} from '../../services/meeting-live';
import { getSofiaStoredSession } from '../../services/sofia-auth/session-storage';

export type MeetingLivePhase =
  | 'oculto'
  | 'propuesta'
  | 'iniciando'
  | 'grabando'
  | 'finalizando'
  | 'completado'
  | 'error';

export interface MeetingLiveUiState {
  phase: MeetingLivePhase;
  detected: MeetingDetectedPayload | null;
  segmentsCount: number;
  systemAudioMode: SystemAudioMode | null;
  message: string | null;
}

const FINISHED_AUTO_HIDE_MS = 12_000;
/** Tras un "Ahora no", no volver a proponer la misma plataforma por un rato. */
const DECLINE_SUPPRESSION_MS = 10 * 60_000;

export function useMeetingLive() {
  const [state, setState] = useState<MeetingLiveUiState>({
    phase: 'oculto',
    detected: null,
    segmentsCount: 0,
    systemAudioMode: null,
    message: null,
  });
  const phaseRef = useRef<MeetingLivePhase>('oculto');
  phaseRef.current = state.phase;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const declinedUntil = useRef(new Map<string, number>());

  useEffect(() => {
    if (!isMeetingLiveAvailable()) return undefined;
    const proposeIfIdle = (detected: MeetingDetectedPayload) => {
      // Solo proponer cuando no hay nada en curso en esta orbe, y sin
      // insistir si el usuario acaba de rechazar esa misma plataforma.
      if (phaseRef.current !== 'oculto') return;
      if ((declinedUntil.current.get(detected.platform) ?? 0) > Date.now()) return;
      setState((prev) => ({ ...prev, phase: 'propuesta', detected, message: null }));
    };
    onMeetingDetected(proposeIfIdle);
    // La deteccion es ESTADO ademas de evento: si ocurrio antes de que esta
    // ventana existiera (broadcast perdido), se recupera aqui al montar.
    void getLiveMeetingSnapshot()
      .then((snapshot) => {
        if (snapshot.pendingDetection) proposeIfIdle(snapshot.pendingDetection);
      })
      .catch(() => { /* sin puente o main ocupado: el evento en vivo cubre el resto */ });
    onLiveMeetingStatusChanged((status) => {
      setState((prev) => (
        prev.phase === 'grabando' || prev.phase === 'iniciando'
          ? { ...prev, segmentsCount: status.segmentsCount }
          : prev
      ));
    });
    onLiveMeetingError((error) => {
      // Error no fatal del sidecar: se informa sin cortar la sesion.
      setState((prev) => (
        prev.phase === 'grabando' ? { ...prev, message: error.message } : prev
      ));
    });
    return () => {
      removeLiveMeetingListeners();
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  const decline = useCallback(() => {
    setState((prev) => {
      if (prev.detected) {
        declinedUntil.current.set(prev.detected.platform, Date.now() + DECLINE_SUPPRESSION_MS);
      }
      return { ...prev, phase: 'oculto', detected: null, message: null };
    });
    // Tambien en main: sin esto, el snapshot al re-montar reviviria el prompt.
    void dismissMeetingDetection();
  }, []);

  const acceptAndStart = useCallback(async () => {
    const detected = state.detected;
    setState((prev) => ({ ...prev, phase: 'iniciando', message: null }));
    try {
      const started = await startLiveMeeting({
        title: detected ? `Reunion ${detected.platformLabel}` : undefined,
      });
      setState((prev) => ({
        ...prev,
        phase: 'grabando',
        systemAudioMode: started.capture.systemAudioMode,
        segmentsCount: 0,
        message: started.capture.systemAudioMode === 'unavailable'
          ? 'Sin audio del sistema: solo se transcribe tu microfono.'
          : null,
      }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        phase: 'error',
        message: err instanceof Error ? err.message : String(err),
      }));
    }
  }, [state.detected]);

  const stopAndCreateMinuta = useCallback(async () => {
    setState((prev) => ({ ...prev, phase: 'finalizando' }));
    try {
      const finished = await stopLiveMeeting();
      const user = getSofiaStoredSession() as { id?: string } | null;
      if (user?.id) {
        await createRunFromLastSession({ ownerUserId: String(user.id) });
        setState((prev) => ({
          ...prev,
          phase: 'completado',
          message: `Minuta en proceso: ${finished.segmentsCount} segmentos transcritos. Revisala en Reuniones.`,
        }));
      } else {
        setState((prev) => ({
          ...prev,
          phase: 'completado',
          message: 'Transcripcion guardada. Inicia sesion en SofLIA para generar la minuta.',
        }));
      }
    } catch (err) {
      setState((prev) => ({
        ...prev,
        phase: 'error',
        message: err instanceof Error ? err.message : String(err),
      }));
    }
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      setState((prev) => (
        prev.phase === 'completado' || prev.phase === 'error'
          ? { ...prev, phase: 'oculto', detected: null, message: null }
          : prev
      ));
    }, FINISHED_AUTO_HIDE_MS);
  }, []);

  const dismissMessage = useCallback(() => {
    setState((prev) => ({ ...prev, phase: 'oculto', detected: null, message: null }));
  }, []);

  return { state, acceptAndStart, decline, stopAndCreateMinuta, dismissMessage };
}
