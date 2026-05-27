import fs from 'node:fs/promises';
import path from 'node:path';
import { normalizeOutgoingWhatsAppText } from '../whatsapp-text';
import { directNumberFromJid } from './history';
import type { WhatsAppServiceCore } from './types';

export async function sendText(service: WhatsAppServiceCore, jid: string, text: string): Promise<void> {
  ensureConnected(service);
  const normalizedText = normalizeOutgoingWhatsAppText(text);
  const maxMessageLength = 4000;
  if (normalizedText.length <= maxMessageLength) {
    await service.sock!.sendMessage(jid, { text: normalizedText });
    recordOutgoingText(service, jid, normalizedText, 1, 1);
    return;
  }

  const chunks: string[] = [];
  for (let index = 0; index < normalizedText.length; index += maxMessageLength) {
    chunks.push(normalizedText.slice(index, index + maxMessageLength));
  }
  for (let index = 0; index < chunks.length; index += 1) {
    await service.sock!.sendMessage(jid, { text: chunks[index] });
    recordOutgoingText(service, jid, chunks[index], index + 1, chunks.length);
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
    const mimetype = `image/${ext.slice(1) === 'jpg' ? 'jpeg' : ext.slice(1)}`;
    await service.sock!.sendMessage(jid, {
      image: buffer,
      caption: caption || fileName,
      mimetype,
    });
    recordOutgoingFile(service, jid, 'media', fileName, mimetype, stat.size, caption || fileName);
    return;
  }
  if (['.mp4', '.avi', '.mov', '.mkv'].includes(ext)) {
    const mimetype = `video/${ext.slice(1)}`;
    await service.sock!.sendMessage(jid, { video: buffer, caption: caption || fileName, mimetype });
    recordOutgoingFile(service, jid, 'media', fileName, mimetype, stat.size, caption || fileName);
    return;
  }
  await service.sock!.sendMessage(jid, {
    document: buffer,
    fileName,
    caption: caption || undefined,
    mimetype: 'application/octet-stream',
  });
  recordOutgoingFile(service, jid, 'file', fileName, 'application/octet-stream', stat.size, caption);
}

function ensureConnected(service: WhatsAppServiceCore): void {
  if (!service.sock || !service.connected) throw new Error('WhatsApp no esta conectado.');
}

function recordOutgoingText(
  service: WhatsAppServiceCore,
  jid: string,
  text: string,
  part: number,
  totalParts: number,
): void {
  const isGroup = jid.endsWith('@g.us');
  service.recordHistory({
    direction: 'outgoing',
    kind: 'text',
    jid,
    senderNumber: isGroup ? null : directNumberFromJid(jid),
    groupJid: isGroup ? jid : null,
    isGroup,
    text,
    source: 'whatsapp-service',
    metadata: { part, totalParts },
  });
}

function recordOutgoingFile(
  service: WhatsAppServiceCore,
  jid: string,
  kind: 'media' | 'file',
  fileName: string,
  mimetype: string,
  sizeBytes: number,
  caption?: string,
): void {
  const isGroup = jid.endsWith('@g.us');
  service.recordHistory({
    direction: 'outgoing',
    kind,
    jid,
    senderNumber: isGroup ? null : directNumberFromJid(jid),
    groupJid: isGroup ? jid : null,
    isGroup,
    text: caption,
    media: { fileName, mimetype, sizeBytes },
    source: 'whatsapp-service',
  });
}
