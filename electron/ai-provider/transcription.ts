import { toFile, type OpenAI } from 'openai';

export const TRANSCRIPTION_MODEL = 'gpt-transcribe';
const AUDIO_EXTENSIONS: Record<string, string> = {
  'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/wav': 'wav', 'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3', 'audio/mpga': 'mpga', 'audio/mp4': 'mp4', 'audio/m4a': 'm4a',
  'audio/x-m4a': 'm4a', 'audio/flac': 'flac',
};

/** Conserva los bytes y el contenedor del canal; nunca disfraza formatos como OGG. */
export async function transcribeAudio(client: OpenAI, audio: Buffer, declaredMime: string, signal?: AbortSignal): Promise<string> {
  const mimeType = declaredMime.split(';')[0].trim().toLowerCase();
  const extension = AUDIO_EXTENSIONS[mimeType];
  if (!extension || !audio.length || audio.length > 25_000_000) throw new Error('Formato o tamaño de audio no admitido.');
  const bounded = signal ? AbortSignal.any([signal, AbortSignal.timeout(90_000)]) : AbortSignal.timeout(90_000);
  bounded.throwIfAborted();
  const file = await toFile(audio, `grabacion.${extension}`, { type: mimeType });
  bounded.throwIfAborted();
  const response = await client.audio.transcriptions.create({ model: TRANSCRIPTION_MODEL, file }, { signal: bounded });
  bounded.throwIfAborted();
  if (typeof response.text !== 'string' || response.text.length > 200_000) throw new Error('Transcripción no válida.');
  return response.text.trim();
}
