import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FlowModeControls } from './flow-mode/FlowModeControls';
import { FlowModePanel } from './flow-mode/FlowModePanel';
import type {
  ExecutionState,
  FlowBridge,
  FlowModeProps,
  ListeningMode,
} from './flow-mode/types';
import {
  getSpeechRecognitionCtor,
  joinTranscript,
  shouldHandleAsAssistant,
} from './flow-mode/text-utils';
import { startAudioFallback } from './flow-mode/audio-fallback';
import {
  executeFlowAction,
  FlowAction,
  FlowAnalysisResult,
  processFlowInput,
} from '../services/flow-service';

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

  const startAudioFallbackCapture = () => startAudioFallback({
    audioChunksRef,
    audioMimeTypeRef,
    audioStreamRef,
    handleTranscriptResult,
    mediaRecorderRef,
    resetResult,
    resetTranscript,
    setErrorMessage,
    setIsListening,
    setIsProcessing,
    setListeningMode,
    shouldProcessAudioRef,
    stopAudioStream,
  });
  const startSpeechRecognition = async () => {
    const Recognition = getSpeechRecognitionCtor();
    if (!Recognition) {
      await startAudioFallbackCapture();
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
          await startAudioFallbackCapture();
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
      await startAudioFallbackCapture();
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

  const closeFlowMode = () => {
    teardownCapture(false);
    resetTranscript();
    resetResult();
    setInputText('');
    setIsComposerOpen(false);
    onClose();
  };

  return (
    <div
      className="relative flex h-full w-full items-end justify-center px-4 pb-6 pt-6 sm:px-6 sm:pb-8"
      style={{ fontFamily: '"Aptos", "Segoe UI Variable Text", "Segoe UI", sans-serif' }}
    >
      <div className="relative z-10 flex w-full flex-col items-center gap-4">
        <FlowModePanel
          action={action}
          analysis={analysis}
          canExecuteAction={canExecuteAction}
          errorMessage={errorMessage}
          executionState={executionState}
          handleManualTextSubmit={handleManualTextSubmit}
          inputText={inputText}
          isComposerOpen={isComposerOpen}
          isListening={isListening}
          isProcessing={isProcessing}
          liveTranscript={liveTranscript}
          panelLabel={panelLabel}
          processingMode={processingMode}
          resetResult={resetResult}
          resetTranscript={resetTranscript}
          runAction={runAction}
          setInputText={setInputText}
          showPanel={showPanel}
          textareaRef={textareaRef}
          transcriptFinal={transcriptFinal}
          transcriptInterim={transcriptInterim}
        />
        <FlowModeControls
          closeFlowMode={closeFlowMode}
          handleMicAction={handleMicAction}
          isComposerOpen={isComposerOpen}
          isListening={isListening}
          isProcessing={isProcessing}
          isRunning={executionState.status === 'running'}
          setIsComposerOpen={setIsComposerOpen}
        />
      </div>
    </div>
  );
};
