import type { TelegramState } from './types';

export function ensureTelegramConfigured(state: TelegramState): void {
  if (!state.config.botToken.trim()) {
    throw new Error('Configura el bot token de Telegram antes de usar este canal.');
  }
}

/** Tope de descarga de audio entrante, alineado con el limite de la Bot API. */
const TELEGRAM_MAX_FILE_BYTES = 20 * 1024 * 1024;

export async function callTelegramApi(
  state: TelegramState,
  method: string,
  payload: Record<string, any>,
): Promise<any> {
  const response = await fetch(`https://api.telegram.org/bot${state.config.botToken}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const parsed = await response.json();
  if (!response.ok || !parsed?.ok) {
    throw new Error(parsed?.description || `Telegram API devolvio HTTP ${response.status}.`);
  }
  return parsed;
}

/**
 * Envia una nota de voz. Requiere multipart, no JSON: la Bot API solo acepta
 * contenido binario subido como archivo.
 */
export async function sendTelegramVoice(
  state: TelegramState,
  chatId: string,
  audio: Buffer,
  seconds: number,
): Promise<any> {
  ensureTelegramConfigured(state);
  const form = new FormData();
  form.append('chat_id', chatId);
  form.append('duration', String(Math.max(1, Math.round(seconds))));
  form.append(
    'voice',
    new Blob([new Uint8Array(audio)], { type: 'audio/ogg' }),
    'nota-de-voz.ogg',
  );
  const response = await fetch(`https://api.telegram.org/bot${state.config.botToken}/sendVoice`, {
    method: 'POST',
    body: form,
  });
  const parsed = await response.json();
  if (!response.ok || !parsed?.ok) {
    throw new Error(parsed?.description || `Telegram API devolvio HTTP ${response.status}.`);
  }
  return parsed;
}

/**
 * Descarga un archivo por `file_id`.
 *
 * El token viaja en la ruta de descarga, que es como la Bot API expone los
 * archivos; por eso el error que se propaga nunca incluye la URL.
 */
export async function downloadTelegramFile(state: TelegramState, fileId: string): Promise<Buffer> {
  ensureTelegramConfigured(state);
  const info = await callTelegramApi(state, 'getFile', { file_id: fileId });
  const filePath = String(info?.result?.file_path || '');
  if (!filePath) throw new Error('Telegram no devolvio la ruta del archivo.');
  const declaredSize = Number(info?.result?.file_size || 0);
  if (declaredSize > TELEGRAM_MAX_FILE_BYTES) {
    throw new Error('El audio recibido excede el tamano admitido.');
  }

  const response = await fetch(`https://api.telegram.org/file/bot${state.config.botToken}/${filePath}`);
  if (!response.ok) throw new Error(`No se pudo descargar el archivo de Telegram (HTTP ${response.status}).`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length || buffer.length > TELEGRAM_MAX_FILE_BYTES) {
    throw new Error('El audio recibido esta vacio o excede el tamano admitido.');
  }
  return buffer;
}
