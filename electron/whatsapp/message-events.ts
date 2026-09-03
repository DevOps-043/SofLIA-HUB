import { addToGroupContext, getGroupHistory } from './group-context';
import { botIdentifiers, shouldRespondInGroup } from './group-activation';
import { emitMediaIfPresent } from './media-events';
import {
  cleanGroupText,
  extractRawText,
  getPassiveInteraction,
  resolveSenderIdentity,
  unwrapMessageContainers,
  type PassiveWhatsAppInteraction,
  type WhatsAppSenderIdentity,
} from './message-utils';
import { detectJailbreak, isAllowedGroupSender, isAllowedNumber } from './security';
import type { WhatsAppServiceCore } from './types';
import { isOrgAdminRole } from '../communication-hub/authorization';

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

  const identity = await resolveSenderIdentity(service.sock, msg, jid, isGroup);
  const senderNumber = identity.senderNumber;
  if (!await passesAccessChecks(service, msg, jid, isGroup, identity)) return;

  const passiveInteraction = getPassiveInteraction(msg);
  const wasInvoked = isGroup ? shouldRespondInGroup(service.sock, service.config, msg) : true;
  const rawText = extractRawText(msg).trim();
  let cleanText = rawText;
  if (isGroup) cleanText = cleanGroupText(cleanText, service.config.groupPrefix || '/soflia', botIdentifiers(service.sock));
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

/**
 * Deja rastro de cada mensaje descartado por una guarda.
 *
 * Un descarte silencioso es indistinguible de una caida del canal: el contacto
 * escribe, el agente no contesta y no queda nada que revisar. El motivo queda
 * en el historial para que el diagnostico no dependa de la consola.
 */
function recordDroppedMessage(
  service: WhatsAppServiceCore,
  msg: any,
  jid: string,
  identity: WhatsAppSenderIdentity,
  isGroup: boolean,
  reason: string,
): void {
  const lidNote = identity.isLidOnly ? ' [LID sin telefono resuelto]' : '';
  console.warn(`[WhatsApp] Mensaje descartado (${reason}) de ${identity.senderNumber || jid}${lidNote}`);
  service.recordHistory({
    direction: 'system',
    kind: 'text',
    jid,
    senderNumber: identity.senderNumber || null,
    groupJid: isGroup ? jid : null,
    isGroup,
    text: `Mensaje entrante descartado: ${reason}`,
    source: 'whatsapp-service',
    metadata: {
      messageId: msg?.key?.id,
      droppedReason: reason,
      senderLid: identity.lid || undefined,
      senderPhone: identity.phoneNumber || undefined,
      lidUnresolved: identity.isLidOnly || undefined,
      ignoredByAgent: true,
    },
  });
}

async function passesAccessChecks(
  service: WhatsAppServiceCore,
  msg: any,
  jid: string,
  isGroup: boolean,
  identity: WhatsAppSenderIdentity,
): Promise<boolean> {
  const senderNumber = identity.senderNumber;
  if (!isGroup) {
    if (!isAllowedNumber(service.config, senderNumber)) {
      recordDroppedMessage(service, msg, jid, identity, isGroup, 'numero fuera de la lista permitida');
      return false;
    }
    if (service.communicationHubService) {
      // Sin telefono no hay identidad que resolver: WhatsApp entrego solo el
      // LID y el mapa inverso todavia no lo conoce.
      if (identity.isLidOnly) {
        recordDroppedMessage(service, msg, jid, identity, isGroup, 'no se pudo resolver el telefono detras del LID');
        return false;
      }
      const principal = await service.communicationHubService.resolvePrincipalFromWhatsApp(identity.phoneNumber);
      if (!principal.active || !principal.capabilities.includes('personal_agent')) {
        recordDroppedMessage(service, msg, jid, identity, isGroup, 'sin identidad SOFIA activa con capacidad personal_agent');
        return false;
      }
    }
    return true;
  }

  if (service.config.groupPolicy === 'disabled') return false;
  const allowedGroups = service.config.allowedGroups || [];
  if (allowedGroups.length > 0 && !allowedGroups.includes(jid)) return false;
  if (!isAllowedGroupSender(service.config, senderNumber)) {
    recordDroppedMessage(service, msg, jid, identity, isGroup, 'remitente de grupo no autorizado');
    return false;
  }
  if (service.communicationHubService) {
    if (identity.isLidOnly) {
      recordDroppedMessage(service, msg, jid, identity, isGroup, 'no se pudo resolver el telefono detras del LID');
      return false;
    }
    const principal = await service.communicationHubService.resolvePrincipalFromWhatsApp(identity.phoneNumber);
    if (!principal.active || !isOrgAdminRole(principal.role)) {
      recordDroppedMessage(service, msg, jid, identity, isGroup, 'sin rol de administrador de organizacion');
      return false;
    }
  }
  return shouldRespondInGroup(service.sock, service.config, msg);
}
