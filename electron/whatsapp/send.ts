import fs from 'node:fs/promises';
import path from 'node:path';
import { normalizeOutgoingWhatsAppText } from '../whatsapp-text';
import type { WhatsAppServiceCore } from './types';

export async function sendText(service: WhatsAppServiceCore, jid: string, text: string): Promise<void> {
  ensureConnected(service);
  const normalizedText = normalizeOutgoingWhatsAppText(text);
  const maxMessageLength = 4000;
  if (normalizedText.length <= maxMessageLength) {
    await service.sock!.sendMessage(jid, { text: normalizedText });
    return;
  }

  for (let index = 0; index < normalizedText.length; index += maxMessageLength) {
    await service.sock!.sendMessage(jid, { text: normalizedText.slice(index, index + maxMessageLength) });
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

export async function sendFile(service: WhatsAppServiceCore, jid: string, filePath: string, caption?: string): Promise<void> {
  ensureConnected(service);
  const resolvedPath = path.resolve(filePath);
  const stat = await fs.stat(resolvedPath);
  if (stat.size > 16 * 1024 * 1024) {
    throw new Error(`Archivo demasiado grande (${(stat.size / 1024 / 1024).toFixed(1)} MB). Maximo: 16 MB.`);
  }

  const buffer = await fs.readFile(resolvedPath);
  const fileName = path.basename(resolvedPath);
  const ext = path.extname(resolvedPath).toLowerCase();
  if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
    await service.sock!.sendMessage(jid, {
      image: buffer,
      caption: caption || fileName,
      mimetype: `image/${ext.slice(1) === 'jpg' ? 'jpeg' : ext.slice(1)}`,
    });
    return;
  }
  if (['.mp4', '.avi', '.mov', '.mkv'].includes(ext)) {
    await service.sock!.sendMessage(jid, { video: buffer, caption: caption || fileName, mimetype: `video/${ext.slice(1)}` });
    return;
  }
  await service.sock!.sendMessage(jid, {
    document: buffer,
    fileName,
    caption: caption || undefined,
    mimetype: 'application/octet-stream',
  });
}

function ensureConnected(service: WhatsAppServiceCore): void {
  if (!service.sock || !service.connected) throw new Error('WhatsApp no esta conectado.');
}
