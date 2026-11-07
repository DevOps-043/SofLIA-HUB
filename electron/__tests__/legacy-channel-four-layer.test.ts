import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { legacyChannelFixture, legacyMocks } from './helpers/legacy-channel.fixture';
import { createSafeIpc } from '../preload/safe-ipc';
import { exposeWhatsAppApi } from '../preload/communication-apis';
import { exposeRemoteApis } from '../preload/remote-apis';
import { DEFAULT_WHATSAPP_PERSONALIZATION } from '../../src/components/whatsapp-setup/defaultStatus';
import { getWhatsAppApi } from '../../src/services/whatsapp-api';
import { getTelegramStatus, updateTelegramConfig, testTelegramConnection, sendTelegramMessage, listTelegramRecentChats } from '../../src/services/telegram-service';

const actor = { userId: 'usuario', organizationId: 'org' };
let f: ReturnType<typeof legacyChannelFixture>;
let invoke: ReturnType<typeof vi.fn<(channel: string, ...args: unknown[]) => Promise<Record<string, unknown>>>>;
beforeEach(() => {
  f = legacyChannelFixture();
  const target: Record<string, unknown> = {};
  vi.stubGlobal('window', target);
  invoke = vi.fn((channel: string, ...args: unknown[]) => f.call(channel, ...args));
  const ipc = createSafeIpc({ invoke, send: vi.fn(), on: vi.fn(), off: vi.fn(), removeAllListeners: vi.fn() });
  const bridge = { exposeInMainWorld: (name: string, api: unknown) => { target[name] = api; } };
  exposeWhatsAppApi(bridge, ipc); exposeRemoteApis(bridge, ipc);
});
afterEach(() => vi.unstubAllGlobals());
const routes: Array<[string, () => Promise<unknown>]> = [
  ['whatsapp:connect', () => getWhatsAppApi().connect()],
  ['whatsapp:disconnect', () => getWhatsAppApi().disconnect()],
  ['whatsapp:get-status', () => getWhatsAppApi().getStatus()],
  ['whatsapp:get-conversation-history', () => getWhatsAppApi().getConversationHistory({ actor, limit: 25 })],
  ['whatsapp:get-conversation-history-stats', () => getWhatsAppApi().getConversationHistoryStats(actor)],
  ['whatsapp:set-allowed-numbers', () => getWhatsAppApi().setAllowedNumbers(['5215555555555'], actor)],
  ['whatsapp:set-access-config', () => getWhatsAppApi().setAccessConfig({ actor, masterPermissions: ['files_read'] })],
  ['whatsapp:set-group-config', () => getWhatsAppApi().setGroupConfig({ actor, groupPolicy: 'disabled' })],
  ['whatsapp:set-personalization', () => getWhatsAppApi().setPersonalization({ actor, globalPersonalization: { ...DEFAULT_WHATSAPP_PERSONALIZATION, displayName: 'Prueba' } })],
  ['whatsapp:set-api-key', () => getWhatsAppApi().setApiKey('clave-ficticia')],
  ['telegram:get-status', () => getTelegramStatus()],
  ['telegram:update-config', () => updateTelegramConfig({ enabled: false })],
  ['telegram:test-connection', () => testTelegramConnection()],
  ['telegram:send-message', () => sendTelegramMessage('-10012345', 'Prueba')],
  ['telegram:list-recent-chats', () => listTelegramRecentChats()],
];
describe('Renderer, preload y handlers de canales heredados', () => {
  it.each(routes)('conecta %s con el handler autorizado', async (channel, action) => {
    const result = await action(); expect(invoke).toHaveBeenCalledWith(channel, ...invoke.mock.calls[0].slice(1)); expect(result).not.toMatchObject({ success: false });
  });
  it('un miembro no modifica la configuración a través del wrapper', async () => {
    legacyMocks.memberships.mockReturnValue({ data: [{ organization_id: 'org', role: 'member', status: 'active' }], error: null });
    expect(await getWhatsAppApi().setGroupConfig({ actor, groupPolicy: 'open' })).toMatchObject({ success: false });
    expect(f.wa.setGroupConfig).not.toHaveBeenCalled();
  });
  it('una cancelación se propaga al wrapper sin conectar el proveedor', async () => {
    const { dialog } = await import('electron');
    vi.mocked(dialog.showMessageBox).mockResolvedValueOnce({ response: 0, checkboxChecked: false });
    expect(await getWhatsAppApi().connect()).toMatchObject({ success: false });
    expect(f.wa.connect).not.toHaveBeenCalled();
  });
  it('serializa fechas del historial antes de cruzar preload', async () => {
    const since = new Date('2026-01-01T00:00:00.000Z');
    await getWhatsAppApi().getConversationHistory({ actor, since });
    expect(invoke.mock.calls[0][1]).toMatchObject({ since: since.getTime() });
  });
  it('rechaza canal fuera de allowlist antes del transporte', () => {
    const safe = createSafeIpc({ invoke, send: vi.fn(), on: vi.fn(), off: vi.fn(), removeAllListeners: vi.fn() });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => safe.safeInvoke('whatsapp:inexistente')).toThrow(); expect(invoke).not.toHaveBeenCalled(); spy.mockRestore();
  });
});
