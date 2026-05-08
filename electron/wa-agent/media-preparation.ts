import { app } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';

export type PreparedWhatsAppMedia = {
  savedPath: string;
  inlineMediaParts: Array<{ inlineData: { mimeType: string; data: string } }>;
  userText: string;
  canAnalyzeInline: boolean;
  reason?: string;
};

const MAX_INLINE_SIZE_BYTES = 15 * 1024 * 1024;

function getExtensionFromMime(mime: string): string {
  const map: Record<string, string> = {
    'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif',
    'image/webp': '.webp', 'application/pdf': '.pdf',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/vnd.ms-excel': '.xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'application/vnd.ms-powerpoint': '.ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
    'text/plain': '.txt', 'text/csv': '.csv',
    'application/zip': '.zip', 'application/x-rar-compressed': '.rar',
    'video/mp4': '.mp4', 'audio/ogg': '.ogg', 'audio/mpeg': '.mp3',
  };
  return map[mime] || '';
}

function buildSavedFileName(fileName: string, mimetype: string): string {
  const safeName = fileName.replace(/[<>:"/\\|?*]/g, '_');
  const ext = path.extname(safeName) || getExtensionFromMime(mimetype);
  const baseName = path.basename(safeName, ext);
  return `${baseName}_${Date.now()}${ext}`;
}

function buildMediaText(params: {
  caption: string;
  fileName: string;
  mimetype: string;
  sizeMb: string;
  savedPath: string;
  reason?: string;
}): string {
  const intro = params.caption
    ? `${params.caption}\n\n[El usuario envio un archivo`
    : '[El usuario envio un archivo';
  const suffix = params.reason
    ? `Archivo ${params.reason} para analisis inline, pero lo he guardado en: ${params.savedPath}. Puedes usar read_file para leer su contenido si es un documento de texto, o informar al usuario donde esta guardado.]`
    : `Lo he guardado en: ${params.savedPath}. Analiza el contenido del archivo y responde.]`;
  return `${intro}: "${params.fileName}" (${params.mimetype}, ${params.sizeMb} MB). ${suffix}`;
}

export async function prepareWhatsAppMediaMessage(
  buffer: Buffer,
  fileName: string,
  mimetype: string,
  text: string,
): Promise<PreparedWhatsAppMedia> {
  const receivedDir = path.join(app.getPath('userData'), 'whatsapp-received');
  await fs.mkdir(receivedDir, { recursive: true });

  const savedPath = path.join(receivedDir, buildSavedFileName(fileName, mimetype));
  await fs.writeFile(savedPath, buffer);

  const sizeMb = (buffer.length / 1024 / 1024).toFixed(1);
  const isInlineable = buffer.length <= MAX_INLINE_SIZE_BYTES;
  const isAnalyzable = /^(image\/(jpeg|png|gif|webp|bmp)|application\/pdf|text\/|audio\/)/.test(mimetype);
  const canAnalyzeInline = isInlineable && isAnalyzable;
  const reason = canAnalyzeInline
    ? undefined
    : (!isInlineable ? `demasiado grande (${sizeMb} MB)` : `formato no analizable directamente (${mimetype})`);

  return {
    savedPath,
    canAnalyzeInline,
    reason,
    inlineMediaParts: canAnalyzeInline ? [{ inlineData: { mimeType: mimetype, data: buffer.toString('base64') } }] : [],
    userText: buildMediaText({ caption: text.trim(), fileName, mimetype, sizeMb, savedPath, reason }),
  };
}
