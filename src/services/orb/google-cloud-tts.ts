// Voz de la orbe (Google Cloud TTS).
// La SINTESIS ocurre en el proceso principal (electron/orb-tts.ts): es el unico
// que ve todas las variables del .env (la key de TTS no llegaba al renderer y se
// usaba otra key cuyo proyecto no tiene la API habilitada → 403 y voz muda).
// Aqui solo se decodifica el WAV a PCM para reproducirlo con WebAudio.

import { orbService } from '../orb-service';

export interface CloudSpeechAudio {
  pcm: Int16Array;
  sampleRate: number;
}

/** Sintetiza texto con la voz de Google Cloud configurada en el .env. */
export async function synthesizeCloudSpeech(text: string): Promise<CloudSpeechAudio> {
  const result = await orbService.synthesize(text);
  if (!result.success || !result.audioBase64) {
    throw new Error(result.error || 'No se pudo sintetizar la voz.');
  }
  return parseWavToPcm(result.audioBase64);
}

/** LINEAR16 llega como WAV (RIFF): extraer el chunk `data` y el sample rate real. */
function parseWavToPcm(base64Wav: string): CloudSpeechAudio {
  const binary = atob(base64Wav);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  const view = new DataView(bytes.buffer);
  let sampleRate = 24000;
  let dataOffset = -1;
  let dataLength = 0;

  // Recorrer chunks RIFF: [id 4B][size 4B LE][payload]. El header global ocupa 12B.
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const chunkId = String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
    const chunkSize = view.getUint32(offset + 4, true);
    if (chunkId === 'fmt ') {
      sampleRate = view.getUint32(offset + 12, true);
    } else if (chunkId === 'data') {
      dataOffset = offset + 8;
      dataLength = Math.min(chunkSize, bytes.length - dataOffset);
      break;
    }
    offset += 8 + chunkSize + (chunkSize % 2);
  }

  if (dataOffset < 0) throw new Error('El audio de Google Cloud TTS no tiene chunk de datos.');
  // Copia alineada: el offset del chunk data no siempre es multiplo de 2.
  const dataBytes = bytes.slice(dataOffset, dataOffset + dataLength);
  const pcm = new Int16Array(dataBytes.buffer, 0, Math.floor(dataBytes.length / 2));
  return { pcm, sampleRate };
}
