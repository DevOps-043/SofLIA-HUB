import type { BrowserWindow } from 'electron';
import type { TelegramService } from './telegram-service';
import type { CommunicationHubService } from './communication-hub/service';
import { communicationGateway } from './communication-hub/ipc-gateway';
import { communicationConnection, communicationConnectionPreview, communicationMessage } from './communication-hub/ipc-contract';
import { assertCommunicationOperation, withoutCommunicationOperation } from './communication-hub/operation-context';

export function registerTelegramHandlers(telegram: TelegramService, hub?: CommunicationHubService, windows: () => (BrowserWindow | null)[] = () => []): void {
  const { register } = communicationGateway(hub || telegram, windows);
  const authorize = async (detail?: string) => { if (!hub) throw new Error('Autorización de comunicación no disponible.'); await hub.authorizeDeviceAction('telegram', detail); assertCommunicationOperation(); };
  register('telegram:get-status', 0, async () => { await authorize(); const status = await withoutCommunicationOperation(() => telegram.getStatus()); return { ...status, last_error: null }; });
  register('telegram:update-config', 1, async args => { const update = communicationConnection({ provider: 'telegram', updates: args[0] }); if (update.provider !== 'telegram') throw new Error('Proveedor no válido.'); await authorize('Cambiar configuración de Telegram: '+communicationConnectionPreview(update)); const status = await withoutCommunicationOperation(() => telegram.updateConfig(update.updates)); return { ...status, last_error: null }; });
  register('telegram:test-connection', 0, async () => { await authorize('Comprobar la conexión Telegram de este dispositivo.'); return withoutCommunicationOperation(() => telegram.testConnection()); });
  register('telegram:send-message', 2, async (args, actor) => { const request = communicationMessage({ provider: 'telegram', scope: 'organization', recipient: args[0], text: args[1] }, actor, false); await authorize('Enviar por Telegram a '+request.recipient+':\n'+request.text); return withoutCommunicationOperation(() => telegram.sendMessage(request.recipient, request.text)); });
  register('telegram:list-recent-chats', 0, async () => { await authorize(); return withoutCommunicationOperation(() => telegram.listRecentChats()); });
}
