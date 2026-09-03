import type { WASocket } from '@whiskeysockets/baileys';
import type { WhatsAppConfig } from './types';

/**
 * Identificadores con los que un grupo puede nombrar al bot.
 *
 * Con direccionamiento oculto la mencion viaja como LID y no como telefono, asi
 * que comparar solo contra el numero deja al bot sin detectar sus propias
 * menciones y el grupo deja de responder.
 */
export function botIdentifiers(sock: WASocket | null): string[] {
  const ids = [sock?.user?.id, (sock?.user as any)?.lid]
    .map((value) => String(value || '').split('@')[0].split(':')[0])
    .filter(Boolean);
  return Array.from(new Set(ids));
}

export function shouldRespondInGroup(sock: WASocket | null, config: WhatsAppConfig, msg: any): boolean {
  const text = extractText(msg);
  const lowerText = text.toLowerCase();
  const contextInfo =
    msg.message?.extendedTextMessage?.contextInfo ||
    msg.message?.imageMessage?.contextInfo ||
    msg.message?.documentMessage?.contextInfo ||
    msg.message?.videoMessage?.contextInfo;
  const botIds = botIdentifiers(sock);
  const mentionedJids: string[] = contextInfo?.mentionedJid || [];
  const isMentioned = mentionedJids.some((jid) => matchesBot(jid, botIds));
  const isReplyToBot = matchesBot(contextInfo?.participant, botIds) ||
    matchesBot(contextInfo?.participantAlt, botIds);
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

/** Compara por la parte de usuario del JID, sea telefono (`@s.whatsapp.net`) o LID (`@lid`). */
function matchesBot(jid: string | undefined | null, botIds: string[]): boolean {
  const user = String(jid || '').split('@')[0].split(':')[0];
  return Boolean(user && botIds.includes(user));
}

function extractText(msg: any): string {
  return msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    msg.message?.imageMessage?.caption ||
    msg.message?.documentMessage?.caption ||
    msg.message?.videoMessage?.caption ||
    '';
}
