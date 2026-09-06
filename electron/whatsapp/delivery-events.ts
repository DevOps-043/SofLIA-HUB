import type { WhatsAppServiceCore } from './types';

/**
 * Vigila los mensajes salientes que el servidor rechaza.
 *
 * `sock.sendMessage` resuelve en cuanto la stanza sale: si WhatsApp la rechaza
 * despues, el fallo llega como un ack de error y el envio ya se dio por bueno.
 * Ese es el modo de falla que se ve como "conectado pero no manda nada", sin
 * excepcion ni rastro. Aqui se convierte en un evento observable y en una
 * entrada de historial.
 */
const DELIVERY_ERROR_REASONS: Record<string, string> = {
  '401': 'no autorizado por el servidor',
  '403': 'prohibido por el servidor',
  '404': 'destinatario no encontrado',
  '421': 'destinatario bloqueado o no disponible',
  '463': 'cuenta restringida o falta el token de privacidad del chat directo',
  '479': 'stanza rechazada: sesion de dispositivo obsoleta o direccionamiento invalido',
};

export function describeDeliveryError(code: string): string {
  return DELIVERY_ERROR_REASONS[code] || `rechazo del servidor (codigo ${code || 'desconocido'})`;
}

type MessageUpdateEntry = {
  key?: { remoteJid?: string | null; id?: string | null };
  update?: { status?: number | null; messageStubParameters?: (string | null)[] | null };
};

export function registerDeliveryEvents(service: WhatsAppServiceCore): void {
  service.sock!.ev.on('messages.update', (updates: MessageUpdateEntry[]) => {
    for (const entry of updates || []) {
      const update = entry?.update;
      // `status: 0` es ERROR en el protocolo; el resto son estados normales de
      // entrega (pendiente, ack de servidor, entregado, leido).
      if (!update || update.status !== 0) continue;
      const code = String(update.messageStubParameters?.[0] || '');
      const jid = String(entry?.key?.remoteJid || '');
      reportDeliveryFailure(service, jid, code, entry?.key?.id);
    }
  });
}

function reportDeliveryFailure(service: WhatsAppServiceCore, jid: string, code: string, messageId?: string | null): void {
  const reason = describeDeliveryError(code);
  service.lastDeliveryError = { jid, code, reason, at: new Date().toISOString() };
  console.error(`[WhatsApp] El servidor rechazo un mensaje para ${jid || 'destinatario desconocido'}: ${reason}.`);
  service.recordHistory({
    direction: 'system',
    kind: 'text',
    jid,
    senderNumber: null,
    groupJid: jid.endsWith('@g.us') ? jid : null,
    isGroup: jid.endsWith('@g.us'),
    text: `Mensaje saliente rechazado por WhatsApp: ${reason}`,
    source: 'whatsapp-service',
    metadata: { messageId, deliveryErrorCode: code, deliveryFailed: true },
  });
  service.emit('delivery-error', { jid, code, reason, messageId });
  service.emit('status', service.getStatus());
}
