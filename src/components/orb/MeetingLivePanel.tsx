/**
 * Panel de toma de notas de reunion en la ventana de la orbe.
 *
 * Tres momentos: propuesta (con aviso de consentimiento — sin aceptar no se
 * graba nada), indicador de grabacion SIEMPRE visible mientras se transcribe,
 * y cierre con confirmacion de minuta. Estetica consistente con la orbe.
 */
import type { MeetingLiveUiState } from './useMeetingLive';

interface MeetingLivePanelProps {
  state: MeetingLiveUiState;
  onAccept: () => void;
  onDecline: () => void;
  onStop: () => void;
  onDismiss: () => void;
}

const CARD_CLASS = 'orb-no-drag mx-4 mt-1 rounded-2xl border border-white/10 bg-black/60 px-4 py-3 text-left shadow-xl backdrop-blur-xl';

export function MeetingLivePanel({ state, onAccept, onDecline, onStop, onDismiss }: MeetingLivePanelProps) {
  if (state.phase === 'oculto') return null;

  if (state.phase === 'propuesta') {
    return (
      <div className={CARD_CLASS} role="dialog" aria-label="Tomar notas de la reunion">
        <p className="text-sm font-medium text-white/90">
          Detecté una reunión{state.detected ? ` de ${state.detected.platformLabel}` : ''}. ¿Tomo notas y preparo la minuta?
        </p>
        <p className="mt-1.5 text-[11px] leading-snug text-amber-200/85">
          La reunión se transcribirá localmente en este equipo. Al iniciar confirmas que
          avisarás a los participantes que se están tomando notas.
        </p>
        <div className="mt-2.5 flex gap-2">
          <button
            type="button"
            onClick={onAccept}
            className="rounded-full bg-teal-500/90 px-3.5 py-1.5 text-xs font-semibold text-black transition-colors hover:bg-teal-400"
          >
            Sí, tomar notas
          </button>
          <button
            type="button"
            onClick={onDecline}
            className="rounded-full border border-white/15 px-3.5 py-1.5 text-xs text-white/70 transition-colors hover:bg-white/10"
          >
            Ahora no
          </button>
        </div>
      </div>
    );
  }

  if (state.phase === 'iniciando' || state.phase === 'grabando' || state.phase === 'finalizando') {
    const label = state.phase === 'iniciando'
      ? 'Preparando transcripción…'
      : state.phase === 'finalizando'
        ? 'Cerrando y generando minuta…'
        : `Transcribiendo reunión · ${state.segmentsCount} segmentos`;
    return (
      <div className={CARD_CLASS} role="status" aria-label="Transcripcion de reunion en curso">
        <div className="flex items-center gap-2">
          <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.9)]" />
          <p className="text-xs font-medium text-white/90">{label}</p>
        </div>
        {state.message && (
          <p className="mt-1 text-[11px] text-amber-200/80">{state.message}</p>
        )}
        {state.phase === 'grabando' && (
          <button
            type="button"
            onClick={onStop}
            className="mt-2 rounded-full border border-red-400/40 bg-red-500/15 px-3.5 py-1.5 text-xs font-semibold text-red-200 transition-colors hover:bg-red-500/30"
          >
            Detener y generar minuta
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={CARD_CLASS} role="status">
      <p className={`text-xs ${state.phase === 'error' ? 'text-red-300/90' : 'text-teal-200/90'}`}>
        {state.phase === 'error' ? 'No pude completar la transcripción: ' : ''}
        {state.message}
      </p>
      <button
        type="button"
        onClick={onDismiss}
        className="mt-2 rounded-full border border-white/15 px-3 py-1 text-[11px] text-white/60 transition-colors hover:bg-white/10"
      >
        Cerrar
      </button>
    </div>
  );
}
