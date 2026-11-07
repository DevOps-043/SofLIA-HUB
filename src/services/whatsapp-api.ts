import type { WhatsAppApi } from '../shared/legacy-communication';
declare global { interface Window { whatsApp?: WhatsAppApi } }
export function getWhatsAppApi(): WhatsAppApi {
  if (!window.whatsApp) throw new Error('WhatsApp no está disponible en este entorno.'); return window.whatsApp;
}
