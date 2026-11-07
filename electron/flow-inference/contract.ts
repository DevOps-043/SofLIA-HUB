import { FLOW_MAX_MEDIA_BASE64, type NativeFlowRequest } from '../../src/shared/native-flow';
const MAX_TEXT = 100_000;
const MAX_MEDIA = FLOW_MAX_MEDIA_BASE64;
function media(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_MEDIA && value.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(value);
}
/** Sólo acepta operaciones y campos conocidos, nunca modelo o URL arbitrarios. */
export function validateFlowRequest(raw: unknown): NativeFlowRequest {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Solicitud no válida.');
  const data = raw as Record<string, unknown>;
  const keys = Object.keys(data);
  if (data.kind === 'analysis' || data.kind === 'fallback') {
    if (keys.some(key => !['kind', 'text', 'image'].includes(key)) || typeof data.text !== 'string' || !data.text.trim() || data.text.length > MAX_TEXT || (data.image !== undefined && !media(data.image))) throw new Error('Solicitud no válida.');
    return { kind: data.kind, text: data.text, ...(data.image === undefined ? {} : { image: data.image as string }) };
  }
  if (data.kind === 'transcription') {
    if (keys.some(key => !['kind', 'audio', 'mimeType'].includes(key)) || !media(data.audio) || typeof data.mimeType !== 'string' || !/^audio\/(webm|ogg|wav|mpeg|mp4|mp3|mpga|m4a|x-m4a|flac)(;codecs=[a-zA-Z0-9,._-]+)?$/i.test(data.mimeType)) throw new Error('Audio no válido.');
    return { kind: 'transcription', audio: data.audio, mimeType: data.mimeType };
  }
  throw new Error('Operación no válida.');
}
