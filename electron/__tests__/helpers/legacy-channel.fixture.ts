import { EventEmitter } from 'node:events';
import { vi } from 'vitest';
import { dialog, ipcMain, type IpcMainInvokeEvent } from 'electron';
import { authSourceFixture } from './auth-source.fixture';
import { resetAuthStateForTests, setAuthState } from '../../main/auth-state';
import { setOrganizationContext } from '../../main/organization-context';
import { CommunicationHubService } from '../../communication-hub/service';
import { buildDefaultCommunicationHubState } from '../../communication-hub/state';
import { registerMainServiceIpcHandlers } from '../../main/service-ipc';
import { registerTelegramHandlers } from '../../telegram-handlers';
import { registerCommunicationHubHandlers } from '../../communication-hub-handlers';
import { DEFAULT_CONFIG } from '../../whatsapp/types';
import type { WhatsAppService } from '../../whatsapp-service';
import type { TelegramService } from '../../telegram-service';
import type { MainRuntimeState } from '../../main/runtime-state';

const legacyMocks = vi.hoisted(() => ({ load: vi.fn(), save: vi.fn(), user: vi.fn(), memberships: vi.fn() }));
export { legacyMocks };
vi.mock('../../learning-live-handlers', () => ({ registerLearningLiveHandlers: vi.fn() }));
vi.mock('../../communication-hub/state', async original => ({ ...await original<typeof import('../../communication-hub/state')>(), loadCommunicationHubState: legacyMocks.load, saveCommunicationHubState: legacyMocks.save }));
vi.mock('../../iris/clients', () => ({ getSofiaClient: () => ({ from: () => { const q = { select: () => q, eq: () => q, abortSignal: () => q, maybeSingle: () => legacyMocks.user(), then: (resolve: (v: unknown) => unknown) => Promise.resolve(legacyMocks.memberships()).then(resolve) }; return q; } }) }));
export const legacyHarness = ipcMain as unknown as { _clearHandlers(): void; _getHandler(channel: string): (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<Record<string, unknown>> };
/** Servicios/diálogos sustituidos: sin GUI, archivos de usuario, proveedor o mensajes reales. */
export function legacyChannelFixture() {
  legacyHarness._clearHandlers(); vi.clearAllMocks(); resetAuthStateForTests(); setAuthState({ authenticated: true, userId: 'usuario' }); setOrganizationContext('usuario', 'org');
  legacyMocks.load.mockReturnValue(buildDefaultCommunicationHubState()); legacyMocks.user.mockResolvedValue({ data: { id: 'usuario' }, error: null }); legacyMocks.memberships.mockReturnValue({ data: [{ organization_id: 'org', role: 'owner', status: 'active' }], error: null });
  vi.mocked(dialog.showMessageBox).mockResolvedValue({ response: 1, checkboxChecked: false });
  const hub = authSourceFixture(), orb = authSourceFixture(); Object.assign(hub.sender, { send: vi.fn() }); Object.assign(orb.sender, { send: vi.fn() });
  const status = { ...structuredClone(DEFAULT_CONFIG), connected: true, phoneNumber: '5215555555555', qr: 'qr-ficticio', lastDeliveryError: { reason: 'error privado' } };
  const wa = Object.assign(new EventEmitter(), { getStatus: vi.fn(() => status), connect: vi.fn(async () => {}), disconnect: vi.fn(async () => {}), saveApiKey: vi.fn(async () => {}), setAllowedNumbers: vi.fn(async () => {}), setAccessConfig: vi.fn(async () => {}), setGroupConfig: vi.fn(async () => {}), setPersonalization: vi.fn(async () => {}), getConversationHistory: vi.fn(async () => []), getConversationHistoryStats: vi.fn(async () => ({ total: 0 })), sendText: vi.fn(async () => {}) });
  const telegram = { getStatus: vi.fn(async () => ({ success: true, configured: true, enabled: true, polling: true, recent_chats: [], last_error: 'error privado' })), updateConfig: vi.fn(async () => ({ success: true })), testConnection: vi.fn(async () => ({ success: true })), sendMessage: vi.fn(async () => ({ success: true })), listRecentChats: vi.fn(async () => ({ success: true, chats: [] })) };
  const service = new CommunicationHubService({ waService: wa, telegramService: telegram }); service.init();
  const init = vi.fn(), briefing = vi.fn();
  registerMainServiceIpcHandlers({ services: { waService: wa as unknown as WhatsAppService, communicationHubService: service, dailyBriefingService: { updateConfig: briefing } }, state: { win: hub.window, orbWin: orb.window } as unknown as MainRuntimeState, initWhatsAppAgent: init });
  registerTelegramHandlers(telegram as unknown as TelegramService, service, () => [hub.window, orb.window]); registerCommunicationHubHandlers(service, () => [hub.window, orb.window]);
  const call = (channel: string, ...args: unknown[]) => legacyHarness._getHandler(channel)(hub.event, ...args);
  return { hub, orb, wa, telegram, status, service, init, briefing, call, send: () => (hub.sender as unknown as { send: ReturnType<typeof vi.fn> }).send };
}
