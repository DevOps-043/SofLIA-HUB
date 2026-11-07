import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dialog, ipcMain, type IpcMainInvokeEvent } from 'electron';
import { CommunicationHubService } from '../communication-hub/service';
import { registerCommunicationHubHandlers } from '../communication-hub-handlers';
import { buildDefaultCommunicationHubState } from '../communication-hub/state';
import { authSourceFixture } from './helpers/auth-source.fixture';
import { resetAuthStateForTests, setAuthState } from '../main/auth-state';
import { setOrganizationContext } from '../main/organization-context';
import type { CommunicationHubState } from '../communication-hub/types';
import { exposeCommunicationHubApi } from '../preload/communication-apis';
import { createSafeIpc } from '../preload/safe-ipc';
import { getCommunicationHub } from '../../src/services/communication-hub-service';

const mocks = vi.hoisted(() => ({ load: vi.fn(), save: vi.fn(), user: vi.fn(), memberships: vi.fn(), abort: vi.fn() }));
vi.mock('../communication-hub/state', async original => ({ ...await original<typeof import('../communication-hub/state')>(), loadCommunicationHubState: mocks.load, saveCommunicationHubState: mocks.save }));
vi.mock('../iris/clients', () => ({ getSofiaClient: () => ({ from: () => {
  const q = { select: () => q, eq: () => q, abortSignal: (signal: AbortSignal) => { mocks.abort(signal); return q; }, maybeSingle: () => mocks.user(), then: (resolve: (value: unknown) => unknown) => Promise.resolve(mocks.memberships()).then(resolve) }; return q;
} }) }));
const harness = ipcMain as unknown as { _clearHandlers(): void; _getHandler(name: string): (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<Record<string, unknown>> };
const actor = { userId: 'usuario', organizationId: 'org' };
const message = { provider: 'whatsapp', scope: 'organization', recipient: '5215555555555', text: 'Mensaje ficticio' };
const routes: [string, unknown[]][] = [
  ['get-capabilities', [actor]], ['get-personal-status', [actor]], ['get-org-status', [actor]], ['list-identities', [actor]], ['list-history', [actor]],
  ['update-personal-preferences', [actor, { notificationsEnabled: false }]], ['update-org-connection', [actor, { provider: 'whatsapp', action: 'connect' }]], ['update-policy', [actor, { campaigns: { dailyLimit: 30, requirePreview: true } }]],
  ['send-message', [message]], ['schedule-message', [{ ...message, scheduledAt: '2099-01-01T00:00:00Z' }]],
];
let hub: ReturnType<typeof authSourceFixture>, state: CommunicationHubState, service: CommunicationHubService;
const send = vi.fn(async () => undefined), connect = vi.fn(async () => undefined), tgSend = vi.fn(async () => ({ success: true })), tgConfig = vi.fn(async () => ({ success: true })), history = vi.fn(async () => ['historial privado']);
const call = (name: string, ...args: unknown[]) => harness._getHandler('channels:' + name)(hub.event, ...args);
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
beforeEach(() => {
  vi.clearAllMocks(); harness._clearHandlers(); resetAuthStateForTests(); setAuthState({ authenticated: true, userId: 'usuario' }); setOrganizationContext('usuario', 'org'); hub = authSourceFixture();
  state = buildDefaultCommunicationHubState(); mocks.load.mockReturnValue(state);
  mocks.user.mockResolvedValue({ data: { id: 'usuario' }, error: null }); mocks.memberships.mockReturnValue({ data: [{ organization_id: 'org', role: 'owner', status: 'active' }], error: null });
  service = new CommunicationHubService({ waService: { getStatus: () => ({ connected: true, masterNumber: 'secreto-ajeno' }), getConversationHistory: history, sendText: send, connect, disconnect: async () => {}, saveApiKey: async () => {} }, telegramService: { getStatus: async () => ({ success: true, configured: true, recent_chats: ['privado'] }), sendMessage: tgSend, updateConfig: tgConfig } }); service.init(); mocks.save.mockClear();
  vi.mocked(dialog.showMessageBox).mockResolvedValue({ response: 1, checkboxChecked: false }); registerCommunicationHubHandlers(service, () => [hub.window]);
});
describe('Diez contratos con servicio real y puertos ficticios', () => {
  it('las cuatro capas preservan los diez nombres y el wrapper real', async () => {
    const target: Record<string, unknown> = {}; vi.stubGlobal('window', target);
    const invoke = vi.fn((channel: string, ...args: unknown[]) => harness._getHandler(channel)(hub.event, ...args));
    const ipc = createSafeIpc({ invoke, send: vi.fn(), on: vi.fn(), off: vi.fn(), removeAllListeners: vi.fn() });
    exposeCommunicationHubApi({ exposeInMainWorld: (key, api) => { target[key] = api; } }, ipc);
    const api = getCommunicationHub(), methods = ['getCapabilities', 'getPersonalStatus', 'getOrgStatus', 'listIdentities', 'listHistory', 'updatePersonalPreferences', 'updateOrgConnection', 'updatePolicy', 'sendMessage', 'scheduleMessage'] as const;
    for (const [index, route] of routes.entries()) { expect(await Reflect.apply(api[methods[index]], api, route[1])).toMatchObject({ success: true }); expect(invoke.mock.calls[invoke.mock.calls.length - 1]?.[0]).toBe('channels:' + route[0]); }
    const warn = vi.spyOn(console, 'error').mockImplementation(() => {}); expect(() => ipc.safeInvoke('channels:inventado')).toThrow(); warn.mockRestore();
  });
  it.each(routes)('permite contrato válido %s', async (name, args) => { expect(await call(name, ...args)).toMatchObject({ success: true }); });
  it.each(routes)('niega fuente ajena antes de consultar SOFIA: %s', async (name, args) => {
    expect(await harness._getHandler('channels:' + name)(authSourceFixture().event, ...args)).toMatchObject({ success: false }); expect(mocks.user).not.toHaveBeenCalled(); expect(send).not.toHaveBeenCalled();
  });
  it('rechaza subframe y sesión ausente sin efectos', async () => {
    expect(await harness._getHandler('channels:get-capabilities')({ ...hub.event, senderFrame: { ...hub.frame } } as IpcMainInvokeEvent, actor)).toMatchObject({ success: false });
    setAuthState({ authenticated: false, userId: null }); expect(await call('get-capabilities', actor)).toMatchObject({ success: false }); expect(mocks.user).not.toHaveBeenCalled();
  });
  it.each(['userId', 'organizationId'])('no adopta el hint falso %s', async key => { expect(await call('get-capabilities', { ...actor, [key]: 'ajeno' })).toMatchObject({ success: false }); expect(mocks.user).not.toHaveBeenCalled(); });
  it.each(['perfil-ausente', 'perfil-ajeno', 'sin-membresia', 'otra-organizacion', 'rol-invalido'])('rechaza principal SOFIA inválido: %s', async mode => {
    if (mode === 'perfil-ausente') mocks.user.mockResolvedValue({ data: null, error: null });
    if (mode === 'perfil-ajeno') mocks.user.mockResolvedValue({ data: { id: 'ajeno' }, error: null });
    if (mode === 'sin-membresia') mocks.memberships.mockReturnValue({ data: [], error: null });
    if (mode === 'otra-organizacion') mocks.memberships.mockReturnValue({ data: [{ organization_id: 'ajena', role: 'owner', status: 'active' }], error: null });
    if (mode === 'rol-invalido') mocks.memberships.mockReturnValue({ data: [{ organization_id: 'org', role: 'desconocido', status: 'active' }], error: null });
    expect(await call('send-message', message)).toMatchObject({ success: false }); expect(send).not.toHaveBeenCalled(); expect(dialog.showMessageBox).not.toHaveBeenCalled();
  });
  it('perfil rechazado no publica error privado', async () => { mocks.user.mockRejectedValue(new Error('clave-ficticia-no-publicar')); expect(JSON.stringify(await call('get-capabilities', actor))).not.toContain('clave-ficticia'); });
  it.each(['sesion', 'organizacion', 'navegacion'])('revoca entre usuario SOFIA y membresías: %s', async mode => {
    let finish!: (v: unknown) => void; mocks.user.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })); const pending = call('send-message', message); await vi.waitFor(() => expect(mocks.user).toHaveBeenCalled());
    if (mode === 'sesion') { setAuthState({ authenticated: true, userId: 'otro' }); setAuthState({ authenticated: true, userId: 'usuario' }); }
    if (mode === 'organizacion') { setOrganizationContext('usuario', 'otra'); setOrganizationContext('usuario', 'org'); }
    if (mode === 'navegacion') hub.sender.emit('did-start-navigation', {}, 'https://ajeno.invalid', false, true);
    finish({ data: { id: 'usuario' }, error: null }); expect(await pending).toMatchObject({ success: false }); expect(mocks.memberships).not.toHaveBeenCalled(); expect(send).not.toHaveBeenCalled();
  });
  it('aprobación revisa copia del mensaje y no ejecuta antes de confirmar', async () => {
    let finish!: (v: { response: number; checkboxChecked: boolean }) => void; vi.mocked(dialog.showMessageBox).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const input = { ...message }; const pending = call('send-message', input); await vi.waitFor(() => expect(dialog.showMessageBox).toHaveBeenCalled()); input.text = 'modificado'; expect(send).not.toHaveBeenCalled(); finish({ response: 1, checkboxChecked: false }); expect(await pending).toMatchObject({ success: true }); expect(send).toHaveBeenCalledWith('5215555555555@s.whatsapp.net', 'Mensaje ficticio');
  });
  it('cancelar aprobación no envía ni programa', async () => { vi.mocked(dialog.showMessageBox).mockResolvedValue({ response: 0, checkboxChecked: false }); expect(await call('send-message', message)).toMatchObject({ success: false }); expect(await call('schedule-message', { ...message, scheduledAt: '2099-01-01T00:00:00Z' })).toMatchObject({ success: false }); expect(send).not.toHaveBeenCalled(); expect(state.scheduledMessages).toEqual([]); });
  it('aprobación tardía tras cambiar organización no envía', async () => {
    let finish!: (v: { response: number; checkboxChecked: boolean }) => void; vi.mocked(dialog.showMessageBox).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })); const pending = call('send-message', message); await vi.waitFor(() => expect(dialog.showMessageBox).toHaveBeenCalled()); setOrganizationContext('usuario', 'otra'); finish({ response: 1, checkboxChecked: false }); expect(await pending).toMatchObject({ success: false }); expect(send).not.toHaveBeenCalled();
  });
  it('revalida rol SOFIA después de aprobar y antes de escribir política', async () => {
    vi.mocked(dialog.showMessageBox).mockImplementationOnce(async () => { mocks.memberships.mockReturnValue({ data: [{ organization_id: 'org', role: 'member', status: 'active' }], error: null }); return { response: 1, checkboxChecked: false }; });
    expect(await call('update-policy', actor, { campaigns: { dailyLimit: 40 } })).toMatchObject({ success: false }); expect(state.policies.org).toBeUndefined();
  });
  it('member no cambia política o conexión de organización', async () => { mocks.memberships.mockReturnValue({ data: [{ organization_id: 'org', role: 'member', status: 'active' }], error: null }); expect(await call('update-policy', actor, { campaigns: { dailyLimit: 40 } })).toMatchObject({ success: false }); expect(await call('update-org-connection', actor, { provider: 'whatsapp', action: 'connect' })).toMatchObject({ success: false }); expect(connect).not.toHaveBeenCalled(); expect(dialog.showMessageBox).not.toHaveBeenCalled(); });
  it('estado operativo no devuelve chats o números globales', async () => { const result = await call('get-personal-status', actor); expect(result).toMatchObject({ whatsapp: { connected: true }, telegram: { configured: true } }); expect(JSON.stringify(result)).not.toMatch(/secreto-ajeno|recent_chats|privado/); });
  it('no vincula un chat que pertenece a otro usuario', async () => { state.telegramIdentities['12345'] = { chatId: '12345', userId: 'otro', organizationId: 'org', createdAt: '' }; expect(await call('update-personal-preferences', actor, { telegramChatId: '12345' })).toMatchObject({ success: false }); expect(state.telegramIdentities['12345'].userId).toBe('otro'); expect(dialog.showMessageBox).not.toHaveBeenCalled(); });
  it('filtra identidades e historial por organización y propietario personal', async () => {
    for (const [id, userId, organizationId] of [['propio', 'usuario', 'org'], ['ajeno-org', 'otro', 'org'], ['otra-org', 'usuario', 'otra']]) {
      state.telegramIdentities[id] = { chatId: id, userId, organizationId, createdAt: '' };
      state.scheduledMessages.push({ id, provider: 'telegram', scope: 'personal', recipient: id, text: id, scheduledAt: '', createdAt: '', createdBy: userId, organizationId });
      state.audit.push({ id, provider: 'telegram', scope: 'personal', userId, organizationId, action: 'prueba', allowed: true, role: 'member', timestamp: '' });
    }
    state.audit.push({ id: 'personal-owner-antiguo', provider: 'whatsapp', scope: 'organization', userId: 'otro', organizationId: 'org', action: 'channels:send-message', allowed: true, role: 'owner', timestamp: '', metadata: { scope: 'personal' } });
    const identities = await call('list-identities', actor), result = await call('list-history', actor);
    expect(identities.telegram).toHaveLength(2); expect(JSON.stringify(identities)).not.toContain('otra-org');
    expect(result.scheduledMessages).toEqual([expect.objectContaining({ id: 'propio' })]); expect(JSON.stringify(result)).not.toMatch(/ajeno-org|personal-owner-antiguo/); expect(result.whatsapp).toEqual([]); expect(history).not.toHaveBeenCalled();
  });
  it('conserva acceso runtime al historial sin fabricar contexto IPC', async () => { const result = await service.listHistory(actor); expect(result.whatsapp).toEqual(['historial privado']); expect(history).toHaveBeenCalledOnce(); });
  it('limita ocho consultas físicas y retiene cuota durante cancelación lógica', async () => {
    const finishes: ((v: unknown) => void)[] = []; mocks.user.mockImplementation(() => new Promise(resolve => { finishes.push(resolve); }));
    const pending = Array.from({ length: 8 }, () => call('get-capabilities', actor)); await vi.waitFor(() => expect(finishes).toHaveLength(8));
    expect(await call('get-capabilities', actor)).toMatchObject({ success: false }); setAuthState({ authenticated: false, userId: null }); setAuthState({ authenticated: true, userId: 'usuario' });
    expect(await call('get-capabilities', actor)).toMatchObject({ success: false }); expect(finishes).toHaveLength(8);
    for (const finish of finishes) finish({ data: { id: 'usuario' }, error: null }); for (const result of await Promise.all(pending)) expect(result.success).toBe(false);
    mocks.user.mockResolvedValue({ data: { id: 'usuario' }, error: null }); expect(await call('get-capabilities', actor)).toMatchObject({ success: true });
  });
  it('una confirmación pendiente no abre otro diálogo', async () => {
    let finish!: (v: { response: number; checkboxChecked: boolean }) => void; vi.mocked(dialog.showMessageBox).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const pending = call('send-message', message); await vi.waitFor(() => expect(dialog.showMessageBox).toHaveBeenCalled()); expect(await call('send-message', message)).toMatchObject({ success: false }); expect(dialog.showMessageBox).toHaveBeenCalledOnce(); finish({ response: 0, checkboxChecked: false }); await pending; expect(send).not.toHaveBeenCalled();
  });
  it('no devuelve respuesta tardía de transporte después de logout', async () => {
    let finish!: () => void; send.mockImplementationOnce(() => new Promise(resolve => { finish = () => resolve(undefined); })); const pending = call('send-message', message); await vi.waitFor(() => expect(send).toHaveBeenCalled()); setAuthState({ authenticated: false, userId: null }); finish(); expect(await pending).toMatchObject({ success: false });
  });
  it('un miembro no usa scope personal para enviar o programar a grupos', async () => {
    mocks.memberships.mockReturnValue({ data: [{ organization_id: 'org', role: 'member', status: 'active' }], error: null }); const group = { ...message, scope: 'personal', recipient: '5215555555555@g.us' };
    expect(await call('send-message', group)).toMatchObject({ success: false }); expect(await call('schedule-message', { ...group, scheduledAt: '2099-01-01T00:00:00Z' })).toMatchObject({ success: false }); expect(send).not.toHaveBeenCalled(); expect(dialog.showMessageBox).not.toHaveBeenCalled();
  });
  it('arrays con apariencia de enums no eluden capacidades de grupos', async () => {
    mocks.memberships.mockReturnValue({ data: [{ organization_id: 'org', role: 'member', status: 'active' }], error: null });
    expect(await call('send-message', { ...message, provider: ['whatsapp'], scope: ['organization'], recipient: '5215555555555@g.us' })).toMatchObject({ success: false }); expect(send).not.toHaveBeenCalled(); expect(dialog.showMessageBox).not.toHaveBeenCalled();
  });
  it('la confirmación de conexión oculta la clave', async () => {
    expect(await call('update-org-connection', actor, { provider: 'telegram', updates: { bot_token: 'clave-ficticia-no-publicar' } })).toMatchObject({ success: true });
    expect(JSON.stringify(vi.mocked(dialog.showMessageBox).mock.calls)).not.toContain('clave-ficticia-no-publicar'); expect(tgConfig).toHaveBeenCalledWith({ bot_token: 'clave-ficticia-no-publicar' });
  });
  it('rechaza aridad/campos y solicitudes excesivas antes de consultar SOFIA', async () => {
    expect(await call('get-capabilities', actor, 'extra')).toMatchObject({ success: false });
    expect(await call('update-personal-preferences', actor, { role: 'owner' })).toMatchObject({ success: false });
    expect(await call('send-message', { ...message, text: 'x'.repeat(129 * 1024) })).toMatchObject({ success: false }); expect(mocks.user).not.toHaveBeenCalled(); expect(hub.sender.eventNames()).toEqual([]);
  });
  it('respuesta excesiva no se publica por IPC', async () => { vi.spyOn(service, 'getCapabilities').mockResolvedValueOnce({ success: true, data: 'x'.repeat(257 * 1024) }); expect(await call('get-capabilities', actor)).toMatchObject({ success: false }); expect(hub.sender.eventNames()).toEqual([]); });
  it('conserva teléfono con formato y envío Telegram por servicios existentes', async () => {
    expect(await call('send-message', { ...message, recipient: '+52 (155) 555-55555' })).toMatchObject({ success: true }); expect(send).toHaveBeenCalledWith('5215555555555@s.whatsapp.net', message.text);
    expect(await call('send-message', { ...message, provider: 'telegram', recipient: '-10012345' })).toMatchObject({ success: true }); expect(tgSend).toHaveBeenCalledWith('-10012345', message.text);
  });
  it('deadline aborta la consulta y rechaza su respuesta tardía', async () => {
    vi.useFakeTimers(); let finish!: (v: unknown) => void; mocks.user.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })); const pending = call('get-capabilities', actor);
    expect(mocks.user).toHaveBeenCalled(); const signal = mocks.abort.mock.calls[0][0] as AbortSignal; expect(signal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(180000); expect(signal.aborted).toBe(true); finish({ data: { id: 'usuario' }, error: null }); expect(await pending).toMatchObject({ success: false }); expect(mocks.memberships).not.toHaveBeenCalled();
  });
  it('polling permanente iniciado por conexión no hereda lease IPC cerrada', async () => {
    vi.useFakeTimers(); let result: Record<string, unknown> | undefined;
    tgConfig.mockImplementationOnce(async () => { setTimeout(() => { void service.listHistory(actor).then(value => { result = value; }); }, 100); return { success: true }; });
    expect(await call('update-org-connection', actor, { provider: 'telegram', updates: { enabled: true } })).toMatchObject({ success: true });
    await vi.advanceTimersByTimeAsync(100); expect(result?.whatsapp).toEqual(['historial privado']);
  });
});
