import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dialog, ipcMain, type IpcMainInvokeEvent } from 'electron';
import { authSourceFixture } from './helpers/auth-source.fixture';
import { resetAuthStateForTests, setAuthState } from '../main/auth-state';
import { registerRemoteNodeHandlers } from '../remote-node-handlers';
import { exposeRemoteApis } from '../preload/remote-apis';
import { createSafeIpc } from '../preload/safe-ipc';
import type { RemoteNodeApi } from '../../src/shared/remote-node';
import { listRemoteNodes, registerRemoteNode } from '../../src/services/remote-node-service';

const service = vi.hoisted(() => Object.fromEntries([
  'getHostStatus', 'updateHostConfig', 'listNodes', 'registerNode', 'removeNode', 'testNode',
  'openApplicationOnNode', 'runBackgroundCommandOnNode', 'executeDesktopTaskOnNode',
  'takeScreenshotOnNode', 'listProcessSessionsOnNode', 'pollProcessSessionOnNode', 'killProcessSessionOnNode',
].map(name => [name, vi.fn()])));
vi.mock('../remote-node-service', () => ({ remoteNodeService: {
  ...service, captureConfigurationReview: (context: { assertCurrent: () => void }) => context,
} }));
const ipc = ipcMain as unknown as { _clearHandlers(): void; _getHandler(channel: string): (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown> };
const node = { id: 'node-1', name: 'Nodo ficticio', baseUrl: 'https://node.invalid', token: 'token-ficticio', enabled: true, createdAt: '2026-10-26', updatedAt: '2026-10-26' };
const cases = [
  { channel: 'get-host-status', method: 'getHostStatus', args: [] },
  { channel: 'update-host-config', method: 'updateHostConfig', args: [{ enabled: false }], confirm: true },
  { channel: 'list-nodes', method: 'listNodes', args: [] },
  { channel: 'register-node', method: 'registerNode', args: [{ name: 'Nodo nuevo', base_url: 'https://node.invalid', token: 'token-ficticio' }], confirm: true },
  { channel: 'remove-node', method: 'removeNode', args: ['node-1'], confirm: true },
  { channel: 'test-node', method: 'testNode', args: ['node-1'] },
  { channel: 'open-application', method: 'openApplicationOnNode', args: ['node-1', { path: 'calculadora' }], confirm: true },
  { channel: 'run-background-command', method: 'runBackgroundCommandOnNode', args: ['node-1', { command: 'comando ficticio' }], confirm: true },
  { channel: 'execute-task', method: 'executeDesktopTaskOnNode', args: ['node-1', { task: 'Tarea ficticia' }], confirm: true },
  { channel: 'take-screenshot', method: 'takeScreenshotOnNode', args: ['node-1', {}], confirm: true },
  { channel: 'list-process-sessions', method: 'listProcessSessionsOnNode', args: ['node-1'] },
  { channel: 'poll-process-session', method: 'pollProcessSessionOnNode', args: ['node-1', 'session-1'] },
  { channel: 'kill-process-session', method: 'killProcessSessionOnNode', args: ['node-1', 'session-1'], confirm: true },
] as const;
let hub: ReturnType<typeof authSourceFixture>;
let orb: ReturnType<typeof authSourceFixture>;
const invoke = (channel: string, args: readonly unknown[], event = hub.event) => ipc._getHandler('remote-node:' + channel)(event, ...args);
const settled = (channel: string, args: readonly unknown[], event = hub.event) => Promise.allSettled([invoke(channel, args, event)]);
function approvalOptions(): unknown { const args: unknown[] = vi.mocked(dialog.showMessageBox).mock.calls[0]; return args[1]; }
beforeEach(() => {
  vi.clearAllMocks(); ipc._clearHandlers(); resetAuthStateForTests();
  setAuthState({ authenticated: true, userId: 'usuario-qa' });
  hub = authSourceFixture(); orb = authSourceFixture();
  for (const method of Object.values(service)) method.mockReset().mockResolvedValue({ success: true });
  service.listNodes.mockResolvedValue([node]);
  service.getHostStatus.mockResolvedValue({ success: true, token: 'token-host-ficticio', node_name: 'Host de prueba' });
  vi.mocked(dialog.showMessageBox).mockResolvedValue({ response: 1, checkboxChecked: false });
  Reflect.apply(registerRemoteNodeHandlers, undefined, [() => hub.window, () => orb.window]);
});
afterEach(() => { resetAuthStateForTests(); vi.restoreAllMocks(); vi.useRealTimers(); vi.unstubAllGlobals(); });
describe('Autorización nativa de los 13 canales Remote Node', () => {
  it.each(cases)('rechaza sin sesión: $channel', async item => {
    resetAuthStateForTests(); await settled(item.channel, item.args);
    expect(Object.values(service).every(method => method.mock.calls.length === 0)).toBe(true);
    expect(dialog.showMessageBox).not.toHaveBeenCalled();
  });
  it.each(cases)('rechaza ventana ajena: $channel', async item => {
    await settled(item.channel, item.args, authSourceFixture().event);
    expect(Object.values(service).every(method => method.mock.calls.length === 0)).toBe(true);
  });
  it.each(cases)('rechaza subframe: $channel', async item => {
    const event = { ...hub.event, senderFrame: { ...hub.frame } } as unknown as IpcMainInvokeEvent;
    await settled(item.channel, item.args, event);
    expect(Object.values(service).every(method => method.mock.calls.length === 0)).toBe(true);
  });
  it.each(cases)('rechaza documento ajeno: $channel', async item => {
    hub.frame.url = 'https://ajeno.invalid'; await settled(item.channel, item.args);
    expect(Object.values(service).every(method => method.mock.calls.length === 0)).toBe(true);
  });
  it.each(cases)('admite Hub y conserva argumentos: $channel', async item => {
    const result = await invoke(item.channel, item.args);
    expect(result).toMatchObject({ success: true }); expect(service[item.method]).toHaveBeenCalledOnce();
    expect(service[item.method].mock.calls[0].slice(0, item.args.length)).toEqual(item.args);
    if ('confirm' in item) {
      const options = approvalOptions();
      expect(options).toMatchObject({ defaultId: 0, cancelId: 0, buttons: ['Cancelar', 'Confirmar'] });
      expect(JSON.stringify(options)).not.toContain(node.token); expect(JSON.stringify(options)).not.toContain('token-host-ficticio');
    }
    expect(hub.sender.listenerCount('did-start-navigation')).toBe(0);
  });
  it('admite lectura desde Orbe registrado', async () => {
    expect(await invoke('list-nodes', [], orb.event)).toMatchObject({ success: true, nodes: [node] });
  });
  it.each(cases.filter(item => 'confirm' in item))('cancelar impide $channel', async item => {
    vi.mocked(dialog.showMessageBox).mockResolvedValue({ response: 0, checkboxChecked: false });
    await settled(item.channel, item.args);
    expect(service[item.method]).not.toHaveBeenCalled();
  });
  it('rechaza campos extra antes de tocar el servicio', async () => {
    await settled('update-host-config', [{ enabled: true, token: 'valor-inyectado' }]);
    expect(Object.values(service).every(method => method.mock.calls.length === 0)).toBe(true);
  });
  it.each([
    ['update-host-config', [{ port: 0 }]], ['update-host-config', [{ port: 1.5 }]],
    ['update-host-config', [{ port: 65536 }]], ['update-host-config', [{ rotate_token: 'sí' }]],
    ['update-host-config', [{ bind_address: '../interfaz-inválida' }]],
    ['register-node', [{ name: 'Nodo', base_url: 'file:///privado', token: 'ficticio' }]],
    ['register-node', [{ name: 'Nodo', base_url: 'https://usuario:clave@node.invalid', token: 'ficticio' }]],
    ['register-node', [{ name: 'Nodo', base_url: 'https://node.invalid?token=privado', token: 'ficticio' }]],
    ['run-background-command', ['node-1', { command: 'x'.repeat(20001) }]],
    ['execute-task', ['node-1', { task: 'Prueba', max_steps: 1001 }]],
    ['execute-task', ['node-1', { task: 'Prueba', backend: 'inventado' }]],
    ['open-application', ['node-1', { path: 'x', token: 'inyectado' }]],
    ['take-screenshot', ['node-1', { display_id: 5 }]], ['remove-node', [42]],
    ['list-nodes', ['extra']], ['get-host-status', [{ extra: true }]],
    ['test-node', ['x'.repeat(49)]], ['poll-process-session', ['node-1', '']],
  ] as const)('rechaza entrada inválida: %s %#', async (channel, args) => {
    await settled(channel, args);
    expect(Object.values(service).every(method => method.mock.calls.length === 0)).toBe(true);
    expect(dialog.showMessageBox).not.toHaveBeenCalled();
  });
  it('rechaza getters sin ejecutarlos', async () => {
    const getter = vi.fn(() => true);
    await settled('update-host-config', [Object.defineProperty({}, 'enabled', { enumerable: true, get: getter })]);
    expect(getter).not.toHaveBeenCalled(); expect(service.updateHostConfig).not.toHaveBeenCalled();
  });
  it.each(['sesión', 'A/B/A', 'navegación', 'destrucción'] as const)('no ejecuta tras invalidación durante aprobación: %s', async reason => {
    vi.mocked(dialog.showMessageBox).mockImplementationOnce(async () => {
      if (reason === 'sesión') resetAuthStateForTests();
      if (reason === 'A/B/A') { setAuthState({ authenticated: true, userId: 'otro-usuario' }); setAuthState({ authenticated: true, userId: 'usuario-qa' }); }
      if (reason === 'navegación') hub.sender.emit('did-start-navigation', { isMainFrame: true });
      if (reason === 'destrucción') hub.destroy();
      return { response: 1, checkboxChecked: false };
    });
    await settled('open-application', ['node-1', { path: 'calculadora' }]);
    expect(service.openApplicationOnNode).not.toHaveBeenCalled();
  });
  it('vence aprobación y no reutiliza una respuesta tardía', async () => {
    vi.useFakeTimers();
    let release!: (value: { response: number; checkboxChecked: boolean }) => void;
    vi.mocked(dialog.showMessageBox).mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    const pending = invoke('open-application', ['node-1', { path: 'calculadora' }]);
    await vi.advanceTimersByTimeAsync(120001);
    expect(await pending).toMatchObject({ success: false, cancelled: true });
    release({ response: 1, checkboxChecked: false }); await Promise.resolve();
    expect(service.openApplicationOnNode).not.toHaveBeenCalled(); vi.useRealTimers();
  });
  it('no publica credenciales de una lectura que pierde sesión', async () => {
    service.getHostStatus.mockImplementationOnce(async () => { resetAuthStateForTests(); return { token: 'credencial-privada-ficticia' }; });
    await expect(invoke('get-host-status', [])).rejects.toThrow('No se pudo completar');
  });
  it('preserva el texto literal del comando que se revisa y envía', async () => {
    const command = '\n  comando ficticio\n';
    await invoke('run-background-command', ['node-1', { command }]);
    expect(service.runBackgroundCommandOnNode.mock.calls[0][1]).toEqual({ command });
    expect(approvalOptions()).toMatchObject({ detail: expect.stringContaining(JSON.stringify({ command })) });
  });
  it('una URL heredada con credenciales no llega al diálogo ni a ejecución', async () => {
    service.listNodes.mockResolvedValue([{ ...node, baseUrl: 'https://usuario:credencial-privada@node.invalid' }]);
    await settled('open-application', ['node-1', { path: 'calculadora' }]);
    expect(dialog.showMessageBox).not.toHaveBeenCalled(); expect(service.openApplicationOnNode).not.toHaveBeenCalled();
  });
  it('conserva incertidumbre después de admitir ejecución', async () => {
    service.runBackgroundCommandOnNode.mockImplementationOnce(async (_id, _args, context) => {
      context.onDispatch(); resetAuthStateForTests(); throw new Error('dato privado del proveedor');
    });
    const result = await invoke('run-background-command', ['node-1', { command: 'comando ficticio' }]);
    expect(result).toMatchObject({ success: false, uncertain: true, code: 'REMOTE_NODE_UNCERTAIN' });
    expect(JSON.stringify(result)).not.toContain('dato privado');
    expect(service.runBackgroundCommandOnNode).toHaveBeenCalledOnce();
  });
  it('recorre wrapper, preload, allowlist y handler sin cambiar el registro manual', async () => {
    let api: RemoteNodeApi | undefined;
    service.registerNode.mockResolvedValue({ success: true, node });
    const transport = vi.fn((channel: string, ...args: unknown[]) => ipc._getHandler(channel)(hub.event, ...args));
    const safe = createSafeIpc({ invoke: transport, send: vi.fn(), on: vi.fn(), off: vi.fn(), removeAllListeners: vi.fn() });
    exposeRemoteApis({ exposeInMainWorld: (name, value) => { if (name === 'remoteNode') api = value as RemoteNodeApi; } }, safe);
    vi.stubGlobal('window', { remoteNode: api });
    expect(await listRemoteNodes()).toMatchObject({ nodes: [node] });
    expect(await registerRemoteNode({ name: node.name, base_url: node.baseUrl, token: node.token })).toEqual({ success: true, node });
    expect(transport.mock.calls[1][0]).toBe('remote-node:register-node');
    expect(() => safe.safeInvoke('remote-node:request', '/ajeno')).toThrow();
    vi.unstubAllGlobals();
  });
});
