import { useCallback, useRef, useState } from 'react';

type SpeechWindow = typeof window & {
  SpeechRecognition?: new () => any;
  webkitSpeechRecognition?: new () => any;
};

export function useDictation(setInput: (updater: (current: string) => string) => void) {
  const [isRecording, setIsRecording] = useState(false);
  const speechRecRef = useRef<any>(null);
  const silenceTimerRef = useRef<number | null>(null);
  const finalTranscriptRef = useRef('');
  const shouldProcessRef = useRef(true);

  const stopDictation = useCallback((process: boolean) => {
    if (silenceTimerRef.current) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    shouldProcessRef.current = process;
    if (speechRecRef.current) {
      try {
        speechRecRef.current.stop();
      } catch {
        /* ignore browser stop races */
      }
    }
  }, []);

  const startDictation = useCallback(() => {
    const Ctor = (window as SpeechWindow).SpeechRecognition || (window as SpeechWindow).webkitSpeechRecognition;
    if (!Ctor) return;
    finalTranscriptRef.current = '';
    shouldProcessRef.current = true;
    const recognition = new Ctor();
    speechRecRef.current = recognition;
    recognition.lang = navigator.language?.startsWith('es') ? navigator.language : 'es-MX';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => setIsRecording(true);
    recognition.onresult = (event: any) => {
      let nextFinal = finalTranscriptRef.current;
      let nextInterim = '';
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const text = event.results[index]?.[0]?.transcript || '';
        if (event.results[index].isFinal) nextFinal = [nextFinal, text].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
        else nextInterim = [nextInterim, text].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
      }
      finalTranscriptRef.current = nextFinal;
      setInput((current) => [current.trimEnd(), nextFinal, nextInterim].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim());
      if (silenceTimerRef.current) window.clearTimeout(silenceTimerRef.current);
      if (nextFinal && !nextInterim) silenceTimerRef.current = window.setTimeout(() => stopDictation(true), 2500);
    };
    recognition.onerror = () => {
      speechRecRef.current = null;
      setIsRecording(false);
    };
    recognition.onend = () => {
      speechRecRef.current = null;
      if (silenceTimerRef.current) window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
      const transcript = finalTranscriptRef.current.trim();
      setIsRecording(false);
      if (shouldProcessRef.current && transcript) {
        setInput((current) => current.includes(transcript) ? current.trimEnd() : [current.trimEnd(), transcript].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim());
      }
    };
    recognition.start();
  }, [setInput, stopDictation]);

  const toggleDictation = useCallback(() => {
    if (isRecording) stopDictation(true);
    else startDictation();
  }, [isRecording, startDictation, stopDictation]);

  return { isRecording, stopDictation, toggleDictation };
}
