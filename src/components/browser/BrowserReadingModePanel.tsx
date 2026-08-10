import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  integratedBrowserService,
  type BrowserReadingContent,
  type BrowserReadingSpeech,
  type BrowserReadingToolbarActionName,
  type BrowserReadingWordTiming,
} from '../../services/integrated-browser-service';
import {
  buildReadingSegments,
  findTimingAtTime,
  SPEECH_PREFETCH_AHEAD,
  SPEECH_SEGMENT_MAX_CHARS,
} from './browser-reading-utils';

type PlaybackStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'completed' | 'error';

const PLAYBACK_SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2] as const;

export function BrowserReadingModePanel(props: {
  content: BrowserReadingContent;
  onClose: () => void;
}) {
  const { onClose } = props;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const playSegmentRef = useRef<(index: number, seekTime?: number) => Promise<void>>(async () => undefined);
  const toolbarActionRef = useRef<(action: BrowserReadingToolbarActionName) => void>(() => undefined);
  const mountedRef = useRef(true);
  const requestEpochRef = useRef(0);
  const generatedRef = useRef(new Map<number, BrowserReadingSpeech>());
  const pendingRef = useRef(new Map<number, { requestId: string; promise: Promise<BrowserReadingSpeech | null> }>());
  const failedRef = useRef(new Map<number, Error>());
  const activeSegmentRef = useRef(0);
  const lastHighlightRef = useRef<string | null>(null);
  const [status, setStatus] = useState<PlaybackStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [speed, setSpeed] = useState(1);
  const [activeSegment, setActiveSegment] = useState(0);
  const segments = useMemo(() => buildReadingSegments(props.content.text, SPEECH_SEGMENT_MAX_CHARS), [props.content.text]);

  const updateHighlight = useCallback((timing?: BrowserReadingWordTiming) => {
    const signature = timing ? `${timing.start}:${timing.end}` : 'clear';
    if (lastHighlightRef.current === signature) return;
    lastHighlightRef.current = signature;
    void integratedBrowserService.highlightReadingRange({
      readingId: props.content.readingId,
      start: timing?.start,
      end: timing?.end,
    }).catch(() => undefined);
  }, [props.content.readingId]);

  const releaseAudio = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
    audioRef.current = null;
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    audioUrlRef.current = null;
  }, []);

  const cancelPending = useCallback(() => {
    requestEpochRef.current += 1;
    pendingRef.current.clear();
    failedRef.current.clear();
    void integratedBrowserService.cancelReadingSpeech({ readingId: props.content.readingId }).catch(() => undefined);
  }, [props.content.readingId]);

  const handlePlaybackError = useCallback((reason: unknown) => {
    if (!mountedRef.current) return;
    setStatus('error');
    setError(reason instanceof Error ? reason.message : String(reason));
  }, []);

  const synthesizeSegment = useCallback((index: number): Promise<BrowserReadingSpeech | null> => {
    const cached = generatedRef.current.get(index);
    if (cached) return Promise.resolve(cached);
    const failed = failedRef.current.get(index);
    if (failed) return Promise.reject(failed);
    const pending = pendingRef.current.get(index);
    if (pending) return pending.promise;
    const segment = segments[index];
    if (!segment) {
      lecturaLog(`sintesis ${index}: no hay segmento (segments=${segments.length})`);
      return Promise.resolve(null);
    }

    const epoch = requestEpochRef.current;
    const requestId = createRequestId();
    const promise = integratedBrowserService.synthesizeReadingSegment({
      readingId: props.content.readingId,
      requestId,
      start: segment.start,
      end: segment.end,
    }).then((response) => {
      if (!mountedRef.current || epoch !== requestEpochRef.current) {
        lecturaLog(`sintesis ${index}: respuesta descartada (montado=${mountedRef.current}, epoca=${epoch} vs ${requestEpochRef.current})`);
        return null;
      }
      lecturaLog(`sintesis ${index}: respuesta success=${response.success}, speech=${Boolean(response.speech)}, error=${response.error ?? 'ninguno'}`);
      if (!response.success || !response.speech) throw new Error(response.error || 'No se pudo generar la narración.');
      failedRef.current.delete(index);
      generatedRef.current.set(index, response.speech);
      return response.speech;
    }).catch((reason: unknown) => {
      const failure = reason instanceof Error ? reason : new Error(String(reason));
      if (mountedRef.current && epoch === requestEpochRef.current) failedRef.current.set(index, failure);
      throw failure;
    }).finally(() => {
      const current = pendingRef.current.get(index);
      if (current?.requestId === requestId) pendingRef.current.delete(index);
    });
    pendingRef.current.set(index, { requestId, promise });
    return promise;
  }, [props.content.readingId, segments]);

  const prefetchAfter = useCallback((index: number) => {
    for (let offset = 1; offset <= SPEECH_PREFETCH_AHEAD; offset += 1) {
      const next = index + offset;
      if (!segments[next] || generatedRef.current.has(next) || pendingRef.current.has(next)) continue;
      void synthesizeSegment(next).catch(() => undefined);
    }
  }, [segments, synthesizeSegment]);

  const playSegment = useCallback(async (index: number, seekTime = 0) => {
    const segment = segments[index];
    if (!segment) {
      setStatus('completed');
      updateHighlight();
      return;
    }
    releaseAudio();
    setError(null);
    setStatus('loading');
    setActiveSegment(index);
    activeSegmentRef.current = index;

    const speech = await synthesizeSegment(index);
    // Cada motivo de abandono se distingue: los tres dejaban el estado en
    // "generando audio" sin rastro, que es como se veia el fallo.
    if (!speech) {
      lecturaLog(`segmento ${index}: la sintesis no devolvio audio`);
      handlePlaybackError(new Error('ElevenLabs no devolvio audio para este fragmento.'));
      return;
    }
    if (!mountedRef.current) {
      lecturaLog(`segmento ${index}: el panel se desmonto durante la sintesis`);
      return;
    }
    if (activeSegmentRef.current !== index) {
      lecturaLog(`segmento ${index}: descartado, el activo es ${activeSegmentRef.current}`);
      return;
    }
    lecturaLog(`segmento ${index}: audio recibido (${speech.audioBase64.length} chars base64, ${speech.timings.length} tiempos)`);

    // Anticipa la cola en cuanto llega el primer lote. Esperar a `onplay`
    // agregaba decodificación y buffering local a la ruta crítica.
    prefetchAfter(index);

    const blob = base64ToBlob(speech.audioBase64, speech.mimeType);
    lecturaLog(`segmento ${index}: blob ${blob.size} bytes (${speech.mimeType})`);
    const url = URL.createObjectURL(blob);
    audioUrlRef.current = url;
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.preload = 'auto';
    audio.playbackRate = speed;
    audio.onloadedmetadata = () => {
      const duration = Number.isFinite(audio.duration) ? audio.duration : speech.durationSeconds;
      if (seekTime > 0) audio.currentTime = Math.min(seekTime, Math.max(0, duration - 0.05));
    };
    audio.ontimeupdate = () => updateHighlight(findTimingAtTime(speech.timings, audio.currentTime) ?? undefined);
    audio.onplay = () => {
      setStatus('playing');
    };
    audio.onpause = () => {
      if (!audio.ended && mountedRef.current) setStatus('paused');
    };
    audio.onerror = () => {
      lecturaLog(`segmento ${index}: error del elemento de audio (${audio.error?.code ?? 'sin codigo'})`);
      handlePlaybackError(new Error('No se pudo reproducir el audio generado.'));
    };
    audio.onended = () => {
      if (!mountedRef.current) return;
      const next = activeSegmentRef.current + 1;
      if (next < segments.length) void playSegmentRef.current(next).catch(handlePlaybackError);
      else {
        setStatus('completed');
        updateHighlight();
      }
    };
    lecturaLog(`segmento ${index}: llamando a play()`);
    await audio.play().catch((error: unknown) => {
      lecturaLog(`segmento ${index}: play() rechazado: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    });
    lecturaLog(`segmento ${index}: play() aceptado`);
  }, [handlePlaybackError, prefetchAfter, releaseAudio, segments, speed, synthesizeSegment, updateHighlight]);

  useEffect(() => {
    playSegmentRef.current = playSegment;
  }, [playSegment]);

  const togglePlayback = useCallback(() => {
    const audio = audioRef.current;
    if (status === 'playing' && audio) {
      audio.pause();
      return;
    }
    if (status === 'paused' && audio) {
      void audio.play().catch(handlePlaybackError);
      return;
    }
    const nextSegment = status === 'completed' ? 0 : activeSegment;
    // Un reintento solo ocurre por un nuevo gesto del usuario; la cola no repite
    // automáticamente solicitudes fallidas que pueden consumir cuota.
    if (status === 'error') failedRef.current.delete(nextSegment);
    void playSegment(nextSegment).catch(handlePlaybackError);
  }, [activeSegment, handlePlaybackError, playSegment, status]);

  const stopPlayback = useCallback(() => {
    cancelPending();
    releaseAudio();
    updateHighlight();
    setStatus('idle');
  }, [cancelPending, releaseAudio, updateHighlight]);

  const changeSpeed = useCallback((direction: -1 | 1) => {
    setSpeed((current) => {
      const currentIndex = PLAYBACK_SPEEDS.indexOf(current as (typeof PLAYBACK_SPEEDS)[number]);
      return PLAYBACK_SPEEDS[Math.max(0, Math.min(PLAYBACK_SPEEDS.length - 1, currentIndex + direction))];
    });
  }, []);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed]);

  useEffect(() => {
    void integratedBrowserService.syncReadingToolbar({
      readingId: props.content.readingId,
      status,
      speed,
      message: error || undefined,
    }).catch(() => undefined);
  }, [error, props.content.readingId, speed, status]);

  const close = useCallback(() => {
    stopPlayback();
    onClose();
  }, [onClose, stopPlayback]);

  useEffect(() => {
    toolbarActionRef.current = (action) => {
      if (action === 'toggle') togglePlayback();
      else if (action === 'stop') stopPlayback();
      else if (action === 'speed-down') changeSpeed(-1);
      else if (action === 'speed-up') changeSpeed(1);
      else if (action === 'close') close();
    };
  }, [changeSpeed, close, stopPlayback, togglePlayback]);

  useEffect(() => {
    let canceled = false;
    void (async () => {
      while (!canceled) {
        const response = await integratedBrowserService.waitForReadingToolbarAction({
          readingId: props.content.readingId,
        }).catch(() => null);
        if (canceled || !response?.success || !response.toolbarAction || response.toolbarAction.action === 'closed') break;
        toolbarActionRef.current(response.toolbarAction.action);
      }
    })();
    return () => { canceled = true; };
  }, [props.content.readingId]);

  useEffect(() => {
    // La bandera se repone en cada montaje. Sin esto, el ciclo montar-desmontar
    // -remontar del modo estricto la dejaba en false para siempre y toda
    // respuesta de sintesis se descartaba en silencio.
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cancelPending();
      releaseAudio();
      updateHighlight();
    };
  }, [cancelPending, releaseAudio, updateHighlight]);

  return (
    <output
      className="sr-only"
      data-testid="browser-reading-mode"
      aria-live="polite"
      aria-label="Controlador del modo lectura"
    >
      {error || `${status} · Segmento ${Math.min(activeSegment + 1, segments.length)} de ${segments.length}`}
    </output>
  );
}

function base64ToBlob(value: string, type: string): Blob {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type });
}

function createRequestId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `reading-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Traza del camino de reproduccion; sin ella los abandonos son invisibles. */
function lecturaLog(mensaje: string): void {
  console.log('[ModoLectura] ' + mensaje);
}
