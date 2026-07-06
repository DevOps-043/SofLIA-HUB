import { useCallback, useRef, useState } from 'react';
import { transcribeAudio } from '../../../services/flow-service';

const MIN_AUDIO_BYTES = 512;
const DEFAULT_AUDIO_MIME_TYPE = 'audio/webm';

export function useDictation(setInput: (updater: (current: string) => string) => void) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioMimeTypeRef = useRef(DEFAULT_AUDIO_MIME_TYPE);
  const shouldProcessRef = useRef(true);

  const stopAudioStream = useCallback(() => {
    audioStreamRef.current?.getTracks().forEach((track) => track.stop());
    audioStreamRef.current = null;
  }, []);

  const stopDictation = useCallback((process: boolean) => {
    shouldProcessRef.current = process;
    const recorder = mediaRecorderRef.current;
    if (!recorder) {
      stopAudioStream();
      setIsRecording(false);
      return;
    }
    if (recorder.state !== 'inactive') recorder.stop();
  }, [stopAudioStream]);

  const startDictation = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setErrorMessage('El microfono no esta disponible en esta ventana.');
      return;
    }

    setErrorMessage(null);
    setIsTranscribing(false);
    shouldProcessRef.current = true;
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      const mimeType = getSupportedAudioMimeType();
      audioStreamRef.current = stream;
      audioMimeTypeRef.current = mimeType || DEFAULT_AUDIO_MIME_TYPE;
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.onstart = () => setIsRecording(true);
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        setErrorMessage('No pude grabar el audio del microfono.');
        setIsRecording(false);
        setIsTranscribing(false);
        stopAudioStream();
        mediaRecorderRef.current = null;
      };
      recorder.onstop = async () => {
        const shouldProcess = shouldProcessRef.current;
        const audioBlob = new Blob(audioChunksRef.current, { type: audioMimeTypeRef.current });
        mediaRecorderRef.current = null;
        audioChunksRef.current = [];
        setIsRecording(false);
        stopAudioStream();

        if (!shouldProcess) return;
        if (audioBlob.size < MIN_AUDIO_BYTES) {
          setErrorMessage('No detecte suficiente voz. Intenta de nuevo.');
          return;
        }

        setIsTranscribing(true);
        try {
          const transcript = (await transcribeAudio(audioBlob)).trim();
          if (!transcript) {
            setErrorMessage('No pude recuperar una frase clara del audio.');
            return;
          }
          setInput((current) => appendTranscript(current, transcript));
        } catch (error: any) {
          console.error('Dictation transcription error:', error);
          setErrorMessage(error?.message || 'No pude transcribir el audio.');
        } finally {
          setIsTranscribing(false);
        }
      };

      recorder.start(250);
    } catch (error: any) {
      const name = String(error?.name || '');
      const message = name === 'NotAllowedError'
        ? 'Permiso de microfono denegado.'
        : name === 'NotFoundError'
          ? 'No se encontro ningun microfono.'
          : error?.message || 'No pude acceder al microfono.';
      setErrorMessage(message);
      setIsRecording(false);
      setIsTranscribing(false);
      stopAudioStream();
      mediaRecorderRef.current = null;
    }
  }, [setInput, stopAudioStream]);

  const toggleDictation = useCallback(() => {
    if (isRecording || mediaRecorderRef.current) stopDictation(true);
    else void startDictation();
  }, [isRecording, startDictation, stopDictation]);

  return { errorMessage, isRecording, isTranscribing, stopDictation, toggleDictation };
}

function getSupportedAudioMimeType(): string {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) || '';
}

function appendTranscript(current: string, transcript: string): string {
  const normalizedTranscript = transcript.replace(/\s+/g, ' ').trim();
  if (!normalizedTranscript) return current;
  if (current.includes(normalizedTranscript)) return current.trimEnd();
  return [current.trimEnd(), normalizedTranscript].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}
