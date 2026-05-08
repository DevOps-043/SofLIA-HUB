import { useMemo, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { startAudioFallback } from './audio-fallback';
import { startSpeechRecognitionCapture } from './speech-recognition';
import { joinTranscript } from './text-utils';
import type { ListeningMode } from './types';

type TranscriptHandler = (rawText: string) => Promise<void>;

export function useFlowCaptureLifecycle() {
  const [isListening, setIsListening] = useState(false);
  const [listeningMode, setListeningMode] = useState<ListeningMode>(null);
  const [transcriptFinal, setTranscriptFinal] = useState('');
  const [transcriptInterim, setTranscriptInterim] = useState('');
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
  const liveTranscript = useMemo(() => joinTranscript(transcriptFinal, transcriptInterim), [transcriptFinal, transcriptInterim]);

  function clearSilenceTimer(): void {
    if (!silenceTimerRef.current) return;
    window.clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = null;
  }

  function resetTranscript(): void {
    finalTranscriptRef.current = '';
    interimTranscriptRef.current = '';
    setTranscriptFinal('');
    setTranscriptInterim('');
  }

  function stopAudioStream(): void {
    audioStreamRef.current?.getTracks().forEach((track) => track.stop());
    audioStreamRef.current = null;
  }

  function stopSpeechRecognition(shouldProcess: boolean): void {
    clearSilenceTimer();
    shouldProcessSpeechRef.current = shouldProcess;
    if (!speechRecognitionRef.current) return;
    try {
      speechRecognitionRef.current.stop();
    } catch {
      speechRecognitionRef.current = null;
      setIsListening(false);
      setListeningMode(null);
    }
  }

  function stopAudioRecording(shouldProcess: boolean): void {
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
  }

  function teardownCapture(shouldProcess: boolean): void {
    if (speechRecognitionRef.current) stopSpeechRecognition(shouldProcess);
    if (mediaRecorderRef.current) stopAudioRecording(shouldProcess);
    else stopAudioStream();
    clearSilenceTimer();
  }

  function startAudioFallbackCapture(handleTranscriptResult: TranscriptHandler, resetResult: () => void, setErrorMessage: Dispatch<SetStateAction<string>>, setIsProcessing: Dispatch<SetStateAction<boolean>>) {
    return startAudioFallback({ audioChunksRef, audioMimeTypeRef, audioStreamRef, handleTranscriptResult, mediaRecorderRef, resetResult, resetTranscript, setErrorMessage, setIsListening, setIsProcessing, setListeningMode, shouldProcessAudioRef, stopAudioStream });
  }

  function startSpeechRecognition(handleTranscriptResult: TranscriptHandler, resetResult: () => void, setErrorMessage: Dispatch<SetStateAction<string>>, setIsProcessing: Dispatch<SetStateAction<boolean>>) {
    return startSpeechRecognitionCapture({ clearSilenceTimer, finalTranscriptRef, handleTranscriptResult, interimTranscriptRef, resetResult, resetTranscript, setErrorMessage, setIsListening, setListeningMode, setTranscriptFinal, setTranscriptInterim, shouldProcessSpeechRef, silenceTimerRef, speechRecognitionRef, startAudioFallbackCapture: () => startAudioFallbackCapture(handleTranscriptResult, resetResult, setErrorMessage, setIsProcessing), stopSpeechRecognition });
  }

  return {
    isListening, listeningMode, liveTranscript, resetTranscript, setTranscriptFinal,
    setTranscriptInterim, startSpeechRecognition, stopAudioRecording,
    stopSpeechRecognition, teardownCapture, transcriptFinal, transcriptInterim,
  };
}

export type FlowCaptureLifecycle = ReturnType<typeof useFlowCaptureLifecycle>;
