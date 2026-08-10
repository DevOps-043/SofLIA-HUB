import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MODELS } from '../../config';
import { getPublicAiErrorMessage, sendMessageStream } from '../../services/gemini-chat';
import type { ConversationMessage } from '../../services/gemini-chat/types';
import { orbService } from '../../services/orb-service';
import { synthesizeElevenLabsSpeech } from '../../services/orb/elevenlabs-tts';
import { OrbTtsPlayback } from '../../services/orb/tts-playback';
import type { OrbConversationState } from './orb-types';

export interface OrbSource {
  uri: string;
  title: string;
}

const CLOSE_COMMAND_REGEX = /^\s*(cierra|cierrate|adios|gracias,?\s+(soflia|sofia|suplia))\b/i;
// Presupuesto TOTAL de habla por turno: debe leer la respuesta completa
// (antes 300 chars cortaba tras ~2 parrafos). ElevenLabs acepta hasta 5000
// caracteres por solicitud, pero usamos bloques menores para reducir latencia.
// peticion, por eso el texto se trocea en bloques de hasta SPEECH_BLOCK_CHARS.
const SPEECH_MAX_CHARS = 4000;
const SPEECH_BLOCK_CHARS = 1200;
// Durante el streaming, un grupo de frases completas se manda a sintetizar en
// cuanto junta este tamano (~2-3 frases): esperar el stream completo dejaba
// 5-10s de silencio tras la primera frase. Es un punto medio entre latencia
// (bloques chicos) y prosodia natural de las voces Chirp (bloques grandes).
const SPEECH_CHUNK_TARGET_CHARS = 300;

function normalizeSpokenText(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/**
 * Maquina de estados de la orbe:
 * idle -> listening -> thinking -> (acting) -> speaking/info -> listening.
 *
 * Cada dictado y cada ejecucion del agente tiene un propietario. Los callbacks
 * asincronos solo pueden cambiar la UI si ese propietario sigue vigente.
 */
export function useOrbConversation() {
  const [state, setState] = useState<OrbConversationState>('idle');
  const [transcript, setTranscript] = useState('');
  const [userText, setUserText] = useState('');
  const [responseText, setResponseText] = useState('');
  const [sources, setSources] = useState<OrbSource[]>([]);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoVisible, setInfoVisible] = useState(false);
  const [ttsPlaying, setTtsPlaying] = useState(false);

  const playback = useMemo(() => new OrbTtsPlayback(), []);
  const historyRef = useRef<ConversationMessage[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const stateRef = useRef<OrbConversationState>('idle');
  const infoVisibleRef = useRef(false);
  const activeDictationSessionRef = useRef<string | null>(null);
  const latestDictationSessionRef = useRef<string | null>(null);
  const listeningGenerationRef = useRef(0);
  const listeningStartRef = useRef<Promise<void> | null>(null);
  const turnSequenceRef = useRef(0);
  const activeTurnRef = useRef<number | null>(null);
  const piperTurnRef = useRef<number | null>(null);
  const piperSpeechIdRef = useRef<string | null>(null);
  const piperPlaybackStartedRef = useRef(false);
  const pendingWakeRequestRef = useRef<Promise<{ success: boolean; wake?: boolean }> | null>(null);
  /** Motivo del último fallo ElevenLabs para mantener visible un error accionable. */
  const elevenLabsTtsErrorRef = useRef<string | null>(null);
  infoVisibleRef.current = infoVisible;

  const updateState = useCallback((nextState: OrbConversationState) => {
    stateRef.current = nextState;
    setState(nextState);
  }, []);

  /** Arranque idempotente: todos los disparadores comparten una sola transicion. */
  const startListening = useCallback((): Promise<void> => {
    if (listeningStartRef.current) return listeningStartRef.current;
    if (stateRef.current === 'listening' && activeDictationSessionRef.current) {
      return Promise.resolve();
    }

    const generation = ++listeningGenerationRef.current;
    const operation = (async () => {
      const speechId = piperSpeechIdRef.current;
      piperTurnRef.current = null;
      piperSpeechIdRef.current = null;
      piperPlaybackStartedRef.current = false;
      if (speechId) await orbService.stopSpeaking(speechId).catch(() => undefined);
      if (generation !== listeningGenerationRef.current) return;

      playback.stop();
      setTtsPlaying(false);
      setErrorMessage(null);
      setTranscript('');
      updateState('listening');

      const result = await orbService.startDictation().catch((error: unknown) => ({
        success: false,
        sessionId: undefined,
        error: error instanceof Error ? error.message : String(error),
      }));

      if (generation !== listeningGenerationRef.current) {
        if (result.success && result.sessionId) {
          await orbService.stopDictation(result.sessionId).catch(() => undefined);
        }
        return;
      }

      if (!result.success || !result.sessionId) {
        setErrorMessage(result.error ?? 'No se pudo iniciar la escucha.');
        updateState('idle');
        void orbService.conversationEnded(latestDictationSessionRef.current).catch(() => undefined);
        return;
      }

      activeDictationSessionRef.current = result.sessionId;
      latestDictationSessionRef.current = result.sessionId;
    })();

    listeningStartRef.current = operation;
    void operation.finally(() => {
      if (listeningStartRef.current === operation) listeningStartRef.current = null;
    });
    return operation;
  }, [playback, updateState]);

  const finishTurnAndListen = useCallback((turnId: number) => {
    if (activeTurnRef.current !== turnId) return;
    console.log('[Orb] Turno terminado: volviendo a escuchar.');
    activeTurnRef.current = null;
    abortRef.current = null;
    if (piperTurnRef.current === turnId) piperTurnRef.current = null;
    const speechId = piperSpeechIdRef.current;
    piperSpeechIdRef.current = null;
    piperPlaybackStartedRef.current = false;
    setTtsPlaying(false);
    if (speechId) void orbService.stopSpeaking(speechId).catch(() => undefined);
    void startListening();
  }, [startListening]);

  const windDown = useCallback((sessionId?: string | null) => {
    const endingSessionId = sessionId ?? latestDictationSessionRef.current;
    listeningGenerationRef.current += 1;
    activeDictationSessionRef.current = null;
    activeTurnRef.current = null;
    piperTurnRef.current = null;
    const speechId = piperSpeechIdRef.current;
    piperSpeechIdRef.current = null;
    piperPlaybackStartedRef.current = false;
    abortRef.current?.abort();
    abortRef.current = null;
    playback.stop();
    setTtsPlaying(false);
    if (speechId) void orbService.stopSpeaking(speechId).catch(() => undefined);
    void orbService.conversationEnded(endingSessionId).catch(() => undefined);
    // La orbe NO se oculta sola: queda visible en idle con la escucha pasiva
    // reactivada, lista para volver a escuchar con la wake word. Solo el boton
    // de cerrar (o el comando de voz "cierra") la esconde.
    updateState('idle');
  }, [playback, updateState]);

  const closeOrb = useCallback(() => {
    listeningGenerationRef.current += 1;
    const sessionId = activeDictationSessionRef.current;
    activeDictationSessionRef.current = null;
    activeTurnRef.current = null;
    piperTurnRef.current = null;
    const speechId = piperSpeechIdRef.current;
    piperSpeechIdRef.current = null;
    piperPlaybackStartedRef.current = false;
    abortRef.current?.abort();
    abortRef.current = null;
    if (sessionId) void orbService.stopDictation(sessionId).catch(() => undefined);
    if (speechId) void orbService.stopSpeaking(speechId).catch(() => undefined);
    playback.stop();
    setTtsPlaying(false);
    updateState('idle');
    setInfoVisible(false);
    orbService.hide();
  }, [playback, updateState]);

  /**
   * Ultimo recurso cuando el pipeline por bloques no llego a sonar: sintetiza el
   * texto completo de una vez. SofLIA usa la voz ElevenLabs configurada y no
   * degrada silenciosamente a otro proveedor o a una voz local distinta.
   */
  const speakEntireResponse = useCallback(async (fullText: string, turnId: number) => {
    if (activeTurnRef.current !== turnId) return;
    const speech = buildSpeechText(fullText);
    if (speech.length < 2) {
      finishTurnAndListen(turnId);
      return;
    }
    try {
      const audio = await synthesizeElevenLabsSpeech(speech);
      if (activeTurnRef.current !== turnId) return;
      setTtsPlaying(true);
      updateState(stateRef.current === 'info' ? 'info' : 'speaking');
      await playback.enqueueEncoded(audio.audioBase64);
      if (activeTurnRef.current !== turnId) return;
      playback.markTtsFinished();
      return;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      elevenLabsTtsErrorRef.current = reason;
      console.error('[Orb] Sin voz: ElevenLabs falló:', reason);
    }
    setErrorMessage(`No pude responder con voz: ${elevenLabsTtsErrorRef.current}`);
    setTtsPlaying(false);
  }, [finishTurnAndListen, playback, updateState]);

  /** Pipeline ElevenLabs protegido por el ID del turno, incluso después de cada await. */
  const createSpeechPipeline = useCallback((turnId: number, signal: AbortSignal) => {
    const pipelineState = {
      chain: Promise.resolve() as Promise<void>,
      ttsFailed: false,
      spokenChars: 0,
      started: false,
    };
    const isCurrent = () => activeTurnRef.current === turnId && !signal.aborted;

    playback.setOnDrained(() => {
      if (isCurrent()) finishTurnAndListen(turnId);
    });

    const pushSentence = (rawSentence: string) => {
      if (!isCurrent() || pipelineState.ttsFailed || pipelineState.spokenChars >= SPEECH_MAX_CHARS) return;
      const clean = buildSpeechText(rawSentence);
      if (clean.length < 2) {
        console.warn('[Orb] Fragmento descartado para voz (vacio tras normalizar):', JSON.stringify(rawSentence.slice(0, 60)));
        return;
      }
      pipelineState.spokenChars += clean.length;
      // PREFETCH: la sintesis de este bloque arranca YA, en paralelo con la de
      // los bloques anteriores; la cadena solo garantiza el ORDEN de reproduccion.
      // Serializar tambien la sintesis creaba silencios de varios segundos entre
      // frases (cada bloque esperaba la peticion completa del anterior).
      const audioPromise = synthesizeElevenLabsSpeech(clean);
      audioPromise.catch(() => undefined); // el error se maneja al reproducir; esto evita un unhandled rejection si el turno se aborta antes
      pipelineState.chain = pipelineState.chain.then(async () => {
        if (!isCurrent() || pipelineState.ttsFailed) return;
        try {
          const audio = await audioPromise;
          if (!isCurrent() || pipelineState.ttsFailed) return;
          await playback.enqueueEncoded(audio.audioBase64);
          if (!isCurrent() || pipelineState.ttsFailed) return;
          if (!pipelineState.started) {
            pipelineState.started = true;
            setTtsPlaying(true);
            updateState(stateRef.current === 'info' ? 'info' : 'speaking');
          }
        } catch (error) {
          if (!isCurrent()) return;
          pipelineState.ttsFailed = true;
          const reason = error instanceof Error ? error.message : String(error);
          elevenLabsTtsErrorRef.current = reason;
          console.warn('[Orb] ElevenLabs falló; la respuesta permanece visible sin cambiar de voz:', reason);
        }
      });
    };

    return { pipelineState, pushSentence };
  }, [finishTurnAndListen, playback, updateState]);

  const runAgent = useCallback(async (text: string, sourceSessionId: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    const turnId = ++turnSequenceRef.current;
    abortRef.current = controller;
    activeTurnRef.current = turnId;
    const isCurrent = () => activeTurnRef.current === turnId && !controller.signal.aborted;

    setUserText(text);
    setResponseText('');
    setSources([]);
    setActiveTool(null);
    setInfoVisible(false);
    updateState('thinking');
    elevenLabsTtsErrorRef.current = null;
    const { pipelineState, pushSentence } = createSpeechPipeline(turnId, controller.signal);
    controller.signal.addEventListener('abort', () => { pipelineState.ttsFailed = true; }, { once: true });

    try {
      const result = await sendMessageStream(text, historyRef.current, {
        model: MODELS.ORB,
        // La Orbe usa Gemini 3.6 Flash para Computer Use y SofLIA Pro para los
        // demás comandos cuando OpenAI está configurado.
        task: 'orb',
        signal: controller.signal,
        onToolCall: (toolCall) => {
          if (!isCurrent()) return;
          setActiveTool(toolCall?.name ?? null);
          updateState('acting');
        },
      });
      if (!isCurrent()) return;

      let accumulated = '';
      let speechBuffer = '';
      let firstSentenceSpoken = false;
      for await (const token of result.stream) {
        if (!isCurrent()) return;
        accumulated += token;
        setResponseText(accumulated);
        speechBuffer += token;
        const { sentences, rest } = extractCompleteSentences(speechBuffer);
        if (sentences.length === 0) continue;
        if (!firstSentenceSpoken) {
          // La primera frase sale sola y de inmediato: es la latencia percibida.
          pushSentence(sentences[0]);
          firstSentenceSpoken = true;
          speechBuffer = [...sentences.slice(1), rest].join(' ');
          continue;
        }
        // Las siguientes se agrupan y se sintetizan DURANTE el stream: esperar
        // al final de la generacion dejaba un hueco de varios segundos de voz.
        const completed = sentences.join(' ');
        if (completed.length >= SPEECH_CHUNK_TARGET_CHARS) {
          pushSentence(completed);
          speechBuffer = rest;
        }
      }
      // La cola restante va en bloques grandes (prosodia natural) que respetan
      // el limite por peticion del TTS; la cadena los reproduce en orden.
      for (const block of splitIntoSpeechBlocks(speechBuffer, SPEECH_BLOCK_CHARS)) {
        pushSentence(block);
      }

      const resolvedSources = await result.sources.catch(() => null);
      if (!isCurrent()) return;
      if (resolvedSources && resolvedSources.length > 0) {
        setSources(resolvedSources.map((source) => ({ uri: source.uri, title: source.title })));
        setInfoVisible(true);
        updateState('info');
      }

      historyRef.current = [
        ...historyRef.current,
        { role: 'user' as const, text },
        { role: 'model' as const, text: accumulated },
      ].slice(-12);
      setActiveTool(null);

      await pipelineState.chain;
      if (!isCurrent()) return;
      console.log('[Orb] Fin del turno del agente:', JSON.stringify({
        chars: accumulated.length,
        ttsIniciado: pipelineState.started,
        ttsElevenLabsFallo: pipelineState.ttsFailed,
        motivo: elevenLabsTtsErrorRef.current,
      }));

      if (!accumulated.trim()) {
        // Respuesta vacia: NO reiniciar la escucha (borraria este aviso y el
        // usuario solo veria "Escuchando" sin explicacion). Se queda en idle.
        console.error('[Orb] El agente no devolvio texto para esta peticion.');
        setErrorMessage('No obtuve respuesta del asistente. Di la palabra de activación para reintentar.');
        activeTurnRef.current = null;
        abortRef.current = null;
        setActiveTool(null);
        updateState('idle');
        void orbService.conversationEnded(sourceSessionId).catch(() => undefined);
        return;
      }
      if (pipelineState.started) {
        playback.markTtsFinished();
        return;
      }
      // Hay respuesta pero el TTS nunca arranco (nube fallo o el troceo no
      // produjo nada util): ultimo intento con el texto completo. Nunca se
      // vuelve a escuchar en silencio dejando la respuesta sin leer.
      await speakEntireResponse(accumulated, turnId);
    } catch (error) {
      if (!isCurrent()) return;
      console.error('[Orb] Error del agente:', error);
      // Mensaje sanitizado para el usuario: nunca filtrar detalles internos
      // (circuit breaker, cuota del proveedor, URLs de la API).
      setErrorMessage(getPublicAiErrorMessage(error));
      setActiveTool(null);
      windDown(sourceSessionId);
    }
  }, [createSpeechPipeline, playback, speakEntireResponse, updateState, windDown]);

  const handleDictationFinal = useCallback((sessionId: string, rawText: string) => {
    if (sessionId !== activeDictationSessionRef.current || stateRef.current !== 'listening') return;
    activeDictationSessionRef.current = null;
    latestDictationSessionRef.current = sessionId;
    setTranscript('');

    const text = rawText.replace(/\s+/g, ' ').trim();
    if (!text) {
      windDown(sessionId);
      return;
    }
    console.log('[Orb] Peticion reconocida:', { sessionId, text });
    if (CLOSE_COMMAND_REGEX.test(normalizeSpokenText(text))) {
      closeOrb();
      return;
    }
    void runAgent(text, sessionId);
  }, [closeOrb, runAgent, windDown]);

  useEffect(() => {
    if (!orbService.isAvailable()) {
      setErrorMessage('La API de la orbe no esta disponible.');
      return undefined;
    }

    // El booleano local invalida promesas del primer montaje de React.StrictMode.
    let active = true;
    orbService.onDictationPartial(({ sessionId, text }) => {
      if (!active || sessionId !== activeDictationSessionRef.current || stateRef.current !== 'listening') return;
      setTranscript(text);
    });
    orbService.onDictationFinal(({ sessionId, text }) => {
      if (active) handleDictationFinal(sessionId, text);
    });
    orbService.onDictationError(({ sessionId }) => {
      if (!active || sessionId !== activeDictationSessionRef.current) return;
      activeDictationSessionRef.current = null;
      latestDictationSessionRef.current = sessionId;
      windDown(sessionId);
    });
    orbService.onTtsChunk(({ speechId, audioBase64, sampleRate }) => {
      const turnId = piperTurnRef.current;
      if (!active || speechId !== piperSpeechIdRef.current
        || turnId === null || activeTurnRef.current !== turnId) return;
      if (!piperPlaybackStartedRef.current) {
        piperPlaybackStartedRef.current = true;
        setTtsPlaying(true);
        updateState(stateRef.current === 'info' ? 'info' : 'speaking');
      }
      playback.enqueueChunk(audioBase64, sampleRate);
    });
    orbService.onTtsEnd(({ speechId, interrupted, error }) => {
      const turnId = piperTurnRef.current;
      if (!active || speechId !== piperSpeechIdRef.current
        || turnId === null || activeTurnRef.current !== turnId) return;
      piperTurnRef.current = null;
      piperSpeechIdRef.current = null;
      piperPlaybackStartedRef.current = false;
      if (interrupted || error) {
        setTtsPlaying(false);
        playback.stop();
        if (error) console.warn('[Orb] El TTS local termino con error:', error);
        finishTurnAndListen(turnId);
        return;
      }
      playback.markTtsFinished();
    });
    orbService.onWake(() => {
      if (!active) return;
      if (stateRef.current === 'idle' || stateRef.current === 'info') void startListening();
    });

    // StrictMode ejecuta setup -> cleanup -> setup. Compartir el mismo PULL evita
    // consumir el wake en el montaje obsoleto y perderlo antes del segundo.
    const pendingWakeRequest = pendingWakeRequestRef.current ?? orbService.getPendingWake();
    pendingWakeRequestRef.current = pendingWakeRequest;
    void pendingWakeRequest
      .then(({ wake }) => {
        if (active && wake) void startListening();
      })
      .catch(() => undefined);

    return () => {
      active = false;
      listeningGenerationRef.current += 1;
      const sessionId = activeDictationSessionRef.current;
      activeDictationSessionRef.current = null;
      activeTurnRef.current = null;
      piperTurnRef.current = null;
      const speechId = piperSpeechIdRef.current;
      piperSpeechIdRef.current = null;
      piperPlaybackStartedRef.current = false;
      orbService.removeListeners();
      abortRef.current?.abort();
      abortRef.current = null;
      if (sessionId) void orbService.conversationEnded(sessionId).catch(() => undefined);
      if (speechId) void orbService.stopSpeaking(speechId).catch(() => undefined);
      playback.dispose();
    };
  }, [finishTurnAndListen, handleDictationFinal, playback, startListening, updateState, windDown]);

  return {
    state,
    transcript,
    userText,
    responseText,
    sources,
    activeTool,
    errorMessage,
    infoVisible,
    ttsPlaying,
    playback,
    startListening,
    closeOrb,
  };
}

/** Separa las frases completas del texto en streaming; `rest` sigue creciendo. */
export function extractCompleteSentences(buffer: string): { sentences: string[]; rest: string } {
  const parts = buffer.split(/(?<=[.!?…:;])\s+/);
  if (parts.length <= 1) return { sentences: [], rest: buffer };
  return { sentences: parts.slice(0, -1), rest: parts[parts.length - 1] };
}

/** Divide texto largo en bloques por frases, cada uno ≤ maxChars. */
export function splitIntoSpeechBlocks(text: string, maxChars: number): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.length <= maxChars) return [trimmed];
  const sentences = trimmed.split(/(?<=[.!?…:;])\s+/);
  const blocks: string[] = [];
  let current = '';
  for (const sentence of sentences) {
    if (current && current.length + sentence.length + 1 > maxChars) {
      blocks.push(current);
      current = sentence;
    } else {
      current += (current ? ' ' : '') + sentence;
    }
  }
  if (current) blocks.push(current);
  return blocks;
}

/**
 * Limpia markdown y NORMALIZA el texto para diccion natural del TTS:
 * unidades, simbolos, URLs y marcas de cita que el motor lee mal.
 */
export function buildSpeechText(markdown: string): string {
  const plain = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/\[\d+\]/g, ' ')
    .replace(/°\s*C\b/gi, ' grados')
    .replace(/°\s*F\b/gi, ' grados Fahrenheit')
    .replace(/(\d)\s*%/g, '$1 por ciento')
    .replace(/\bkm\/h\b/gi, ' kilómetros por hora')
    .replace(/\bm\/s\b/gi, ' metros por segundo')
    .replace(/\bhrs?\.\b/gi, ' horas')
    .replace(/(\d{1,2}):(\d{2})\s*h\b/gi, '$1:$2 horas')
    .replace(/[#*_`>|~-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (plain.length <= SPEECH_MAX_CHARS) return plain;
  const sentences = plain.split(/(?<=[.!?…])\s+/);
  let speech = '';
  for (const sentence of sentences) {
    if (speech.length + sentence.length + 1 > SPEECH_MAX_CHARS) break;
    speech += (speech ? ' ' : '') + sentence;
  }
  return speech || plain.slice(0, SPEECH_MAX_CHARS);
}
