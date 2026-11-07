import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import { authSourceFixture } from './helpers/auth-source.fixture';
import { exposeAuthApis } from '../preload/auth-apis';
import { createSafeIpc } from '../preload/safe-ipc';
import { publishAuthState } from '../../src/services/auth-state';
import type { AuthStateBridge } from '../../src/shared/auth-state';

type SofiaMockResult = {
  status: 'aplicada' | 'sin-sesion' | 'rechazada' | 'no-disponible';
  userId: string | null;
  accessToken?: string;
  revoked?: true;
};

const sesion = vi.hoisted(() => ({
  getHubSessionUserId: vi.fn(() => 'lia-user-1'),
  applyHubSession: vi.fn(async () => 'aplicada' as const),
  revokeHubSession: vi.fn(async () => undefined),
}));
const projectHub = vi.hoisted(() => ({
  exchangeSofiaToken: vi.fn(async () => ({ success: true })),
  logout: vi.fn(async () => undefined),
}));
const logs = vi.hoisted(() => ({ warn: vi.fn() }));
vi.mock('../utils/logger', () => ({ createLogger: () => logs }));
const sesionSofia = vi.hoisted(() => ({
  currentUserId: null as string | null,
  applySofiaSession: vi.fn(async (_tokens: unknown, expectedUserId: string | null): Promise<SofiaMockResult> => ({
    status: 'aplicada' as const,
    userId: expectedUserId,
  })),
  revokeSofiaSession: vi.fn(async () => undefined),
  isSofiaMainSessionConfigured: vi.fn(() => true),
}));

vi.mock('../main/hub-session', () => sesion);
vi.mock('../main/sofia-session', () => ({
  applySofiaSession: sesionSofia.applySofiaSession,
  getSofiaSessionUserId: () => sesionSofia.currentUserId,
  isSofiaMainSessionConfigured: sesionSofia.isSofiaMainSessionConfigured,
  revokeSofiaSession: sesionSofia.revokeSofiaSession,
}));
vi.mock('../project-hub', () => ({ getProjectHubApiService: () => projectHub }));

import { registerAuthStateHandlers } from '../auth-state-handlers';
import { linkedOpenAIHubUserId } from '../openai-runtime/session-binding';
import { getAuthState, resetAuthStateForTests, setAuthState, type MainAuthState } from '../main/auth-state';
import { getOrganizationContext, setOrganizationContext } from '../main/organization-context';

const ipcMainHarness = ipcMain as unknown as {
  _clearHandlers: () => void;
  _getHandler: (channel: string) => (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown>;
};

let hub: ReturnType<typeof authSourceFixture>;
let orb: ReturnType<typeof authSourceFixture>;
let currentWindow: BrowserWindow | null;
type AuthReply = { ok: boolean; state: MainAuthState };

/** Invoca un handler registrado, como haria el renderer. */
function invocar(canal: 'auth:get-state'): Promise<MainAuthState>;
function invocar(canal: 'auth:set-state', payload: unknown): Promise<AuthReply>;
function invocar(canal: string, ...args: unknown[]): Promise<unknown> {
  return ipcMainHarness._getHandler(canal)(hub.event, ...args);
}

const tokens = () => ({ authenticated: true, userId: 'user-1', organizationId: 'org-1', accessToken: 'lia-acceso', refreshToken: 'lia-refresco', sofiaAccessToken: 'sofia-acceso', sofiaRefreshToken: 'sofia-refresco' });
const denied = { authenticated: false, userId: null };
const effects = () => [sesion.applyHubSession, sesion.revokeHubSession, sesionSofia.applySofiaSession, sesionSofia.revokeSofiaSession, projectHub.exchangeSofiaToken, projectHub.logout];

describe('contrato del canal de estado de sesion', () => {
  it('OpenAI sólo adopta Lia después de aceptar la publicación nativa', async () => {
    const result = await invocar('auth:set-state', tokens()); expect(result.ok).toBe(true);
    expect(linkedOpenAIHubUserId()).toBe('lia-user-1');
    await invocar('auth:set-state', { authenticated: false, userId: null }); expect(() => linkedOpenAIHubUserId()).toThrow();
  });
  it('OpenAI no usa Lia antigua mientras se aplica una publicación nueva', async () => {
    await invocar('auth:set-state', tokens()); let finish!: (value: 'aplicada') => void;
    sesion.applyHubSession.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const pending = invocar('auth:set-state', { ...tokens(), userId: 'user-2' });
    await vi.waitFor(() => expect(getAuthState().userId).toBe('user-2')); expect(() => linkedOpenAIHubUserId()).toThrow();
    finish('aplicada'); expect((await pending).ok).toBe(true); expect(linkedOpenAIHubUserId()).toBe('lia-user-1');
  });
  it('publica selección privada, rechaza identificadores inválidos y la retira al salir', async () => {
    sesionSofia.currentUserId = 'user-1';
    const response = await invocar('auth:set-state', { authenticated: true, userId: 'user-1', organizationId: 'org-1' });
    expect(response.ok).toBe(true); expect(getOrganizationContext()).toMatchObject({ userId: 'user-1', organizationId: 'org-1' });
    expect(await invocar('auth:get-state')).toEqual({ authenticated: true, userId: 'user-1' });
    expect((await invocar('auth:set-state', { authenticated: true, userId: 'user-1', organizationId: '../otra' })).ok).toBe(false);
    await invocar('auth:set-state', { authenticated: false, userId: null });
    expect(getOrganizationContext()).toMatchObject({ userId: null, organizationId: null });
  });
  it('una publicación antigua no restablece la selección después del logout', async () => {
    let release!: (value: SofiaMockResult) => void;
    sesionSofia.applySofiaSession.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    const pending = invocar('auth:set-state', { authenticated: true, userId: 'user-1', organizationId: 'org-1', sofiaAccessToken: 'prueba', sofiaRefreshToken: 'prueba' });
    await invocar('auth:set-state', { authenticated: false, userId: null });
    release({ status: 'aplicada', userId: 'user-1' }); expect((await pending).ok).toBe(false);
    expect(getOrganizationContext().organizationId).toBeNull(); expect(await invocar('auth:get-state')).toEqual({ authenticated: false, userId: null });
  });
  beforeEach(() => {
    vi.clearAllMocks();
    ipcMainHarness._clearHandlers();
    resetAuthStateForTests();
    setOrganizationContext(null, null);
    hub = authSourceFixture(); orb = authSourceFixture(); currentWindow = hub.window;
    sesionSofia.currentUserId = null;
    sesionSofia.applySofiaSession.mockImplementation(async (pair, expectedUserId) => ({
      status: 'aplicada' as const,
      userId: expectedUserId,
      accessToken: (pair as { accessToken: string }).accessToken,
    }));
    sesionSofia.isSofiaMainSessionConfigured.mockReturnValue(true);
    registerAuthStateHandlers(() => currentWindow, () => orb.window);
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it.each(['orbe', 'ajeno', 'subframe', 'sin-marco', 'remoto', 'destruido', 'retirado'])('deniega fuente de escritura sin revelar identidad ni causar efectos: %s', async mode => {
    setAuthState({ authenticated: true, userId: 'privado' });
    let event = hub.event;
    if (mode === 'orbe') event = orb.event;
    if (mode === 'ajeno') event = authSourceFixture().event;
    if (mode === 'subframe') event = { ...event, senderFrame: { ...hub.frame } } as IpcMainInvokeEvent;
    if (mode === 'sin-marco') event = { ...event, senderFrame: null } as IpcMainInvokeEvent;
    if (mode === 'remoto') hub.frame.url = 'https://ajeno.example.invalid/';
    if (mode === 'destruido') hub.destroy();
    if (mode === 'retirado') currentWindow = null;
    expect(await ipcMainHarness._getHandler('auth:set-state')(event, tokens())).toEqual({ ok: false, state: denied });
    expect(await ipcMainHarness._getHandler('auth:set-state')(event, { authenticated: false, userId: null })).toEqual({ ok: false, state: denied });
    expect(getAuthState()).toEqual({ authenticated: true, userId: 'privado' });
    for (const effect of effects()) expect(effect).not.toHaveBeenCalled();
    expect(hub.sender.listenerCount('did-start-navigation')).toBe(0);
  });

  it('sólo Hub y Orbe principales leen, sin exigir sesión previa', async () => {
    expect(await invocar('auth:get-state')).toEqual(denied);
    setAuthState({ authenticated: true, userId: 'privado' });
    expect(await ipcMainHarness._getHandler('auth:get-state')(orb.event)).toEqual({ authenticated: true, userId: 'privado' });
    for (const event of [authSourceFixture().event, { ...hub.event, senderFrame: null }, { ...orb.event, senderFrame: { ...orb.frame } }]) {
      expect(await ipcMainHarness._getHandler('auth:get-state')(event as IpcMainInvokeEvent)).toEqual(denied);
    }
    expect(hub.sender.eventNames()).toEqual([]); expect(orb.sender.eventNames()).toEqual([]);
  });

  it.each([
    { userId: 'u'.repeat(129) }, { userId: 'user\n1' }, { userId: 'u'.repeat(129) + ' ' },
    { accessToken: 't'.repeat(65537) }, { refreshToken: 't'.repeat(65537) },
    { sofiaAccessToken: 't'.repeat(65537) }, { sofiaRefreshToken: 't'.repeat(65537) },
    { accessToken: 42, refreshToken: 43 }, { sofiaAccessToken: {}, sofiaRefreshToken: [] },
    { accessToken: 'token\u0000' }, { sofiaRefreshToken: 'token\n' }, { organizationId: 'org\n' }, { extra: true },
  ])('rechaza límites/tipos antes de servicios y conserva estado: caso %#', async patch => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    setAuthState({ authenticated: true, userId: 'vigente' }); setOrganizationContext('vigente', 'org-vigente');
    expect((await invocar('auth:set-state', { ...tokens(), ...patch })).ok).toBe(false);
    expect(getAuthState().userId).toBe('vigente'); expect(getOrganizationContext().organizationId).toBe('org-vigente');
    for (const effect of effects()) expect(effect).not.toHaveBeenCalled();
    expect(hub.sender.eventNames()).toEqual([]);
  });

  it.each(['navegacion', 'navegacion-detalle', 'retorno', 'in-page', 'caida', 'destruccion', 'ventana', 'marco', 'documento'])('invalida la publicación durante SOFIA: %s', async mode => {
    let release!: (value: SofiaMockResult) => void;
    sesionSofia.applySofiaSession.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    const pending = invocar('auth:set-state', tokens());
    expect(sesionSofia.applySofiaSession).toHaveBeenCalledTimes(1);
    if (mode === 'navegacion' || mode === 'retorno') hub.sender.emit('did-start-navigation', {}, hub.frame.url, false, true);
    if (mode === 'navegacion-detalle') hub.sender.emit('did-start-navigation', { isMainFrame: true });
    if (mode === 'in-page') hub.sender.emit('did-navigate-in-page', { isMainFrame: true });
    if (mode === 'caida') hub.sender.emit('render-process-gone');
    if (mode === 'destruccion') hub.destroy();
    if (mode === 'ventana') currentWindow = authSourceFixture().window;
    if (mode === 'marco') hub.sender.mainFrame = { ...hub.frame };
    if (mode === 'documento') hub.frame.url = 'https://ajeno.example.invalid/';
    release({ status: 'aplicada', userId: 'user-1' });
    expect(await pending).toEqual({ ok: false, state: denied });
    expect(getAuthState()).toEqual(denied); expect(getOrganizationContext().organizationId).toBeNull();
    expect(sesion.applyHubSession).not.toHaveBeenCalled(); expect(projectHub.exchangeSofiaToken).not.toHaveBeenCalled();
    expect(hub.sender.eventNames()).toEqual([]);
  });

  it('no aplica selección organizacional antes de verificar identidad', async () => {
    let release!: (value: SofiaMockResult) => void;
    sesionSofia.applySofiaSession.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    const pending = invocar('auth:set-state', tokens());
    const observed = getOrganizationContext().organizationId;
    release({ status: 'aplicada', userId: 'user-1' }); await pending;
    expect(observed).toBeNull(); expect(getOrganizationContext().organizationId).toBe('org-1');
  });

  it('controla errores de servicios y no registra el error libre ni credenciales', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    sesionSofia.applySofiaSession.mockRejectedValueOnce(new Error('sofia-acceso error-proveedor-privado'));
    await expect(invocar('auth:set-state', tokens())).resolves.toEqual({ ok: false, state: denied });
    expect(logs.warn).toHaveBeenCalled();
    expect(JSON.stringify([warning.mock.calls, logs.warn.mock.calls])).not.toMatch(/sofia-acceso|error-proveedor-privado/);
    expect(hub.sender.eventNames()).toEqual([]);
  });

  it.each([null, [], true, 'estado', {}, { authenticated: false, accessToken: false }])('rechaza payload no estructurado: caso %#', async payload => {
    expect((await invocar('auth:set-state', payload)).ok).toBe(false);
    for (const effect of effects()) expect(effect).not.toHaveBeenCalled();
    expect(hub.sender.eventNames()).toEqual([]);
  });

  it('autoriza antes de leer cualquier campo del payload', async () => {
    const read = vi.fn(() => { throw new Error('no leer'); });
    const payload = Object.defineProperty({}, 'authenticated', { get: read, enumerable: true });
    expect(await ipcMainHarness._getHandler('auth:set-state')(orb.event, payload)).toEqual({ ok: false, state: denied });
    expect(read).not.toHaveBeenCalled();
  });

  it('rechaza argumentos extra y no pierde la publicación activa por intentos inválidos', async () => {
    let release!: (value: SofiaMockResult) => void;
    sesionSofia.applySofiaSession.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    const pending = invocar('auth:set-state', tokens());
    expect(await ipcMainHarness._getHandler('auth:set-state')(hub.event, tokens(), 'extra')).toEqual({ ok: false, state: denied, reason: 'invalid_payload' });
    expect(await ipcMainHarness._getHandler('auth:get-state')(hub.event, 'extra')).toEqual(denied);
    await ipcMainHarness._getHandler('auth:set-state')(orb.event, { authenticated: false, userId: null });
    release({ status: 'aplicada', userId: 'user-1' });
    expect((await pending).ok).toBe(true);
  });

  it('resuelve los getters vivos aunque no hubiera ventana al registrar', async () => {
    currentWindow = null;
    registerAuthStateHandlers(() => currentWindow, () => orb.window);
    currentWindow = hub.window;
    expect((await invocar('auth:set-state', tokens())).state).toEqual({ authenticated: true, userId: 'user-1' });
  });

  it('acepta límites exactos y normaliza cierre sin volver a aplicar credenciales', async () => {
    const value = { ...tokens(), userId: 'u'.repeat(128), organizationId: 'o'.repeat(128), accessToken: 't'.repeat(65536), refreshToken: 'r'.repeat(65536), sofiaAccessToken: 's'.repeat(65536), sofiaRefreshToken: 'q'.repeat(65536) };
    expect((await invocar('auth:set-state', value)).ok).toBe(true);
    expect(sesion.applyHubSession).toHaveBeenCalledTimes(1);
    expect((await invocar('auth:set-state', { ...value, authenticated: false })).state).toEqual(denied);
    expect(sesion.applyHubSession).toHaveBeenCalledTimes(1);
    expect(sesionSofia.applySofiaSession).toHaveBeenCalledTimes(1);
    expect(getOrganizationContext().organizationId).toBeNull(); expect(hub.sender.eventNames()).toEqual([]);
  });

  it.each(['lia', 'canje', 'cierre'])('no devuelve éxito ni identidad tras navegación durante %s', async phase => {
    let release!: () => void;
    const wait = new Promise<void>(resolve => { release = resolve; });
    if (phase === 'lia') sesion.applyHubSession.mockImplementationOnce(async () => { await wait; return 'aplicada'; });
    if (phase === 'canje') projectHub.exchangeSofiaToken.mockImplementationOnce(async () => { await wait; return { success: true }; });
    if (phase === 'cierre') projectHub.logout.mockImplementationOnce(async () => { await wait; return undefined; });
    const pending = invocar('auth:set-state', phase === 'cierre' ? { authenticated: false, userId: null } : tokens());
    const effect = phase === 'lia' ? sesion.applyHubSession : phase === 'canje' ? projectHub.exchangeSofiaToken : projectHub.logout;
    await vi.waitFor(() => expect(effect).toHaveBeenCalledTimes(1));
    hub.sender.emit('did-start-navigation', { isMainFrame: true });
    release();
    expect(await pending).toEqual({ ok: false, state: denied });
    if (phase === 'lia') expect(projectHub.exchangeSofiaToken).not.toHaveBeenCalled();
    expect(hub.sender.eventNames()).toEqual([]);
  });

  it('no revoca una sesión posterior tras fallo tardío de SOFIA', async () => {
    let reject!: (error: Error) => void;
    sesionSofia.applySofiaSession.mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail; }));
    const stale = invocar('auth:set-state', tokens());
    await invocar('auth:set-state', { ...tokens(), userId: 'user-2' });
    reject(new Error('credencial-no-registrar'));
    expect((await stale).ok).toBe(false); expect(getAuthState().userId).toBe('user-2');
    expect(sesion.revokeHubSession).not.toHaveBeenCalled(); expect(sesionSofia.revokeSofiaSession).not.toHaveBeenCalled();
    expect(JSON.stringify(logs.warn.mock.calls)).not.toContain('credencial-no-registrar');
    expect(hub.sender.eventNames()).toEqual([]);
  });

  it('el canje fallido sólo genera un diagnóstico estático', async () => {
    projectHub.exchangeSofiaToken.mockResolvedValueOnce({ success: false, error: 'privado-proveedor', code: 'sofia-acceso' } as { success: boolean });
    expect((await invocar('auth:set-state', tokens())).ok).toBe(true);
    expect(logs.warn).toHaveBeenCalledWith({ code: undefined }, 'Canje SOFIA de Project Hub rechazado.');
    expect(JSON.stringify(logs.warn.mock.calls)).not.toMatch(/privado-proveedor|sofia-acceso/);
  });

  it('recorre wrapper, preload seguro, handler y servicios sin ampliar la allowlist', async () => {
    let api!: AuthStateBridge;
    let event = hub.event;
    const invoke = vi.fn(async (channel: string, ...args: unknown[]) => ipcMainHarness._getHandler(channel)(event, ...args));
    const safeIpc = createSafeIpc({ invoke, send: vi.fn(), on: vi.fn(), off: vi.fn(), removeAllListeners: vi.fn() });
    exposeAuthApis({ exposeInMainWorld: (name, value) => { expect(name).toBe('authState'); api = value as AuthStateBridge; } }, safeIpc);
    vi.stubGlobal('window', { authState: api });
    await publishAuthState(tokens());
    expect(await api.getState()).toEqual({ authenticated: true, userId: 'user-1' });
    expect(sesionSofia.applySofiaSession).toHaveBeenCalledTimes(1); expect(sesion.applyHubSession).toHaveBeenCalledTimes(1);
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    event = orb.event;
    await publishAuthState({ authenticated: false, userId: null });
    expect(warning).toHaveBeenCalledWith('[Auth] El proceso main rechazó la publicación de sesión.');
    expect(getAuthState().userId).toBe('user-1'); expect(projectHub.logout).not.toHaveBeenCalled();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => safeIpc.safeInvoke('auth:arbitrary', tokens())).toThrow('Unauthorized IPC channel');
    expect(invoke).toHaveBeenCalledTimes(3);
  });

  it('aplica la sesion cuando el renderer publica tokens', async () => {
    const resultado = await invocar('auth:set-state', {
      authenticated: true,
      userId: 'user-1',
      accessToken: 'acceso',
      refreshToken: 'refresco',
    });

    expect(resultado.ok).toBe(true);
    expect(sesion.applyHubSession).toHaveBeenCalledWith(
      { accessToken: 'acceso', refreshToken: 'refresco' },
      'user-1',
    );
  });

  it('verifica la sesion SOFIA antes de habilitar el estado protegido', async () => {
    const resultado = await invocar('auth:set-state', {
      authenticated: true,
      userId: 'user-1',
      sofiaAccessToken: 'sofia-acceso',
      sofiaRefreshToken: 'sofia-refresco',
    });

    expect(sesionSofia.applySofiaSession).toHaveBeenCalledWith(
      { accessToken: 'sofia-acceso', refreshToken: 'sofia-refresco' },
      'user-1',
    );
    expect(resultado.state).toEqual({ authenticated: true, userId: 'user-1' });
  });

  it('NUNCA devuelve la credencial: ni al publicar ni al consultar', async () => {
    await invocar('auth:set-state', {
      authenticated: true,
      userId: 'user-1',
      accessToken: 'acceso',
      refreshToken: 'refresco',
      sofiaAccessToken: 'sofia-acceso',
      sofiaRefreshToken: 'sofia-refresco',
    });

    const publicado = await invocar('auth:set-state', {
      authenticated: true,
      userId: 'user-1',
      accessToken: 'acceso',
      refreshToken: 'refresco',
      sofiaAccessToken: 'sofia-acceso',
      sofiaRefreshToken: 'sofia-refresco',
    });
    const consultado = await invocar('auth:get-state');

    for (const respuesta of [JSON.stringify(publicado), JSON.stringify(consultado)]) {
      expect(respuesta).not.toContain('acceso');
      expect(respuesta).not.toContain('refresco');
      expect(respuesta).not.toContain('sofia-acceso');
      expect(respuesta).not.toContain('sofia-refresco');
    }
    expect(consultado).toEqual({ authenticated: true, userId: 'user-1' });
  });

  it('cerrar sesion revoca la credencial', async () => {
    await invocar('auth:set-state', {
      authenticated: true,
      userId: 'user-1',
      accessToken: 'acceso',
      refreshToken: 'refresco',
    });

    await invocar('auth:set-state', { authenticated: false, userId: null });

    expect(sesion.revokeHubSession).toHaveBeenCalled();
    expect(sesionSofia.revokeSofiaSession).toHaveBeenCalled();
    expect(projectHub.logout).toHaveBeenCalled();
    expect(await invocar('auth:get-state')).toEqual({ authenticated: false, userId: null });
  });

  it('aplica la sesión SOFIA sin canjearla con la API web de proyectos ni devolver tokens', async () => {
    const result = await invocar('auth:set-state', {
      authenticated: true,
      userId: 'user-1',
      sofiaAccessToken: 'sofia-token-real',
      sofiaRefreshToken: 'sofia-refresh-real',
    });
    expect(projectHub.exchangeSofiaToken).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain('sofia-token-real');
  });

  it('un payload sin tokens SOFIA sigue siendo valido pero no habilita el gate', async () => {
    const resultado = await invocar('auth:set-state', {
      authenticated: true,
      userId: 'user-1',
    });

    expect(resultado.ok).toBe(true);
    // Una version anterior del renderer no publica tokens: no se falla, se
    // opera sin identidad, que es el estado seguro.
    expect(sesion.applyHubSession).not.toHaveBeenCalled();
    expect(resultado.state).toEqual({ authenticated: false, userId: null });
  });

  it('rechaza una identidad SOFIA que no coincide con el usuario declarado', async () => {
    sesionSofia.applySofiaSession.mockResolvedValueOnce({ status: 'rechazada', userId: null });

    const resultado = await invocar('auth:set-state', {
      ...tokens(),
      userId: 'user-declarado',
    });

    expect(resultado).toEqual({ ok: false, state: denied, reason: 'sofia_unverified' });
    expect(sesion.applyHubSession).not.toHaveBeenCalled();
    expect(projectHub.exchangeSofiaToken).not.toHaveBeenCalled();
  });

  it('canjea Project Hub con el token renovado por la verificación SOFIA', async () => {
    sesionSofia.applySofiaSession.mockResolvedValueOnce({ status: 'aplicada', userId: 'user-1', accessToken: 'sofia-renovado-ficticio' });
    const reply = await invocar('auth:set-state', tokens());
    expect(reply).toEqual({ ok: true, state: { authenticated: true, userId: 'user-1' } });
    expect(projectHub.exchangeSofiaToken).toHaveBeenCalledExactlyOnceWith('sofia-renovado-ficticio');
  });

  it('distingue una sesión revocada de un fallo recuperable de SOFIA', async () => {
    sesionSofia.applySofiaSession.mockResolvedValueOnce({ status: 'rechazada', userId: null, revoked: true });
    expect(await invocar('auth:set-state', tokens())).toEqual({ ok: false, state: denied, reason: 'sofia_revoked' });
    expect(projectHub.exchangeSofiaToken).not.toHaveBeenCalled();
  });

  it('conserva compatibilidad en instalaciones sin SOFIA configurado', async () => {
    sesionSofia.isSofiaMainSessionConfigured.mockReturnValueOnce(false);

    const resultado = await invocar('auth:set-state', {
      authenticated: true,
      userId: 'lia-user',
    });

    expect(resultado.state).toEqual({ authenticated: true, userId: 'lia-user' });
  });

  it('un payload invalido no cambia el estado', async () => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const resultado = await invocar('auth:set-state', { authenticated: 'si' });

    expect(resultado.ok).toBe(false);
    expect(sesion.applyHubSession).not.toHaveBeenCalled();
    aviso.mockRestore();
  });

  it('rechaza identidad vacia y pares de tokens incompletos', async () => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const sinUsuario = await invocar('auth:set-state', { authenticated: true, userId: '   ' });
    const sinRefresh = await invocar('auth:set-state', {
      authenticated: true,
      userId: 'user-1',
      sofiaAccessToken: 'solo-access',
    });

    expect(sinUsuario.ok).toBe(false);
    expect(sinRefresh.ok).toBe(false);
    expect(sesionSofia.applySofiaSession).not.toHaveBeenCalled();
    aviso.mockRestore();
  });
});
