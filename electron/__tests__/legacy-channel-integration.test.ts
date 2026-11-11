import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dialog } from 'electron';
import { authSourceFixture } from './helpers/auth-source.fixture';
import { legacyChannelFixture, legacyHarness, legacyMocks } from './helpers/legacy-channel.fixture';
import { setAuthState } from '../main/auth-state';
import { setOrganizationContext } from '../main/organization-context';
const actor = { userId: 'usuario', organizationId: 'org' };
const routes: [string, unknown[]][] = [
  ['whatsapp:connect', []], ['whatsapp:disconnect', []], ['whatsapp:get-status', []], ['whatsapp:get-conversation-history', [{ actor, limit: 25 }]], ['whatsapp:get-conversation-history-stats', [actor]],
  ['whatsapp:set-allowed-numbers', [['5215555555555'], actor]], ['whatsapp:set-access-config', [{ actor, masterPermissions: ['files_read'] }]], ['whatsapp:set-group-config', [{ actor, groupPolicy: 'disabled' }]], ['whatsapp:set-personalization', [{ actor, globalPersonalization: { displayName: 'Prueba' } }]], ['whatsapp:set-api-key', ['clave-ficticia-solo-prueba']],
  ['telegram:get-status', []], ['telegram:update-config', [{ enabled: false }]], ['telegram:test-connection', []], ['telegram:send-message', ['-10012345', 'Prueba']], ['telegram:list-recent-chats', []],
];
let f: ReturnType<typeof legacyChannelFixture>;
beforeEach(() => { f = legacyChannelFixture(); });
describe('Quince rutas heredadas activas', () => {
  it.each(routes)('conserva operación válida %s', async (channel, args) => expect(await f.call(channel, ...args)).toMatchObject({ success: true }));
  it.each(routes)('rechaza fuente ajena %s', async (channel, args) => { expect(await legacyHarness._getHandler(channel)(authSourceFixture().event, ...args)).toMatchObject({ success: false }); expect(legacyMocks.user).not.toHaveBeenCalled(); });
  it.each(routes)('member no administra transporte global %s', async (channel, args) => { legacyMocks.memberships.mockReturnValue({ data: [{ organization_id: 'org', role: 'member', status: 'active' }], error: null }); expect(await f.call(channel, ...args)).toMatchObject({ success: false }); expect(f.wa.connect).not.toHaveBeenCalled(); expect(f.telegram.sendMessage).not.toHaveBeenCalled(); expect(dialog.showMessageBox).not.toHaveBeenCalled(); });
  it('no inicializa agente si falla persistir la clave', async () => { f.wa.saveApiKey.mockRejectedValueOnce(new Error('clave-ficticia-no-publicar')); const reply = await f.call('whatsapp:set-api-key', 'otra-clave-ficticia'); expect(reply.success).toBe(false); expect(f.init).not.toHaveBeenCalled(); expect(JSON.stringify(reply)).not.toContain('clave-ficticia'); });
  it('no activa agente si cambia sesión tras persistir', async () => { f.wa.saveApiKey.mockImplementationOnce(async () => { setAuthState({ authenticated: false, userId: null }); }); expect(await f.call('whatsapp:set-api-key', 'otra-clave-ficticia')).toMatchObject({ success: false }); expect(f.init).not.toHaveBeenCalled(); });
  it('actor falso no alcanza consulta ni configuración', async () => { expect(await f.call('whatsapp:set-group-config', { actor: { userId: 'otro' }, groupPolicy: 'open' })).toMatchObject({ success: false }); expect(legacyMocks.user).not.toHaveBeenCalled(); expect(f.wa.setGroupConfig).not.toHaveBeenCalled(); });
  it('cancelar aprobación no guarda, conecta o envía', async () => { vi.mocked(dialog.showMessageBox).mockResolvedValue({ response: 0, checkboxChecked: false }); expect(await f.call('whatsapp:connect')).toMatchObject({ success: false }); expect(await f.call('telegram:send-message', '-12345', 'Prueba')).toMatchObject({ success: false }); expect(f.wa.connect).not.toHaveBeenCalled(); expect(f.telegram.sendMessage).not.toHaveBeenCalled(); });
  it('se revalida rol tras aprobación', async () => { vi.mocked(dialog.showMessageBox).mockImplementationOnce(async () => { legacyMocks.memberships.mockReturnValue({ data: [{ organization_id: 'org', role: 'member', status: 'active' }], error: null }); return { response: 1, checkboxChecked: false }; }); expect(await f.call('whatsapp:disconnect')).toMatchObject({ success: false }); expect(f.wa.disconnect).not.toHaveBeenCalled(); });
  it('comparten aprobación entre canales antiguos y nuevos', async () => {
    let finish!: (v: { response: number; checkboxChecked: boolean }) => void; vi.mocked(dialog.showMessageBox).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const pending = f.call('whatsapp:connect'); await vi.waitFor(() => expect(dialog.showMessageBox).toHaveBeenCalled()); expect(await f.call('channels:update-policy', actor, { campaigns: { dailyLimit: 10 } })).toMatchObject({ success: false }); expect(await f.call('telegram:test-connection')).toMatchObject({ success: false }); expect(dialog.showMessageBox).toHaveBeenCalledOnce(); finish({ response: 0, checkboxChecked: false }); await pending;
  });
  it.each(['sesion', 'organizacion', 'navegacion'])('A/B/A durante consulta no revela estado: %s', async mode => {
    let finish!: (v: unknown) => void; legacyMocks.user.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })); const pending = f.call('whatsapp:get-status'); await vi.waitFor(() => expect(legacyMocks.user).toHaveBeenCalled());
    if (mode === 'sesion') { setAuthState({ authenticated: true, userId: 'otro' }); setAuthState({ authenticated: true, userId: 'usuario' }); }
    if (mode === 'organizacion') { setOrganizationContext('usuario', 'otra'); setOrganizationContext('usuario', 'org'); }
    if (mode === 'navegacion') f.hub.sender.emit('did-start-navigation', {}, 'https://ajeno.invalid', false, true);
    finish({ data: { id: 'usuario' }, error: null }); expect(await pending).toMatchObject({ success: false }); expect(f.wa.getStatus).not.toHaveBeenCalled();
  });
  it('estado público retira error privado', async () => { const wa = await f.call('whatsapp:get-status'), tg = await f.call('telegram:get-status'); expect(wa.lastDeliveryError).toBeUndefined(); expect(tg.last_error).toBeNull(); });
});
