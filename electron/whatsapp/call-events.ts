import { normalizePhoneNumber } from './phone-utils';
import { isAllowedNumber } from './security';
import type { WhatsAppServiceCore } from './types';
import { isOrgAdminRole } from '../communication-hub/authorization';

/**
 * Observa las llamadas entrantes de WhatsApp.
 *
 * Baileys reimplementa solo la senalizacion de llamadas: entrega el `offer` y
 * permite rechazarlo, pero no expone el plano de medios WebRTC, asi que NO es
 * posible contestar con audio. Dejar timbrar sin respuesta es peor que rechazar
 * (WhatsApp reintenta y el usuario no recibe senal), asi que la llamada se
 * rechaza de inmediato y se reconduce al modo llamada por notas de voz.
 */
export function registerCallEvents(service: WhatsAppServiceCore): void {
  service.sock!.ev.on('call', async (events: any[]) => {
    for (const event of events || []) {
      await processCallEvent(service, event);
    }
  });
}

async function processCallEvent(service: WhatsAppServiceCore, event: any): Promise<void> {
  // Solo el `offer` abre una llamada. El resto de estados (`ringing`,
  // `terminate`, `reject`) son ecos del mismo intento y reaccionar a ellos
  // multiplicaria saludos por una sola llamada.
  if (event?.status !== 'offer') return;
  const callId = String(event.id || '');
  const from = String(event.from || '');
  if (!callId || !from) return;

  // Una llamada a un grupo no tiene un remitente unico al que responder.
  if (event.isGroup || from.endsWith('@g.us')) {
    await rejectCall(service, callId, from);
    return;
  }

  await rejectCall(service, callId, from);

  const senderNumber = await resolveCallerNumber(service, event, from);
  if (!senderNumber || !(await isCallerAuthorized(service, senderNumber))) {
    console.log(`[WhatsApp] Llamada rechazada de un numero sin autorizacion: ${senderNumber || from}`);
    return;
  }

  // Se responde por el JID telefonico, no por el LID: es la forma con la que el
  // resto del producto direcciona un chat directo.
  const replyJid = `${senderNumber}@s.whatsapp.net`;

  service.recordHistory({
    direction: 'system',
    kind: 'text',
    jid: replyJid,
    senderNumber,
    groupJid: null,
    isGroup: false,
    text: event.isVideo ? 'Llamada de video entrante' : 'Llamada de voz entrante',
    source: 'whatsapp-service',
    metadata: { callId, rejected: true, isVideo: Boolean(event.isVideo), from },
  });

  service.emit('call-offer', { jid: replyJid, senderNumber, callId, isVideo: Boolean(event.isVideo) });
}

/**
 * Identifica a quien llama.
 *
 * WhatsApp multidispositivo entrega el `offer` con un LID (`<id>@lid`), que NO
 * es un telefono: usarlo como numero lo deja fuera de cualquier allowlist y la
 * llamada se descarta como no autorizada. `callerPn` trae el telefono real
 * cuando existe; si no, se consulta el mapa de LIDs igual que hace la ruta de
 * mensajes. Sin ninguno de los dos no se sabe quien llama, y entonces no se
 * abre nada.
 */
async function resolveCallerNumber(service: WhatsAppServiceCore, event: any, from: string): Promise<string> {
  const declared = phoneFromJid(String(event.callerPn || ''));
  if (declared) return declared;
  if (!from.endsWith('@lid')) return phoneFromJid(from);

  try {
    const mapped = await service.sock?.signalRepository?.lidMapping?.getPNForLID(from);
    return mapped ? phoneFromJid(String(mapped)) : '';
  } catch (error) {
    console.warn(`[WhatsApp] No se pudo resolver el LID ${from} de la llamada entrante:`, error);
    return '';
  }
}

function phoneFromJid(value: string): string {
  if (!value || value.endsWith('@lid')) return '';
  return normalizePhoneNumber(value.split('@')[0].split(':')[0]);
}

/**
 * El rechazo va primero y no depende de la autorizacion: mientras se resuelve el
 * principal contra Supabase el telefono sigue sonando.
 */
async function rejectCall(service: WhatsAppServiceCore, callId: string, from: string): Promise<void> {
  try {
    await service.sock!.rejectCall(callId, from);
  } catch (error) {
    console.error('[WhatsApp] No se pudo rechazar la llamada entrante:', error);
  }
}

/** Mismo criterio que un mensaje directo: sin canal activo no hay conversacion. */
async function isCallerAuthorized(service: WhatsAppServiceCore, senderNumber: string): Promise<boolean> {
  if (!isAllowedNumber(service.config, senderNumber)) return false;
  if (!service.communicationHubService) return true;
  try {
    const principal = await service.communicationHubService.resolvePrincipalFromWhatsApp(senderNumber);
    return principal.active && (principal.capabilities.includes('personal_agent') || isOrgAdminRole(principal.role));
  } catch (error) {
    console.error('[WhatsApp] No se pudo resolver el principal de la llamada entrante:', error);
    return false;
  }
}
