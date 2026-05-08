import type { MutableRefObject } from 'react';
import { transcribeAudio } from '../../services/flow-service';
import { getSupportedAudioMimeType } from './text-utils';
import type { ListeningMode } from './types';

interface StartAudioFallbackArgs {
  audioChunksRef: MutableRefObject<Blob[]>;
  audioMimeTypeRef: MutableRefObject<string>;
  audioStreamRef: MutableRefObject<MediaStream | null>;
  handleTranscriptResult: (rawText: string) => Promise<void>;
  mediaRecorderRef: MutableRefObject<MediaRecorder | null>;
  resetResult: () => void;
  resetTranscript: () => void;
  setErrorMessage: (message: string) => void;
  setIsListening: (value: boolean) => void;
  setIsProcessing: (value: boolean) => void;
  setListeningMode: (mode: ListeningMode) => void;
  shouldProcessAudioRef: MutableRefObject<boolean>;
  stopAudioStream: () => void;
}

export async function startAudioFallback({
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
}: StartAudioFallbackArgs) {
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
      if (event.data.size > 0) audioChunksRef.current.push(event.data);
    };

    mediaRecorderRef.current.onstop = async () => {
      const shouldProcess = shouldProcessAudioRef.current;
      const audioBlob = new Blob(audioChunksRef.current, { type: audioMimeTypeRef.current });
      stopAudioStream();
      mediaRecorderRef.current = null;
      setIsListening(false);
      setListeningMode(null);

      if (!shouldProcess) return;
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
}
