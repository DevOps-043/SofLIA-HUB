import { normalizePhoneNumber } from './phone-utils';

export function unwrapMessageContainers(msg: any): void {
  if (msg.message.viewOnceMessage?.message) {
    msg.message = { ...msg.message, ...msg.message.viewOnceMessage.message };
  }
  if (msg.message.ephemeralMessage?.message) {
    msg.message = { ...msg.message, ...msg.message.ephemeralMessage.message };
  }
  if (msg.message.documentWithCaptionMessage?.message) {
    msg.message = { ...msg.message, ...msg.message.documentWithCaptionMessage.message };
  }
}

/**
 * Quien escribe, en las dos formas con las que WhatsApp lo nombra.
 *
 * Con el direccionamiento oculto (`addressing_mode="lid"`) el remitente llega
 * como `<id>@lid`, que NO es un telefono: usarlo como numero lo deja fuera de
 * la allowlist, del numero maestro, de los permisos por contacto y de la
 * identidad SOFIA, y el mensaje se descarta antes de llegar al agente.
 */
export interface WhatsAppSenderIdentity {
  /** Telefono real normalizado. Vacio cuando WhatsApp solo entrego el LID. */
  phoneNumber: string;
  /** LID completo (`<id>@lid`) cuando el chat usa direccionamiento oculto. */
  lid: string;
  /**
   * Valor que el resto del producto trata como "numero del remitente": el
   * telefono cuando se conoce y, si no, los digitos del LID.
   */
  senderNumber: string;
  /** `true` cuando `senderNumber` es un LID y no un telefono verificable. */
  isLidOnly: boolean;
}

/**
 * Resuelve al remitente priorizando el telefono que Baileys ya trae en el sobre.
 *
 * Baileys v7 publica el par completo: en modo LID `remoteJidAlt` (directos) y
 * `participantAlt` (grupos) llevan el telefono real. Es la fuente primaria
 * porque `lidMapping.getPNForLID` NO consulta al servidor: solo lee cache y
 * claves guardadas, y en modo LID ese mapa inverso suele estar vacio.
 */
export async function resolveSenderIdentity(
  sock: any,
  msg: any,
  jid: string,
  isGroup: boolean,
): Promise<WhatsAppSenderIdentity> {
  const candidates = isGroup
    ? [msg?.key?.participantAlt, msg?.key?.participant, msg?.key?.remoteJid]
    : [msg?.key?.remoteJidAlt, jid];

  let phoneNumber = '';
  let lid = '';
  for (const candidate of candidates) {
    const value = String(candidate || '').trim();
    if (!value) continue;
    if (isLidJid(value)) {
      if (!lid) lid = normalizeLidJid(value);
      continue;
    }
    if (!phoneNumber) phoneNumber = phoneFromJid(value);
  }

  if (!phoneNumber && lid) phoneNumber = await lookupPhoneForLid(sock, lid);

  const senderNumber = phoneNumber || digitsFromLid(lid);
  return { phoneNumber, lid, senderNumber, isLidOnly: !phoneNumber && Boolean(lid) };
}

/** Compatibilidad: el numero unico que usaban los llamadores anteriores. */
export async function resolveSenderNumber(sock: any, msg: any, jid: string, isGroup: boolean): Promise<string> {
  return (await resolveSenderIdentity(sock, msg, jid, isGroup)).senderNumber;
}

async function lookupPhoneForLid(sock: any, lid: string): Promise<string> {
  try {
    const mapped = await sock?.signalRepository?.lidMapping?.getPNForLID(lid);
    return mapped ? phoneFromJid(String(mapped)) : '';
  } catch (err) {
    console.warn(`[WhatsApp] Error resolving LID ${lid}:`, err);
    return '';
  }
}

export function isLidJid(value: string): boolean {
  const raw = String(value || '');
  return raw.includes('@') && raw.split('@').pop() === 'lid';
}

function normalizeLidJid(value: string): string {
  const user = String(value).split('@')[0].split(':')[0];
  return user ? `${user}@lid` : '';
}

function digitsFromLid(lid: string): string {
  return lid ? String(lid).split('@')[0].split(':')[0] : '';
}

function phoneFromJid(value: string): string {
  const raw = String(value || '');
  if (!raw || isLidJid(raw)) return '';
  return normalizePhoneNumber(raw.split('@')[0].split(':')[0]);
}

export function extractRawText(msg: any): string {
  return msg.message.conversation ||
    msg.message.extendedTextMessage?.text ||
    msg.message.imageMessage?.caption ||
    msg.message.documentMessage?.caption ||
    msg.message.videoMessage?.caption ||
    '';
}

export type PassiveWhatsAppInteraction = {
  kind: 'reaction' | 'sticker';
  label: string;
  value?: string;
};

export function getPassiveInteraction(msg: any): PassiveWhatsAppInteraction | null {
  const message = msg.message || {};
  const reaction = message.reactionMessage;
  if (reaction) {
    const value = String(reaction.text || '').trim();
    return {
      kind: 'reaction',
      label: value ? `Reaccion recibida: ${value}` : 'Reaccion recibida',
      value: value || undefined,
    };
  }

  if (message.stickerMessage && !extractRawText(msg).trim()) {
    return { kind: 'sticker', label: 'Sticker recibido' };
  }

  return null;
}

/**
 * Quita el prefijo de invocacion y la mencion al bot.
 *
 * Se reciben todos los identificadores del bot porque en un grupo con
 * direccionamiento oculto la mencion viaja como LID y no como telefono.
 */
export function cleanGroupText(rawText: string, prefix: string, botIds: string | string[]): string {
  let cleanText = rawText.trim();
  if (cleanText.toLowerCase().startsWith(prefix.toLowerCase())) {
    cleanText = cleanText.slice(prefix.length).trim();
  }
  const ids = (Array.isArray(botIds) ? botIds : [botIds]).filter(Boolean);
  for (const id of ids) {
    // Solo identificadores simples entran en un patron: telefonos y LIDs lo
    // son, y asi nada que venga del socket se interpreta como expresion.
    if (!/^[A-Za-z0-9_-]+$/.test(id)) continue;
    cleanText = cleanText.replace(new RegExp(`@${id}[ \t]*`, 'g'), '');
  }
  return cleanText.trim();
}
