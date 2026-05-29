import { addToGroupContext, getGroupHistory } from './group-context';
import { shouldRespondInGroup } from './group-activation';
import { emitMediaIfPresent } from './media-events';
import {
  cleanGroupText,
  extractRawText,
  getPassiveInteraction,
  resolveSenderNumber,
  unwrapMessageContainers,
  type PassiveWhatsAppInteraction,
} from './message-utils';
import { detectJailbreak, isAllowedGroupSender, isAllowedNumber } from './security';
import type { WhatsAppServiceCore } from './types';

export function registerMessageEvents(service: WhatsAppServiceCore): void {
  service.sock!.ev.on('messages.upsert', async (messageBatch) => {
    for (const msg of messageBatch.messages) {
      await processIncomingMessage(service, msg);
    }
  });
}

async function processIncomingMessage(service: WhatsAppServiceCore, msg: any): Promise<void> {
  if (msg.key.remoteJid === 'status@broadcast' || msg.key.fromMe || !msg.message) return;
  const jid = msg.key.remoteJid!;
  const isGroup = jid.endsWith('@g.us');
  unwrapMessageContainers(msg);

  const senderNumber = await resolveSenderNumber(service.sock, msg, jid, isGroup);
  if (!passesAccessChecks(service, msg, jid, isGroup, senderNumber)) return;

  const passiveInteraction = getPassiveInteraction(msg);
  const wasInvoked = isGroup ? shouldRespondInGroup(service.sock, service.config, msg) : true;
  const rawText = extractRawText(msg).trim();
  let cleanText = rawText;
  if (isGroup) cleanText = cleanGroupText(cleanText, service.config.groupPrefix || '/soflia', service.sock?.user?.id?.split(':')[0] || '');
  const hasMedia = Boolean(
    msg.message.imageMessage ||
    msg.message.documentMessage ||
    msg.message.videoMessage ||
    msg.message.audioMessage,
  );

  if (!cleanText && passiveInteraction) {
    recordIncomingPassiveInteraction(service, msg, jid, senderNumber, isGroup, passiveInteraction);
    return;
  }

  if (rawText && detectJailbreak(rawText)) {
    recordIncomingText(service, msg, jid, senderNumber, isGroup, cleanText || rawText, {
      rawText: rawText === cleanText ? undefined : rawText,
      blockedReason: 'jailbreak',
    });
    console.warn(`[Security] Posible Jailbreak o Prompt Injection detectado de ${senderNumber}. Mensaje ignorado.`);
    return;
  }
  if (cleanText && !hasMedia) {
    recordIncomingText(service, msg, jid, senderNumber, isGroup, cleanText, {
      rawText: rawText === cleanText ? undefined : rawText,
    });
  }
  if (isGroup && cleanText) addToGroupContext(service, jid, senderNumber, cleanText);

  if (isGroup && !wasInvoked && !hasMedia) return;
  if (!cleanText && !wasInvoked && !hasMedia) return;

  const history = isGroup ? getGroupHistory(service, jid) : '';
  try {
    if (await emitMediaIfPresent(service, msg, jid, senderNumber, cleanText, isGroup, history)) return;
  } catch (err) {
    console.error('[WhatsApp] Error downloading media:', err);
  }

  if (!cleanText && !wasInvoked) return;
  console.log(`[WhatsApp] ${isGroup ? 'GROUP' : 'DM'} from ${senderNumber}${isGroup ? ` in ${jid}` : ''}: ${cleanText.slice(0, 60)}`);
  service.emit('message', { jid, senderNumber, text: cleanText, message: msg, isGroup, groupJid: isGroup ? jid : null, history });
}

function recordIncomingPassiveInteraction(
  service: WhatsAppServiceCore,
  msg: any,
  jid: string,
  senderNumber: string,
  isGroup: boolean,
  interaction: PassiveWhatsAppInteraction,
): void {
  service.recordHistory({
    direction: 'incoming',
    kind: interaction.kind === 'sticker' ? 'media' : 'text',
    jid,
    senderNumber,
    groupJid: isGroup ? jid : null,
    isGroup,
    text: interaction.label,
    media: interaction.kind === 'sticker' ? { mimetype: msg.message?.stickerMessage?.mimetype || 'image/webp' } : undefined,
    source: 'whatsapp-service',
    metadata: {
      messageId: msg.key?.id,
      participant: msg.key?.participant,
      passiveInteraction: interaction.kind,
      value: interaction.value,
      ignoredByAgent: true,
    },
  });
}

function recordIncomingText(
  service: WhatsAppServiceCore,
  msg: any,
  jid: string,
  senderNumber: string,
  isGroup: boolean,
  text: string,
  metadata: Record<string, unknown> = {},
): void {
  service.recordHistory({
    direction: 'incoming',
    kind: text.trim().startsWith('/') ? 'command' : 'text',
    jid,
    senderNumber,
    groupJid: isGroup ? jid : null,
    isGroup,
    text,
    source: 'whatsapp-service',
    metadata: {
      messageId: msg.key?.id,
      participant: msg.key?.participant,
      ...metadata,
    },
  });
}

function passesAccessChecks(service: WhatsAppServiceCore, msg: any, jid: string, isGroup: boolean, senderNumber: string): boolean {
  if (!isGroup) {
    if (isAllowedNumber(service.config, senderNumber)) return true;
    console.log(`[WhatsApp] Ignoring message from unauthorized number: ${senderNumber} (JID: ${jid})`);
    return false;
  }

  if (service.config.groupPolicy === 'disabled') return false;
  const allowedGroups = service.config.allowedGroups || [];
  if (allowedGroups.length > 0 && !allowedGroups.includes(jid)) return false;
  if (!isAllowedGroupSender(service.config, senderNumber)) return false;
  return shouldRespondInGroup(service.sock, service.config, msg);
}
