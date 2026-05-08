import type { WASocket } from '@whiskeysockets/baileys';
import type { WhatsAppConfig } from './types';

export function shouldRespondInGroup(sock: WASocket | null, config: WhatsAppConfig, msg: any): boolean {
  const text = extractText(msg);
  const lowerText = text.toLowerCase();
  const contextInfo =
    msg.message?.extendedTextMessage?.contextInfo ||
    msg.message?.imageMessage?.contextInfo ||
    msg.message?.documentMessage?.contextInfo ||
    msg.message?.videoMessage?.contextInfo;
  const botJid = sock?.user?.id || '';
  const botNumber = botJid.split(':')[0];
  const botJidPlain = `${botNumber}@s.whatsapp.net`;
  const mentionedJids: string[] = contextInfo?.mentionedJid || [];
  const isMentioned = !!(botNumber && mentionedJids.some((jid) => jid === botJidPlain || jid.startsWith(`${botNumber}@`)));
  const isReplyToBot = !!(botNumber && (
    contextInfo?.participant === botJidPlain ||
    contextInfo?.participant?.startsWith(`${botNumber}:`)
  ));
  const hasPrefix = lowerText.startsWith((config.groupPrefix || '/soflia').toLowerCase());
  const matchesPattern = /\bsoflia\b/i.test(lowerText);
  const hasMedia = Boolean(
    msg.message?.imageMessage ||
    msg.message?.documentMessage ||
    msg.message?.videoMessage ||
    msg.message?.audioMessage,
  );
  const result = Boolean(isMentioned || hasPrefix || matchesPattern || isReplyToBot || (hasMedia && isReplyToBot));
  if (text || hasMedia) {
    console.log(`[WA-Group-Check] msg: "${text.slice(0, 30)}${hasMedia ? ' [+MEDIA]' : ''}..." | trigger: ${result}`);
  }
  return result;
}

function extractText(msg: any): string {
  return msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    msg.message?.imageMessage?.caption ||
    msg.message?.documentMessage?.caption ||
    msg.message?.videoMessage?.caption ||
    '';
}
