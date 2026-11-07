import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dialog, ipcMain, type IpcMainInvokeEvent, type BrowserWindow, type MessageBoxOptions, type MessageBoxReturnValue } from 'electron';
import { registerComputerUseHandlers } from '../computer-use/ipc-registration';
import { executeToolDirect } from '../computer-use/tool-dispatch';
import { authSourceFixture } from './helpers/auth-source.fixture';
import { resetAuthStateForTests, setAuthState } from '../main/auth-state';
import { COMPUTER_IPC_TOOLS } from '../computer-use/ipc-tools';
import { computerInputSnapshot, COMPUTER_IPC_MAX_BYTES } from '../../src/shared/computer-use-input';
import { exposeComputerApis } from '../preload/computer-apis';
import { createSafeIpc } from '../preload/safe-ipc';
import type { ComputerUseApi } from '../../src/shared/computer-use';
import { executeLocalComputerTool } from '../../src/services/computer-use/local-tools';

vi.mock('../computer-use/tool-dispatch', () => ({ executeToolDirect: vi.fn(async () => ({ success: true, content: 'dato-ficticio' })) }));
const ipc = ipcMain as unknown as { _clearHandlers(): void; _getHandler(channel: string): (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown> };
const nativeDialog = vi.mocked(dialog.showMessageBox as (parent: BrowserWindow, options: MessageBoxOptions) => Promise<MessageBoxReturnValue>);
let hub: ReturnType<typeof authSourceFixture>;
const invoke = (name: string, args: unknown[] = [], event?: IpcMainInvokeEvent) => ipc._getHandler(`computer:${name}`)(event ?? hub.event, ...args);
beforeEach(() => {
  vi.clearAllMocks(); resetAuthStateForTests(); setAuthState({ authenticated: true, userId: 'usuario-qa' });
  ipc._clearHandlers(); hub = authSourceFixture();
  vi.mocked(executeToolDirect).mockResolvedValue({ success: true, content: 'dato-ficticio' });
  nativeDialog.mockResolvedValue({ response: 0, checkboxChecked: false });
  registerComputerUseHandlers(() => hub.window, () => null);
});
afterEach(() => { resetAuthStateForTests(); vi.restoreAllMocks(); vi.useRealTimers(); });

describe('Autoridad IPC de Computer Use', () => {
  it.each(['sesión', 'subframe', 'documento', 'sin ventanas'] as const)('deniega origen inválido: %s', async reason => {
    if (reason === 'sesión') resetAuthStateForTests();
    if (reason === 'subframe') hub.event = { ...hub.event, senderFrame: { ...hub.frame } } as unknown as IpcMainInvokeEvent;
    if (reason === 'documento') hub.frame.url = 'https://ajeno.invalid';
    if (reason === 'sin ventanas') { ipc._clearHandlers(); registerComputerUseHandlers(); }
    expect(await invoke('read-file', ['ruta-ficticia'])).toMatchObject({ error: 'IPC_DENIED' });
    expect(executeToolDirect).not.toHaveBeenCalled(); expect(dialog.showMessageBox).not.toHaveBeenCalled();
  });
  it('ventana ajena no recibe archivos', async () => {
    await invoke('read-file', ['ruta-ficticia'], authSourceFixture().event);
    expect(executeToolDirect).not.toHaveBeenCalled();
  });
  it('argumentos extras no llegan al servicio', async () => {
    await invoke('read-file', ['ruta-ficticia', 'inyectado']);
    expect(executeToolDirect).not.toHaveBeenCalled();
  });
  it('escribir exige aprobación nativa y cancelar no escribe', async () => {
    await invoke('write-file', ['ruta-ficticia', 'contenido']);
    expect(dialog.showMessageBox).toHaveBeenCalledOnce(); expect(executeToolDirect).not.toHaveBeenCalled();
  });
  it('cambio de sesión durante lectura no publica dato tardío', async () => {
    vi.mocked(executeToolDirect).mockImplementationOnce(async () => {
      setAuthState({ authenticated: true, userId: 'otra-persona' });
      return { success: true, content: 'dato-ficticio' };
    });
    expect(JSON.stringify(await invoke('read-file', ['ruta-ficticia']))).not.toContain('dato-ficticio');
  });
  it('servicio pendiente conserva plaza del emisor', async () => {
    let finish!: (value: { success: boolean }) => void;
    vi.mocked(executeToolDirect).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const pending = invoke('read-file', ['ruta-ficticia']);
    await vi.waitFor(() => expect(executeToolDirect).toHaveBeenCalledOnce());
    const second = invoke('read-file', ['otra-ruta']);
    await Promise.resolve(); finish({ success: true }); await pending; await second;
    expect(executeToolDirect).toHaveBeenCalledOnce();
  });
  it.each([
    ['kill-process', [-1]], ['read-file', [42]], ['write-file', ['ruta', {}]],
    ['run-background-command', [{ command: 'dir', injected: true }]],
    ['take-screenshot', [[], 'extra']], ['list-screens', ['extra']],
    ['use-computer', [{ action: 'left_click', coordinate: [Infinity, 2] }]],
    ['use-computer', [{ action: 'desconocida' }]], ['use-computer', [{ action: 'type' }]],
    ['send-email', ['correo@example.invalid\r\nBcc:otro', 'asunto', 'cuerpo']],
    ['open-url', ['javascript:alert(1)']], ['open-url', ['https://user:password@example.invalid']],
    ['create-word-document', [{ content: 'texto', design: { fontFamily: 'Fuente ajena' } }]],
    ['batch-move-files', [{ source_directory: 'origen' }]],
  ] as [string, unknown[]][])('rechaza contrato inválido %s %#', async (name, args) => {
    expect(await invoke(name, args)).toMatchObject({ error: 'INVALID_PAYLOAD' });
    expect(executeToolDirect).not.toHaveBeenCalled(); expect(dialog.showMessageBox).not.toHaveBeenCalled();
  });
  it('getters/prototipos/ciclos y cuota UTF-8 no llegan al parser', () => {
    const getter = vi.fn(() => 'dir');
    const item = Object.defineProperty({}, 'command', { enumerable: true, get: getter });
    expect(() => computerInputSnapshot([item])).toThrow(); expect(getter).not.toHaveBeenCalled();
    expect(() => computerInputSnapshot([new Date()])).toThrow();
    const cycle: Record<string, unknown> = {}; cycle.self = cycle;
    expect(() => computerInputSnapshot([cycle])).toThrow();
    expect(() => computerInputSnapshot(['😀'.repeat(COMPUTER_IPC_MAX_BYTES / 4 + 1)])).toThrow();
  });
  it.each(['navegación', 'A/B/A', 'destrucción'] as const)('revoca durante aprobación: %s', async reason => {
    nativeDialog.mockImplementationOnce(async () => {
      if (reason === 'navegación') hub.sender.emit('did-start-navigation', { isMainFrame: true });
      if (reason === 'A/B/A') { setAuthState({ authenticated: true, userId: 'otra' }); setAuthState({ authenticated: true, userId: 'usuario-qa' }); }
      if (reason === 'destrucción') hub.destroy();
      return { response: 1, checkboxChecked: false };
    });
    expect(await invoke('delete-item', ['ruta-ficticia'])).toMatchObject({ success: false });
    expect(executeToolDirect).not.toHaveBeenCalled();
  });
  it('copiar argumentos antes del diálogo impide cambiar el comando aprobado', async () => {
    const args = { command: 'comando-ficticio', working_directory: 'ruta-ficticia' };
    nativeDialog.mockImplementationOnce(async (_win, options) => {
      expect(options.detail).toContain('comando-ficticio'); args.command = 'otro-comando';
      return { response: 1, checkboxChecked: false };
    });
    await invoke('run-background-command', [args]);
    expect(executeToolDirect).toHaveBeenCalledWith('run_background_command', expect.objectContaining({ command: 'comando-ficticio' }), expect.any(Function));
  });
  it('contraseña SMTP no aparece en detalle ni excepciones', async () => {
    nativeDialog.mockResolvedValueOnce({ response: 1, checkboxChecked: false });
    vi.mocked(executeToolDirect).mockRejectedValueOnce(new Error('secreto-ficticio'));
    const result = await invoke('configure-email', ['qa@example.invalid', 'secreto-ficticio']);
    expect(nativeDialog.mock.calls[0][1].detail).not.toContain('secreto-ficticio');
    expect(JSON.stringify(result)).not.toContain('secreto-ficticio');
  });
  it('progreso posterior a revocación se descarta y retira listeners', async () => {
    const send = vi.fn(); Object.assign(hub.sender, { send });
    vi.mocked(executeToolDirect).mockImplementationOnce(async (_name, _args, progress) => {
      progress?.('vigente'); hub.sender.emit('did-start-navigation', { isMainFrame: true }); progress?.('obsoleto');
      return { success: true };
    });
    await invoke('read-file', ['ruta']); expect(send).toHaveBeenCalledOnce();
    expect(hub.sender.listenerCount('did-start-navigation')).toBe(0);
  });
  it('revocar no libera plaza hasta completar el servicio físico', async () => {
    let finish!: (value: { success: boolean }) => void;
    vi.mocked(executeToolDirect).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const pending = invoke('read-file', ['ruta']); await vi.waitFor(() => expect(executeToolDirect).toHaveBeenCalledOnce());
    setAuthState({ authenticated: true, userId: 'otra' });
    expect(await invoke('read-file', ['otra'])).toMatchObject({ error: 'BUSY' });
    finish({ success: true }); expect(await pending).toMatchObject({ error: 'IPC_DENIED' });
    expect(await invoke('read-file', ['nueva'])).toMatchObject({ success: true });
  });
  it('cuatro trabajos globales no admiten un quinto', async () => {
    const sources = Array.from({ length: 5 }, () => authSourceFixture());
    ipc._clearHandlers(); let windows = sources.slice(0, 4).map(source => source.window);
    registerComputerUseHandlers(() => windows[0] ?? null, () => windows[1] ?? null);
    const finishes: (() => void)[] = [];
    vi.mocked(executeToolDirect).mockImplementation(() => new Promise(resolve => { finishes.push(() => resolve({ success: true })); }));
    // Dos ventanas registradas por vez; las anteriores siguen físicamente pendientes.
    const pending = [invoke('read-file', ['ruta'], sources[0].event), invoke('read-file', ['ruta'], sources[1].event)];
    windows = sources.slice(2, 4).map(source => source.window);
    pending.push(invoke('read-file', ['ruta'], sources[2].event), invoke('read-file', ['ruta'], sources[3].event));
    windows = [sources[4].window];
    expect(await invoke('read-file', ['ruta'], sources[4].event)).toMatchObject({ error: 'BUSY' });
    finishes.forEach(finish => finish()); await Promise.all(pending); expect(executeToolDirect).toHaveBeenCalledTimes(4);
  });
  it('catálogo conserva 33 herramientas y confirmación separada', () => {
    expect(COMPUTER_IPC_TOOLS).toHaveLength(33);
    expect(new Set(COMPUTER_IPC_TOOLS.map(tool => tool.channel)).size).toBe(33);
  });
  it('wrapper, preload, allowlist y handler alcanzan servicio sólo tras revisión', async () => {
    let api: ComputerUseApi | undefined;
    const transport = vi.fn((channel: string, ...args: unknown[]) => ipc._getHandler(channel)(hub.event, ...args));
    const safe = createSafeIpc({ invoke: transport, send: vi.fn(), on: vi.fn(), off: vi.fn(), removeAllListeners: vi.fn() });
    exposeComputerApis({ exposeInMainWorld: (_name, value) => { api = value as ComputerUseApi; } }, safe);
    expect(api?.nativeActionReview).toBe(true);
    nativeDialog.mockResolvedValueOnce({ response: 1, checkboxChecked: false });
    expect(await executeLocalComputerTool('write_file', { path: 'ruta', content: 'texto' }, api!)).toMatchObject({ success: true });
    expect(executeToolDirect).toHaveBeenCalledWith('write_file', { path: 'ruta', content: 'texto' }, expect.any(Function));
    expect(() => safe.safeInvoke('computer:execute-arbitrary')).toThrow();
    vi.mocked(executeToolDirect).mockClear();
    expect(await api!.deleteItem('ruta')).toMatchObject({ error: 'CANCELLED' });
    expect(executeToolDirect).not.toHaveBeenCalled();
  });
  it('aprobación informativa anterior no autoriza un comando nuevo', async () => {
    nativeDialog.mockResolvedValueOnce({ response: 1, checkboxChecked: true });
    expect(await invoke('confirm-action', ['Revisión anterior', { allowAlways: true, command: 'dir' }])).toMatchObject({ confirmed: true, always: false });
    expect(await invoke('execute-command', ['dir'])).toMatchObject({ error: 'CANCELLED' });
    expect(dialog.showMessageBox).toHaveBeenCalledTimes(2); expect(executeToolDirect).not.toHaveBeenCalled();
  });
  it('handler heredado GUI entrega lease al servicio sin abrir el canal en preload', async () => {
    nativeDialog.mockResolvedValueOnce({ response: 1, checkboxChecked: false });
    await invoke('use-computer', [{ action: 'type', text: 'texto' }]);
    const call = vi.mocked(executeToolDirect).mock.calls[0];
    expect(call[0]).toBe('use_computer'); expect(call[3]).toMatchObject({ signal: expect.any(AbortSignal), assertCurrent: expect.any(Function) });
    const safe = createSafeIpc({ invoke: vi.fn(), send: vi.fn(), on: vi.fn(), off: vi.fn(), removeAllListeners: vi.fn() });
    expect(() => safe.safeInvoke('computer:use-computer', {})).toThrow();
  });
  it('diálogo vencido no ejecuta ni permite acumular otro diálogo físico', async () => {
    vi.useFakeTimers(); let close!: (result: { response: number; checkboxChecked: boolean }) => void;
    nativeDialog.mockImplementationOnce(() => new Promise(resolve => { close = resolve; }));
    const pending = invoke('delete-item', ['ruta']); await vi.advanceTimersByTimeAsync(120001);
    expect(await pending).toMatchObject({ success: false });
    expect(await invoke('delete-item', ['otra'])).toMatchObject({ success: false });
    expect(dialog.showMessageBox).toHaveBeenCalledOnce(); expect(executeToolDirect).not.toHaveBeenCalled();
    close({ response: 1, checkboxChecked: false }); for (let index = 0; index < 10; index++) await Promise.resolve();
    expect(executeToolDirect).not.toHaveBeenCalled();
  });
});
