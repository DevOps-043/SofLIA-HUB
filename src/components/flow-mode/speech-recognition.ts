import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { ListeningMode } from './types';
import { getSpeechRecognitionCtor, joinTranscript } from './text-utils';

interface SpeechRecognitionCaptureArgs {
  clearSilenceTimer: () => void;
  finalTranscriptRef: MutableRefObject<string>;
  handleTranscriptResult: (text: string) => Promise<void>;
  interimTranscriptRef: MutableRefObject<string>;
  resetResult: () => void;
  resetTranscript: () => void;
  silenceTimerRef: MutableRefObject<number | null>;
  setErrorMessage: (message: string) => void;
  setIsListening: Dispatch<SetStateAction<boolean>>;
  setListeningMode: Dispatch<SetStateAction<ListeningMode>>;
  setTranscriptFinal: Dispatch<SetStateAction<string>>;
  setTranscriptInterim: Dispatch<SetStateAction<string>>;
  shouldProcessSpeechRef: MutableRefObject<boolean>;
  speechRecognitionRef: MutableRefObject<any>;
  startAudioFallbackCapture: () => Promise<void>;
  stopSpeechRecognition: (shouldProcess: boolean) => void;
}

export async function startSpeechRecognitionCapture(args: SpeechRecognitionCaptureArgs): Promise<void> {
  const Recognition = getSpeechRecognitionCtor();
  if (!Recognition) {
    await args.startAudioFallbackCapture();
    return;
  }

  args.resetTranscript();
  args.resetResult();

  try {
    const recognition = new Recognition();
    args.speechRecognitionRef.current = recognition;
    args.shouldProcessSpeechRef.current = true;
    recognition.lang = navigator.language?.startsWith('es') ? navigator.language : 'es-MX';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => {
      args.setIsListening(true);
      args.setListeningMode('speech');
    };
    recognition.onresult = (event: any) => {
      let nextFinal = args.finalTranscriptRef.current;
      let nextInterim = '';
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result?.[0]?.transcript || '';
        if (result.isFinal) nextFinal = joinTranscript(nextFinal, transcript);
        else nextInterim = joinTranscript(nextInterim, transcript);
      }
      args.finalTranscriptRef.current = nextFinal;
      args.interimTranscriptRef.current = nextInterim;
      args.setTranscriptFinal(nextFinal);
      args.setTranscriptInterim(nextInterim);
      args.clearSilenceTimer();
      if (nextFinal && !nextInterim) {
        args.silenceTimerRef.current = window.setTimeout(() => args.stopSpeechRecognition(true), 1350);
      }
    };
    recognition.onerror = async (event: any) => {
      if (event?.error === 'aborted') return;
      const hasTranscript = Boolean(joinTranscript(args.finalTranscriptRef.current, args.interimTranscriptRef.current));
      if (!hasTranscript && event?.error !== 'not-allowed' && event?.error !== 'service-not-allowed') {
        args.speechRecognitionRef.current = null;
        args.shouldProcessSpeechRef.current = false;
        args.setIsListening(false);
        args.setListeningMode(null);
        await args.startAudioFallbackCapture();
        return;
      }
      args.setErrorMessage('No pude escuchar bien. Puedes intentar otra vez o escribir la instruccion.');
    };
    recognition.onend = () => finishSpeechRecognition(args);
    recognition.start();
  } catch {
    await args.startAudioFallbackCapture();
  }
}

function finishSpeechRecognition(args: SpeechRecognitionCaptureArgs): void {
  const shouldProcess = args.shouldProcessSpeechRef.current;
  const transcript = joinTranscript(args.finalTranscriptRef.current, args.interimTranscriptRef.current);
  args.speechRecognitionRef.current = null;
  args.clearSilenceTimer();
  args.setIsListening(false);
  args.setListeningMode(null);
  args.shouldProcessSpeechRef.current = false;
  if (shouldProcess && transcript) void args.handleTranscriptResult(transcript);
  else if (shouldProcess) args.setErrorMessage('No detecte una instruccion clara.');
}
