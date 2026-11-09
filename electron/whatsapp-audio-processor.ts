import { getSessionOpenAIClient } from './ai-provider/session-client';
import { transcribeChannelAudio } from './wa-agent/audio-transcription';

/** Compatibilidad de la entrada de audio: error público y sin contenido en logs. */
export async function processAudioMessage(buffer: Buffer, mimeType = 'audio/ogg'): Promise<string> {
  if (!buffer.length) return '';
  try { return await transcribeChannelAudio(await getSessionOpenAIClient(), buffer, mimeType); }
  catch { console.warn('[Audio] No se pudo transcribir el mensaje.'); return ''; }
}
