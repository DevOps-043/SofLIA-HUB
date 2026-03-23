import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MarkdownRenderer } from './chat/MarkdownRenderer';
import {
  executeFlowAction,
  FlowAction,
  FlowAnalysisResult,
  processFlowInput,
  transcribeAudio,
} from '../services/flow-service';

interface FlowModeProps {
  isActive: boolean;
  onClose: () => void;
  onSendToChat: (text: string) => void;
}

type ListeningMode = 'speech' | 'audio' | null;
type ExecutionStatus = 'idle' | 'running' | 'success' | 'error';
type SpeechRecognitionConstructor = new () => any;
type FlowBridge = {
  insertText?: (text: string) => Promise<{ success?: boolean; error?: string; code?: string }>;
};

interface ExecutionState {
  status: ExecutionStatus;
  message: string;
  detail?: string;
}

function joinTranscript(...segments: Array<string | null | undefined>) {
  return segments
    .map((segment) => (segment || '').trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getSpeechRecognitionCtor(): SpeechRecognitionConstructor | null {
  const flowWindow = window as typeof window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };

  return flowWindow.SpeechRecognition || flowWindow.webkitSpeechRecognition || null;
}

function getSupportedAudioMimeType() {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) || '';
}

function shouldHandleAsAssistant(rawText: string) {
  const text = rawText.trim().toLowerCase();
  if (!text) {
    return false;
  }

  const commandStarts = /^(?:abre|abrir|busca|buscar|entra|entrar|ve a|ir a|navega|navegar|selecciona|seleccionar|haz|hacer|mueve|desplazate|desplázate|cierra|cerrar|responde|explica|analiza|resume|redacta|traduce|consulta|revisa|compara|organiza|crea|crear|envia|envía|manda)\b/;
  const uiOrSystemTerms = /\b(chatgpt|gmail|outlook|chrome|edge|whatsapp|google|youtube|calendario|conversacion|conversación|chat|ventana|pestana|pestaña|pagina|página|sitio|app|aplicacion|aplicación|carpeta|archivo)\b/;
  const compoundAction = /\b(y|luego|despues|después)\b/;

  return commandStarts.test(text) || (uiOrSystemTerms.test(text) && compoundAction.test(text));
}

export const FlowMode: React.FC<FlowModeProps> = ({ isActive, onClose, onSendToChat }) => {
  const [inputText, setInputText] = useState('');
  const [analysis, setAnalysis] = useState<FlowAnalysisResult | null>(null);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [listeningMode, setListeningMode] = useState<ListeningMode>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMode, setProcessingMode] = useState<'assistant' | 'dictation'>('assistant');
  const [errorMessage, setErrorMessage] = useState('');
  const [transcriptFinal, setTranscriptFinal] = useState('');
  const [transcriptInterim, setTranscriptInterim] = useState('');
  const [executionState, setExecutionState] = useState<ExecutionState>({ status: 'idle', message: '' });

  const speechRecognitionRef = useRef<any>(null);
  const shouldProcessSpeechRef = useRef(false);
  const finalTranscriptRef = useRef('');
  const interimTranscriptRef = useRef('');
  const silenceTimerRef = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioMimeTypeRef = useRef('audio/webm');
  const shouldProcessAudioRef = useRef(false);
  const requestSequenceRef = useRef(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const liveTranscript = useMemo(
    () => joinTranscript(transcriptFinal, transcriptInterim),
    [transcriptFinal, transcriptInterim],
  );

  const action = analysis?.action || null;
  const canExecuteAction = Boolean(action && analysis && analysis.missing.length === 0 && action.type !== 'send_to_chat');
  const showPanel = Boolean(
    isComposerOpen || isListening || isProcessing || analysis || errorMessage || executionState.status !== 'idle',
  );
  const panelLabel = isListening
    ? 'Escuchando'
    : isProcessing
      ? processingMode === 'dictation'
        ? 'Dictando'
        : 'Procesando'
      : analysis
        ? 'Respuesta'
        : 'Escritura';
  const flowApi = (window as typeof window & { flow?: FlowBridge }).flow;

  const clearSilenceTimer = () => {
    if (silenceTimerRef.current) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  };

  const resetTranscript = () => {
    finalTranscriptRef.current = '';
    interimTranscriptRef.current = '';
    setTranscriptFinal('');
    setTranscriptInterim('');
  };

  const resetResult = () => {
    setAnalysis(null);
    setExecutionState({ status: 'idle', message: '' });
    setErrorMessage('');
    setProcessingMode('assistant');
  };

  const stopAudioStream = () => {
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((track) => track.stop());
      audioStreamRef.current = null;
    }
  };

  const stopSpeechRecognition = (shouldProcess: boolean) => {
    clearSilenceTimer();
    shouldProcessSpeechRef.current = shouldProcess;
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch {
        speechRecognitionRef.current = null;
        setIsListening(false);
        setListeningMode(null);
      }
    }
  };

  const stopAudioRecording = (shouldProcess: boolean) => {
    shouldProcessAudioRef.current = shouldProcess;
    clearSilenceTimer();

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      return;
    }

    stopAudioStream();
    mediaRecorderRef.current = null;
    setIsListening(false);
    setListeningMode(null);
  };

  const teardownCapture = (shouldProcess: boolean) => {
    if (speechRecognitionRef.current) {
      stopSpeechRecognition(shouldProcess);
    }

    if (mediaRecorderRef.current) {
      stopAudioRecording(shouldProcess);
    } else {
      stopAudioStream();
    }

    clearSilenceTimer();
  };

  const captureScreenshot = async () => {
    try {
      if (window.screenCapture) {
        const screenshot = await window.screenCapture.captureScreen();
        return screenshot || undefined;
      }
    } catch (error) {
      console.error('Error capturing screen:', error);
    }

    return undefined;
  };

  const runAction = async (flowAction: FlowAction, analysisOverride?: FlowAnalysisResult | null) => {
    const currentAnalysis = analysisOverride || analysis;
    if (!currentAnalysis || executionState.status === 'running') {
      return;
    }

    if (flowAction.type === 'send_to_chat') {
      onSendToChat(currentAnalysis.chatPrompt || currentAnalysis.response || currentAnalysis.transcript);
      return;
    }

    if (flowAction.type === 'desktop_automation') {
      teardownCapture(false);
      onClose();
      await new Promise<void>((resolve) => window.setTimeout(resolve, 180));
    }

    setExecutionState({ status: 'running', message: flowAction.description || 'Ejecutando accion...' });

    try {
      const result = await executeFlowAction(flowAction);
      setExecutionState({
        status: result.success ? 'success' : 'error',
        message: result.message,
        detail: result.detail,
      });
    } catch (error: any) {
      setExecutionState({
        status: 'error',
        message: 'No pude completar la accion.',
        detail: error?.message || String(error),
      });
    }
  };

  const runFlowAnalysis = async (rawText: string) => {
    const text = rawText.trim();
    if (!text) {
      return;
    }

    const requestId = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestId;

    setIsProcessing(true);
    setProcessingMode('assistant');
    setErrorMessage('');
    setExecutionState({ status: 'idle', message: '' });
    setIsComposerOpen(false);
    setTranscriptFinal(text);
    setTranscriptInterim('');
    setAnalysis(null);

    try {
      const screenshot = await captureScreenshot();
      const result = await processFlowInput(text, screenshot);

      if (requestSequenceRef.current !== requestId) {
        return;
      }

      setAnalysis(result);
      setIsProcessing(false);

      const shouldAutoExecute =
        result.action &&
        result.missing.length === 0 &&
        (
          result.action.type === 'open_application' ||
          result.action.type === 'open_url' ||
          (result.action.type === 'desktop_automation' && result.action.autoExecute)
        );

      if (shouldAutoExecute) {
        await runAction(result.action!, result);
      }
    } catch (error: any) {
      if (requestSequenceRef.current === requestId) {
        setIsProcessing(false);
        setErrorMessage(error?.message || 'No pude procesar la solicitud.');
      }
    }
  };

  const handleTranscriptResult = async (rawText: string) => {
    const text = rawText.trim();
    if (!text) {
      return;
    }

    setTranscriptFinal(text);
    setTranscriptInterim('');

    if (isComposerOpen || shouldHandleAsAssistant(text)) {
      await runFlowAnalysis(text);
      return;
    }

    if (!flowApi?.insertText) {
      setErrorMessage('El dictado directo no esta disponible en esta ventana.');
      return;
    }

    setIsProcessing(true);
    setProcessingMode('dictation');
    setErrorMessage('');
    setAnalysis(null);
    setExecutionState({ status: 'idle', message: '' });

    try {
      const result = await flowApi.insertText(text);
      if (result?.success === false) {
        if (result?.code === 'NO_TARGET') {
          setIsProcessing(false);
          await runFlowAnalysis(text);
          return;
        }
        setIsProcessing(false);
        setErrorMessage(result.error || 'No pude insertar el texto en el campo activo.');
        return;
      }

      setIsProcessing(false);
      resetTranscript();
      resetResult();
      setInputText('');
      setIsComposerOpen(false);
      onClose();
    } catch (error: any) {
      setIsProcessing(false);
      setErrorMessage(error?.message || 'No pude insertar el texto en el campo activo.');
    }
  };

  const startAudioFallback = async () => {
    resetTranscript();
    resetResult();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });

      const mimeType = getSupportedAudioMimeType();
      audioStreamRef.current = stream;
      audioChunksRef.current = [];
      audioMimeTypeRef.current = mimeType || 'audio/webm';
      shouldProcessAudioRef.current = true;

      mediaRecorderRef.current = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      mediaRecorderRef.current.onstart = () => {
        setIsListening(true);
        setListeningMode('audio');
      };

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        const shouldProcess = shouldProcessAudioRef.current;
        const audioBlob = new Blob(audioChunksRef.current, { type: audioMimeTypeRef.current });

        stopAudioStream();
        mediaRecorderRef.current = null;
        setIsListening(false);
        setListeningMode(null);

        if (!shouldProcess) {
          return;
        }

        if (audioBlob.size < 512) {
          setErrorMessage('No detecte suficiente voz. Intenta de nuevo.');
          return;
        }

        setIsProcessing(true);
        try {
          const transcript = await transcribeAudio(audioBlob);
          if (!transcript.trim()) {
            setIsProcessing(false);
            setErrorMessage('No pude recuperar una instruccion clara del audio.');
            return;
          }

          await handleTranscriptResult(transcript);
        } catch (error: any) {
          setIsProcessing(false);
          setErrorMessage(error?.message || 'No pude transcribir el audio.');
        }
      };

      mediaRecorderRef.current.start(250);
    } catch (error: any) {
      setErrorMessage(error?.message || 'No pude acceder al microfono.');
      setIsListening(false);
      setListeningMode(null);
      stopAudioStream();
    }
  };

  const startSpeechRecognition = async () => {
    const Recognition = getSpeechRecognitionCtor();
    if (!Recognition) {
      await startAudioFallback();
      return;
    }

    resetTranscript();
    resetResult();

    try {
      const recognition = new Recognition();
      speechRecognitionRef.current = recognition;
      shouldProcessSpeechRef.current = true;

      recognition.lang = navigator.language?.startsWith('es') ? navigator.language : 'es-MX';
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
        setListeningMode('speech');
      };

      recognition.onresult = (event: any) => {
        let nextFinal = finalTranscriptRef.current;
        let nextInterim = '';

        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const result = event.results[index];
          const transcript = result?.[0]?.transcript || '';

          if (result.isFinal) {
            nextFinal = joinTranscript(nextFinal, transcript);
          } else {
            nextInterim = joinTranscript(nextInterim, transcript);
          }
        }

        finalTranscriptRef.current = nextFinal;
        interimTranscriptRef.current = nextInterim;
        setTranscriptFinal(nextFinal);
        setTranscriptInterim(nextInterim);

        clearSilenceTimer();
        if (nextFinal && !nextInterim) {
          silenceTimerRef.current = window.setTimeout(() => stopSpeechRecognition(true), 1350);
        }
      };

      recognition.onerror = async (event: any) => {
        if (event?.error === 'aborted') {
          return;
        }

        const hasTranscript = Boolean(joinTranscript(finalTranscriptRef.current, interimTranscriptRef.current));
        if (!hasTranscript && event?.error !== 'not-allowed' && event?.error !== 'service-not-allowed') {
          speechRecognitionRef.current = null;
          shouldProcessSpeechRef.current = false;
          setIsListening(false);
          setListeningMode(null);
          await startAudioFallback();
          return;
        }

        setErrorMessage('No pude escuchar bien. Puedes intentar otra vez o escribir la instruccion.');
      };

      recognition.onend = () => {
        const shouldProcess = shouldProcessSpeechRef.current;
        const transcript = joinTranscript(finalTranscriptRef.current, interimTranscriptRef.current);

        speechRecognitionRef.current = null;
        clearSilenceTimer();
        setIsListening(false);
        setListeningMode(null);
        shouldProcessSpeechRef.current = false;

        if (shouldProcess && transcript) {
          void handleTranscriptResult(transcript);
        } else if (shouldProcess) {
          setErrorMessage('No detecte una instruccion clara.');
        }
      };

      recognition.start();
    } catch {
      await startAudioFallback();
    }
  };

  const handleMicAction = async () => {
    if (isProcessing || executionState.status === 'running') {
      return;
    }

    if (isListening) {
      if (listeningMode === 'speech') {
        stopSpeechRecognition(true);
      } else if (listeningMode === 'audio') {
        stopAudioRecording(true);
      }
      return;
    }

    await startSpeechRecognition();
  };

  const handleManualTextSubmit = async () => {
    if (!inputText.trim() || isProcessing || executionState.status === 'running') {
      return;
    }

    const submittedText = inputText;
    setInputText('');
    await runFlowAnalysis(submittedText);
  };

  useEffect(() => {
    if (!isActive) {
      teardownCapture(false);
    }

    return () => teardownCapture(false);
  }, [isActive]);

  useEffect(() => {
    if (isComposerOpen) {
      window.setTimeout(() => textareaRef.current?.focus(), 40);
    }
  }, [isComposerOpen]);

  if (!isActive) {
    return null;
  }

  return (
    <div
      className="relative flex h-full w-full items-end justify-center px-4 pb-6 pt-6 sm:px-6 sm:pb-8"
      style={{ fontFamily: '"Aptos", "Segoe UI Variable Text", "Segoe UI", sans-serif' }}
    >
      <div className="relative z-10 flex w-full flex-col items-center gap-4">
        {showPanel && (
          <div className="pointer-events-auto w-full max-w-[560px] overflow-hidden rounded-[32px] border border-white/10 bg-[#07090d]/88 p-4 shadow-[0_30px_100px_-32px_rgba(0,0,0,0.95)] backdrop-blur-2xl">
            <div className="custom-scrollbar max-h-[calc(100vh-170px)] overflow-y-auto rounded-[26px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015))] p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <span className="rounded-full border border-[#214841] bg-[#0b1c19] px-3 py-1 text-[10px] uppercase tracking-[0.26em] text-[#9de7d6]">
                  {panelLabel}
                </span>
                {(analysis || liveTranscript || errorMessage || executionState.status !== 'idle') && (
                  <button
                    onClick={() => {
                      resetTranscript();
                      resetResult();
                    }}
                    className="inline-flex h-9 items-center gap-2 rounded-full border border-white/8 bg-white/[0.03] px-3 text-[11px] uppercase tracking-[0.22em] text-[#8ea3a0] transition hover:text-white"
                    aria-label="Limpiar respuesta y transcripcion"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 6h18" />
                      <path d="M8 6V4h8v2" />
                      <path d="m19 6-1 14H6L5 6" />
                      <path d="M10 11v6" />
                      <path d="M14 11v6" />
                    </svg>
                    <span>Limpiar</span>
                  </button>
                )}
              </div>

              {isComposerOpen && (
                <div className="mt-4">
                  <textarea
                    ref={textareaRef}
                    rows={3}
                    value={inputText}
                    onChange={(event) => setInputText(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        void handleManualTextSubmit();
                      }
                    }}
                    disabled={isProcessing || executionState.status === 'running'}
                    placeholder="Escribe una solicitud o pega un texto..."
                    className="custom-scrollbar min-h-[96px] w-full resize-none rounded-[22px] border border-white/8 bg-black/20 px-4 py-4 text-[15px] leading-7 text-white outline-none transition placeholder:text-[#708381] focus:border-[#7ef0de]/28 focus:bg-[#0d1316] disabled:opacity-60"
                  />
                </div>
              )}

              {(isListening || liveTranscript) && (
                <div className="mt-4 rounded-[24px] border border-white/8 bg-black/22 px-4 py-4">
                  <div className="text-[11px] uppercase tracking-[0.24em] text-[#76918d]">Transcripcion</div>
                  <p className="mt-3 text-[20px] leading-[1.35] text-white sm:text-[24px]">
                    {transcriptFinal}
                    {transcriptInterim && <span className="text-[#6c8380]"> {transcriptInterim}</span>}
                  </p>
                </div>
              )}

              {isProcessing && !analysis && (
                <div className="mt-4 rounded-[24px] border border-white/8 bg-black/20 px-4 py-4 text-[15px] text-[#d8e2e1]">
                  {processingMode === 'dictation'
                    ? 'Insertando el dictado en el campo activo...'
                    : 'Procesando tu solicitud...'}
                </div>
              )}

              {analysis && (
                <div className="mt-4 space-y-4">
                  <div className="rounded-[24px] border border-white/8 bg-black/20 p-4">
                    <div className="text-[11px] uppercase tracking-[0.24em] text-[#76918d]">Respuesta</div>
                    <div className="mt-3 text-[15px] leading-7 text-[#eef4f3]">
                      <MarkdownRenderer text={analysis.response} />
                    </div>
                  </div>

                  {analysis.missing.length > 0 && (
                    <div className="rounded-[24px] border border-[#4d3912] bg-[#24190a] p-4">
                      <div className="text-[11px] uppercase tracking-[0.24em] text-[#ffcf7a]">Falta informacion</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {analysis.missing.map((item) => (
                          <span key={item} className="rounded-full border border-[#5b4317] bg-[#2f220d] px-3 py-1.5 text-[12px] text-[#ffd998]">
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {action?.type === 'send_email' && (
                    <div className="rounded-[24px] border border-white/8 bg-[#0b1013] p-4 text-[14px] text-[#eef4f3]">
                      <div className="text-[11px] uppercase tracking-[0.24em] text-[#76918d]">Borrador de correo</div>
                      <div className="mt-3 space-y-2">
                        <div>Para: {action.to || 'Sin destinatario'}</div>
                        <div>Asunto: {action.subject || 'Sin asunto'}</div>
                        <div className="whitespace-pre-wrap rounded-[18px] border border-white/8 bg-black/20 px-3 py-3">
                          {action.body || 'Sin cuerpo'}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {executionState.status !== 'idle' && (
                <div className={`mt-4 rounded-[24px] border px-4 py-4 ${
                  executionState.status === 'success'
                    ? 'border-[#1d564a] bg-[#0b231f]'
                    : executionState.status === 'error'
                      ? 'border-[#5b2820] bg-[#26100d]'
                      : 'border-[#1f4750] bg-[#0b1820]'
                }`}>
                  <div className="text-[11px] uppercase tracking-[0.24em] text-[#8da3a0]">Estado</div>
                  <div className="mt-3 text-[15px] font-semibold text-white">{executionState.message}</div>
                  {executionState.detail && <div className="mt-2 text-[13px] leading-6 text-[#c1cfce]">{executionState.detail}</div>}
                </div>
              )}

              {errorMessage && (
                <div className="mt-4 rounded-[24px] border border-[#5b2921] bg-[#23100d] px-4 py-4 text-[13px] text-[#ffb7a7]">
                  {errorMessage}
                </div>
              )}

              {canExecuteAction && action && (
                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/8 pt-4">
                  <button
                    onClick={() => void runAction(action)}
                    disabled={executionState.status === 'running'}
                    className="rounded-full bg-[#7ef0de] px-4 py-2.5 text-[13px] font-semibold text-[#051110] transition hover:brightness-105 disabled:opacity-55"
                  >
                    {action.label}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-white/10 bg-[#07090d]/86 px-2.5 py-2.5 shadow-[0_20px_64px_-32px_rgba(0,0,0,0.95)] backdrop-blur-2xl">
          <button
            onClick={() => {
              setIsComposerOpen((prev) => !prev);
            }}
            className={`flex h-10 w-10 items-center justify-center rounded-full border transition ${
              isComposerOpen
                ? 'border-[#7ef0de]/30 bg-[#0d1b1a] text-[#9de7d6]'
                : 'border-white/8 bg-white/[0.03] text-[#90a4a1] hover:text-white'
            }`}
            aria-label="Abrir escritura"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
            </svg>
          </button>

          <button
            onClick={() => void handleMicAction()}
            disabled={isProcessing || executionState.status === 'running'}
            className={`relative flex h-14 w-14 items-center justify-center rounded-full transition ${
              isListening
                ? 'bg-[#7ef0de] text-[#041111] shadow-[0_0_0_6px_rgba(126,240,222,0.14)]'
                : 'bg-white text-[#0a1114] shadow-[0_12px_28px_-18px_rgba(255,255,255,0.45)]'
            } disabled:opacity-55`}
            aria-label={isListening ? 'Detener microfono' : 'Activar microfono'}
          >
            {isListening ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <rect x="7" y="7" width="10" height="10" rx="2" />
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3">
                <path d="M12 3a3 3 0 0 0-3 3v5a3 3 0 1 0 6 0V6a3 3 0 0 0-3-3Z" />
                <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
                <path d="M12 18v3" />
                <path d="M8 21h8" />
              </svg>
            )}
          </button>

          <button
            onClick={() => {
              teardownCapture(false);
              resetTranscript();
              resetResult();
              setInputText('');
              setIsComposerOpen(false);
              onClose();
            }}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/8 bg-white/[0.03] text-[#90a4a1] transition hover:text-white"
            aria-label="Cerrar voz"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};
