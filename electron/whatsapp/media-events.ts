import { downloadMediaMessage } from '@whiskeysockets/baileys';
import { logger } from './logger';
import type { WhatsAppServiceCore } from './types';

export async function emitMediaIfPresent(
  service: WhatsAppServiceCore,
  msg: any,
  jid: string,
  senderNumber: string,
  cleanText: string,
  isGroup: boolean,
  history: string,
): Promise<boolean> {
  const mediaMsg = msg.message.imageMessage || msg.message.documentMessage || msg.message.videoMessage;
  if (mediaMsg) {
    const buffer = await downloadMediaMessage(msg, 'buffer', {}, {
      logger,
      reuploadRequest: service.sock!.updateMediaMessage,
    });
    const fileName = (mediaMsg as any).fileName || (msg.message.imageMessage ? 'image.jpg' : 'file');
    const mimetype = mediaMsg.mimetype || 'application/octet-stream';
    service.recordHistory({
      direction: 'incoming',
      kind: 'media',
      jid,
      senderNumber,
      groupJid: isGroup ? jid : null,
      isGroup,
      text: cleanText || undefined,
      media: {
        fileName,
        mimetype,
        sizeBytes: Buffer.isBuffer(buffer) ? buffer.length : undefined,
      },
      source: 'whatsapp-service',
      metadata: {
        messageId: msg.key?.id,
        participant: msg.key?.participant,
      },
    });
    service.emit('media', {
      jid,
      senderNumber,
      buffer: buffer as Buffer,
      fileName,
      mimetype,
      text: cleanText,
      isGroup,
      groupJid: isGroup ? jid : null,
      history,
      message: msg,
    });
    return true;
  }

  if (!msg.message.audioMessage) return false;
  const buffer = await downloadMediaMessage(msg, 'buffer', {}, {
    logger,
    reuploadRequest: service.sock!.updateMediaMessage,
  });
  service.recordHistory({
    direction: 'incoming',
    kind: 'audio',
    jid,
    senderNumber,
    groupJid: isGroup ? jid : null,
    isGroup,
    media: {
      fileName: 'audio.ogg',
      mimetype: msg.message.audioMessage.mimetype || 'audio/ogg',
      sizeBytes: Buffer.isBuffer(buffer) ? buffer.length : undefined,
    },
    source: 'whatsapp-service',
    metadata: {
      messageId: msg.key?.id,
      participant: msg.key?.participant,
    },
  });
  service.emit('audio', {
    jid,
    senderNumber,
    buffer: buffer as Buffer,
    message: msg,
    isGroup,
    groupJid: isGroup ? jid : null,
    history,
  });
  return true;
}
