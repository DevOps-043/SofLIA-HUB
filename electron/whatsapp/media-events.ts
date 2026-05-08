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
    service.emit('media', {
      jid,
      senderNumber,
      buffer: buffer as Buffer,
      fileName: (mediaMsg as any).fileName || (msg.message.imageMessage ? 'image.jpg' : 'file'),
      mimetype: mediaMsg.mimetype || 'application/octet-stream',
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
