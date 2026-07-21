import { useEffect, useMemo } from 'react';
import { OrbCanvas } from '../components/orb/OrbCanvas';
import { OrbInfoPanel } from '../components/orb/OrbInfoPanel';
import { OrbTranscriptPanel } from '../components/orb/OrbTranscriptPanel';
import { toVisualState, type OrbVisualState } from '../components/orb/orb-types';
import {
  useAudioFeatures,
  type AudioFeatureRefs,
  type AudioFeatureSource,
} from '../components/orb/useAudioFeatures';
import { useOrbConversation, type OrbSource } from '../components/orb/useOrbConversation';
import { MeetingLivePanel } from '../components/orb/MeetingLivePanel';
import { useMeetingLive, type MeetingLiveUiState } from '../components/orb/useMeetingLive';

const STATE_LABELS: Record<string, string> = {
  idle: '',
  listening: 'Escuchando…',
  thinking: 'Pensando…',
  acting: 'Ejecutando…',
  speaking: '',
  info: '',
};

const STATE_GLOWS: Record<OrbVisualState, { soft: string; text: string }> = {
  idle: { soft: 'rgba(0, 212, 179, 0.18)', text: '#00D4B3' },
  listening: { soft: 'rgba(0, 212, 179, 0.26)', text: '#7FF4E2' },
  thinking: { soft: 'rgba(10, 37, 64, 0.28)', text: '#FFFFFF' },
  speaking: { soft: 'rgba(0, 212, 179, 0.3)', text: '#FFFFFF' },
  acting: { soft: 'rgba(245, 158, 11, 0.22)', text: '#F59E0B' },
};

const VISUAL_STATES = new Set<OrbVisualState>(['idle', 'listening', 'thinking', 'acting', 'speaking']);

const DEVELOPMENT_PANEL_TEXT = `SofLIA contrastó la información y preparó una síntesis breve para que puedas revisar los datos importantes sin perder el contexto de la conversación.

- La respuesta normal permanece únicamente en voz.
- Este panel aparece cuando existen referencias verificables.
- Puedes desplegar las fuentes cuando necesites consultarlas.`;

const DEVELOPMENT_PANEL_SOURCES: OrbSource[] = [
  { uri: 'https://example.com/referencia-principal', title: 'Referencia principal del análisis' },
  { uri: 'https://example.com/documentacion', title: 'Documentación complementaria' },
];

function getDevelopmentPreviewState(): OrbVisualState | null {
  if (!import.meta.env.DEV) return null;
  const candidate = new URLSearchParams(window.location.search).get('orbState') as OrbVisualState | null;
  return candidate && VISUAL_STATES.has(candidate) ? candidate : null;
}

function getDevelopmentAudioPreview(): boolean {
  return import.meta.env.DEV
    && new URLSearchParams(window.location.search).get('orbAudio') === 'demo';
}

function getDevelopmentCompactPreview(): boolean {
  return import.meta.env.DEV
    && new URLSearchParams(window.location.search).get('orbCompact') === '1';
}

function getDevelopmentMeetingPreview(): MeetingLiveUiState | null {
  if (!import.meta.env.DEV) return null;
  if (new URLSearchParams(window.location.search).get('orbMeeting') !== 'recording') return null;
  return {
    phase: 'grabando',
    detected: null,
    segmentsCount: 17,
    systemAudioMode: 'loopback',
    message: null,
  };
}

function getDevelopmentTranscriptPreview(): string {
  if (!import.meta.env.DEV) return '';
  return new URLSearchParams(window.location.search).get('orbTranscript') === 'demo'
    ? 'Con respecto a la generación de materiales del curso, me di cuenta de que lo mismo aplica a ambas alternativas y necesitamos revisar el siguiente paso.'
    : '';
}

/** Señal de voz irregular exclusiva de la vista QA de Vite. */
function useDevelopmentAudioPreview(audio: AudioFeatureRefs, enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return undefined;
    let frame = 0;
    const startedAt = performance.now();
    const update = (now: number) => {
      const time = (now - startedAt) / 1000;
      const phrase = 0.52 + Math.sin(time * 0.719) * 0.27 + Math.sin(time * 0.413) * 0.18;
      const syllable = Math.pow(Math.max(0, Math.sin(time * 5.13 + Math.sin(time * 0.83) * 1.7)), 1.55);
      const consonant = Math.pow(Math.max(0, Math.sin(time * 11.7 + 1.4)), 4);
      audio.level.current = Math.min(1, Math.max(0.03, phrase * (0.18 + syllable * 0.7) + consonant * 0.18));
      audio.tone.current = 0.42 + Math.sin(time * 0.557) * 0.18;
      for (let band = 0; band < audio.bands.current.length; band += 1) {
        const variation = 0.5 + Math.sin(time * (2.1 + band * 0.317) + band * 1.41) * 0.5;
        audio.bands.current[band] = Math.min(1, audio.level.current * (0.22 + variation * 0.82));
      }
      frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
    return () => {
      cancelAnimationFrame(frame);
      audio.level.current = 0;
      audio.bands.current.fill(0);
    };
  }, [audio.bands, audio.level, audio.tone, enabled]);
}

// Root de la ventana orbe (view=orb): columna anclada a la izquierda estilo
// Copilot. Solo la orbe + transcript; el panel aparece con respuestas largas.
export function OrbWindowRoot() {
  const orb = useOrbConversation();
  const meetingLive = useMeetingLive();
  const previewState = useMemo(getDevelopmentPreviewState, []);
  const previewAudio = useMemo(getDevelopmentAudioPreview, []);
  const previewCompact = useMemo(getDevelopmentCompactPreview, []);
  const previewMeeting = useMemo(getDevelopmentMeetingPreview, []);
  const previewTranscript = useMemo(getDevelopmentTranscriptPreview, []);

  // Fuente de audio para la reactividad: mic al escuchar, salida TTS al hablar.
  const audioSource = useMemo<AudioFeatureSource>(() => {
    if (orb.state === 'listening') return { kind: 'mic' };
    if (orb.ttsPlaying) {
      const context = orb.playback.getContext();
      const node = orb.playback.getOutputNode();
      if (context && node) return { kind: 'node', context, node };
    }
    return null;
  }, [orb.state, orb.ttsPlaying, orb.playback]);
  const audio = useAudioFeatures(audioSource);
  useDevelopmentAudioPreview(audio, previewAudio);

  // `orbState` permite revisar las cinco fases en Vite sin alterar producción.
  const visualState = previewState ?? toVisualState(orb.state, orb.ttsPlaying);
  const glow = STATE_GLOWS[visualState];
  const compact = previewCompact || orb.infoVisible;
  const visibleMeetingState = previewMeeting ?? meetingLive.state;
  const meetingPanelVisible = visibleMeetingState.phase !== 'oculto';
  const panelText = previewCompact && !orb.responseText ? DEVELOPMENT_PANEL_TEXT : orb.responseText;
  const panelSources = previewCompact && orb.sources.length === 0
    ? DEVELOPMENT_PANEL_SOURCES
    : orb.sources;
  const statusLabel = orb.activeTool
    ? `Ejecutando: ${orb.activeTool.replace(/_/g, ' ')}`
    : STATE_LABELS[previewState ?? orb.state] ?? '';
  const transcriptText = previewTranscript || (
    orb.state === 'listening'
      ? orb.transcript
      : orb.userText && !compact
        ? orb.userText
        : ''
  );

  return (
    <div className="h-screen w-screen overflow-hidden bg-transparent flex flex-col select-none">
      {/* Handle nativo: mueve la ventana sin robar eventos al canvas. */}
      <div className="orb-drag-region relative flex h-10 shrink-0 items-center justify-center px-3 pt-2" title="Arrastra para mover SofLIA">
        <div className="pointer-events-none flex h-7 items-center gap-2 rounded-full border border-white/10 bg-black/45 px-3 shadow-lg backdrop-blur-xl">
          <svg aria-hidden="true" viewBox="0 0 12 18" className="h-3.5 w-2.5 text-white/35" fill="currentColor">
            <circle cx="3" cy="3" r="1" /><circle cx="9" cy="3" r="1" />
            <circle cx="3" cy="9" r="1" /><circle cx="9" cy="9" r="1" />
            <circle cx="3" cy="15" r="1" /><circle cx="9" cy="15" r="1" />
          </svg>
          <span className="text-[9px] font-semibold uppercase tracking-[0.22em] text-white/55">SofLIA</span>
        </div>
        <button
          type="button"
          onClick={orb.closeOrb}
          aria-label="Cerrar orbe"
          className="orb-no-drag absolute right-3 top-2 h-7 w-7 rounded-full border border-white/10 bg-black/55 text-sm leading-none text-white/60 backdrop-blur-md transition-colors hover:bg-black/75 hover:text-white"
        >
          ✕
        </button>
      </div>

      {/* Toma de notas de reunion: propuesta HITL + indicador de grabacion */}
      <MeetingLivePanel
        state={visibleMeetingState}
        onAccept={() => { void meetingLive.acceptAndStart(); }}
        onDecline={meetingLive.decline}
        onStop={() => { void meetingLive.stopAndCreateMinuta(); }}
        onDismiss={meetingLive.dismissMessage}
      />

      {/* Orbe: grande centrada, o compacta arriba cuando hay panel de info */}
      <div
        className={`relative isolate transition-all duration-700 ease-out mx-auto ${
          compact
            ? 'h-44 w-44 shrink-0 mt-0'
            : meetingPanelVisible
              ? 'h-[248px] w-[248px] shrink-0 mt-2'
              : 'h-[340px] w-[340px] shrink-0 mt-10'
        }`}
      >
        {/* Halo de marca tenue; el centro queda transparente sobre el escritorio. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-[9%] -z-10 rounded-full blur-2xl transition-colors duration-700"
          style={{
            background: `radial-gradient(circle, ${glow.soft} 0%, color-mix(in srgb, ${glow.soft} 52%, transparent) 42%, transparent 72%)`,
          }}
        />
        <div className="orb-no-drag relative h-full w-full">
          <OrbCanvas visualState={visualState} audio={audio} />
        </div>
      </div>

      <OrbTranscriptPanel
        errorMessage={orb.errorMessage}
        glow={glow}
        isListening={(previewState ?? orb.state) === 'listening'}
        statusLabel={statusLabel}
        text={transcriptText}
      />

      {/* Solo investigación con fuentes abandona temporalmente el modo voz-only. */}
      {compact && <OrbInfoPanel responseText={panelText} sources={panelSources} />}
    </div>
  );
}
