import type { BrowserWindow } from 'electron';
import type { WhatsAppService } from './whatsapp-service';
import type { CommunicationHubService } from './communication-hub/service';
import { communicationGateway } from './communication-hub/ipc-gateway';
import { communicationActor, communicationConnection } from './communication-hub/ipc-contract';
import { assertCommunicationOperation, withoutCommunicationOperation } from './communication-hub/operation-context';
import { legacyAccess, legacyGroup, legacyHistory, legacyNumbers, legacyPersonalization } from './communication-hub/legacy-contract';
import { publicWhatsAppStatus, WhatsAppEventViewers } from './communication-hub/whatsapp-event-viewers';

interface Services {
  waService: WhatsAppService;
  communicationHubService?: CommunicationHubService;
  dailyBriefingService?: { updateConfig(config: { ownerNumber: string }): unknown };
}
export function registerWhatsAppHandlers(services: Services, windows: () => (BrowserWindow | null)[], initAgent: (key: string) => void): void {
  const { waService, communicationHubService: hub } = services;
  const gateway = communicationGateway(hub || waService, windows);
  const authorize = async (detail?: string) => { if (!hub) throw new Error('Autorización de comunicación no disponible.'); await hub.authorizeDeviceAction('whatsapp', detail); };
  const viewers = new WhatsAppEventViewers(gateway, authorize, windows);
  const change = async (detail: string, action: () => Promise<unknown>) => { await authorize(detail); assertCommunicationOperation(); await withoutCommunicationOperation(action); assertCommunicationOperation(); return { success: true }; };
  const refreshBriefing = () => { assertCommunicationOperation(); const status = waService.getStatus(); const ownerNumber = status.masterNumber || status.allowedNumbers?.[0] || ''; withoutCommunicationOperation(() => services.dailyBriefingService?.updateConfig({ ownerNumber })); };
  gateway.register('whatsapp:connect', 0, () => change('Conectar WhatsApp de este dispositivo.', () => waService.connect()));
  gateway.register('whatsapp:disconnect', 0, () => change('Desconectar WhatsApp de este dispositivo.', () => waService.disconnect()));
  gateway.register('whatsapp:get-status', 0, async (_args, _actor, event) => { await authorize(); assertCommunicationOperation(); const status = publicWhatsAppStatus(waService.getStatus()); viewers.enroll(event); return status; });
  gateway.register('whatsapp:get-conversation-history', 1, async (args, actor) => { const filters = legacyHistory(args[0], actor); await authorize(); assertCommunicationOperation(); return { success: true, data: await withoutCommunicationOperation(() => waService.getConversationHistory(filters)) }; });
  gateway.register('whatsapp:get-conversation-history-stats', 1, async (args, actor) => { communicationActor(args[0], actor); await authorize(); assertCommunicationOperation(); return { success: true, data: await withoutCommunicationOperation(() => waService.getConversationHistoryStats()) }; });
  gateway.register('whatsapp:set-allowed-numbers', 2, async (args, actor) => { communicationActor(args[1], actor); const numbers = legacyNumbers(args[0]); const result = await change('Cambiar números permitidos: '+JSON.stringify(numbers), () => waService.setAllowedNumbers(numbers)); refreshBriefing(); return result; });
  gateway.register('whatsapp:set-access-config', 1, async (args, actor) => { const config = legacyAccess(args[0], actor); const result = await change('Cambiar permisos de WhatsApp: '+JSON.stringify(config), () => waService.setAccessConfig(config)); refreshBriefing(); return result; });
  gateway.register('whatsapp:set-group-config', 1, async (args, actor) => { const config = legacyGroup(args[0], actor); return change('Cambiar grupos de WhatsApp: '+JSON.stringify(config), () => waService.setGroupConfig(config)); });
  gateway.register('whatsapp:set-personalization', 1, async (args, actor) => { const update = legacyPersonalization(args[0], actor); return change('Cambiar personalización de WhatsApp: '+JSON.stringify(update), () => waService.setPersonalization(update)); });
  gateway.register('whatsapp:set-api-key', 1, async args => {
    const update = communicationConnection({ provider: 'whatsapp', action: 'set-api-key', apiKey: args[0] }); if (update.provider !== 'whatsapp' || !update.apiKey) throw new Error('Clave no válida.'); const key = update.apiKey;
    await change('Cambiar clave del agente WhatsApp (valor oculto).', () => waService.saveApiKey(key)); assertCommunicationOperation(); withoutCommunicationOperation(() => initAgent(key)); return { success: true };
  });
  waService.on('qr', (qr: unknown) => viewers.publish('whatsapp:qr', qr));
  waService.on('status', (status: unknown) => viewers.publish('whatsapp:status', status));
}
