import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dialog, ipcMain, type IpcMainInvokeEvent, type BrowserWindow, type MessageBoxOptions, type MessageBoxReturnValue } from 'electron';
import { registerDesktopAgentHandlers } from '../desktop-agent-handlers';
import type { DesktopAgentService } from '../desktop-agent-service';
import { createMockDesktopAgentService } from './desktop-agent-handlers.fixture';
import { authSourceFixture } from './helpers/auth-source.fixture';
import { resetAuthStateForTests, setAuthState } from '../main/auth-state';
import { desktopInputs, desktopInputSnapshot } from '../../src/shared/desktop-input';
import { exposeDesktopApi } from '../preload/desktop-apis';
import { createSafeIpc } from '../preload/safe-ipc';
import type { DesktopAgentApi } from '../../src/shared/desktop-agent';
import { executeDesktopTool } from '../../src/services/computer-use/desktop-tools';
const nativeDialog = vi.mocked(dialog.showMessageBox as (parent: BrowserWindow, options: MessageBoxOptions) => Promise<MessageBoxReturnValue>);
const ipc = ipcMain as unknown as { _clearHandlers(): void; _getHandler(name: string): (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown> };
let hub: ReturnType<typeof authSourceFixture>, service: ReturnType<typeof createMockDesktopAgentService>;
const invoke = (name: string, args: unknown[] = [], event?: IpcMainInvokeEvent) => ipc._getHandler(`desktop-agent:${name}`)(event ?? hub.event, ...args);
beforeEach(() => {
  vi.clearAllMocks(); ipc._clearHandlers(); resetAuthStateForTests(); setAuthState({ authenticated: true, userId: 'usuario-qa' });
  hub = authSourceFixture(); service = createMockDesktopAgentService();
  vi.mocked(dialog.showMessageBox).mockResolvedValue({ response: 0, checkboxChecked: false });
  registerDesktopAgentHandlers(service as unknown as DesktopAgentService, () => hub.window, () => null);
});
afterEach(() => { resetAuthStateForTests(); vi.restoreAllMocks(); vi.useRealTimers(); });
describe('Autoridad nativa Desktop Agent', () => {
  it.each(Object.keys(desktopInputs))('todos los canales deniegan ventana ajena: %s', async name => {
    await invoke(name, [], authSourceFixture().event).catch(() => undefined);
    expect(nativeDialog).not.toHaveBeenCalled();
    for (const value of Object.values(service)) if (vi.isMockFunction(value)) expect(value).not.toHaveBeenCalled();
  });
  it.each(['subframe', 'documento', 'sin ventanas'] as const)('lectura rechazada en origen inválido: %s', async reason => {
    if (reason === 'subframe') hub.event = { ...hub.event, senderFrame: { ...hub.frame } } as unknown as IpcMainInvokeEvent;
    if (reason === 'documento') hub.frame.url = 'https://ajeno.invalid';
    if (reason === 'sin ventanas') { ipc._clearHandlers(); registerDesktopAgentHandlers(service as unknown as DesktopAgentService); }
    await expect(invoke('get-config')).rejects.toThrow('IPC_DENIED'); expect(service.getConfig).not.toHaveBeenCalled();
  });
  it('ventana ajena no lee configuración', async () => {
    await invoke('get-config', [], authSourceFixture().event).catch(() => undefined);
    expect(service.getConfig).not.toHaveBeenCalled();
  });
  it('coordenada inválida no llega al mouse', async () => {
    await invoke('click', ['dato-inválido', 20]); expect(service.mouseClick).not.toHaveBeenCalled();
  });
  it('cancelar revisión nativa no mueve el mouse', async () => {
    await invoke('click', [10, 20]); expect(dialog.showMessageBox).toHaveBeenCalledOnce(); expect(service.mouseClick).not.toHaveBeenCalled();
  });
  it('sin sesión no lee estado', async () => {
    resetAuthStateForTests(); await invoke('get-status').catch(() => undefined); expect(service.getStatus).not.toHaveBeenCalled();
  });
  it('A/B/A durante tarea no publica resultado obsoleto', async () => {
    vi.mocked(dialog.showMessageBox).mockResolvedValueOnce({ response: 1, checkboxChecked: false });
    service.executeTaskDetailed.mockImplementationOnce(async () => {
      setAuthState({ authenticated: true, userId: 'otra' }); setAuthState({ authenticated: true, userId: 'usuario-qa' });
      return { taskId: 'ficticio', estado: 'completada', mensaje: 'dato-obsoleto', pasosEjecutados: 1, duracionMs: 1 };
    });
    expect(JSON.stringify(await invoke('execute-task', ['Tarea ficticia']))).not.toContain('dato-obsoleto');
  });
  it.each([
    ['click', [NaN, 20]], ['click', [1, 2, 3]], ['drag', [1, 2, Infinity, 4]],
    ['scroll', ['sideways', 2]], ['scroll', ['down', 100000]], ['key', ["'); comando; '"]],
    ['execute-task', ['', {}]], ['execute-task', ['tarea', { signal: true }]],
    ['execute-task', ['tarea', { startUrl: 'file:///privado' }]], ['execute-task', ['tarea', { startUrl: 'https://usuario:clave@example.invalid' }]],
    ['execute-parallel', [Array.from({ length: 5 }, () => ({ task: 'tarea' }))]],
    ['set-config', [{ maxConcurrentAgents: 2 }]], ['set-config', [{ maxSteps: '20' }]], ['set-config', [{ computerUsePromptInjectionDetection: 'false' }]],
    ['set-config', [{ secreto: 'dato' }]], ['reset-browser-profile', ['../perfil']], ['take-screenshot', ['true']],
    ['abort-task', ['']], ['start-observation', ['objetivo', 'x'.repeat(20001)]],
  ] as [string, unknown[]][])('payload inválido se rechaza antes de diálogo/servicio %s %#', async (name, args) => {
    expect(await invoke(name, args)).toMatchObject({ error: 'INVALID_PAYLOAD' });
    expect(nativeDialog).not.toHaveBeenCalled();
    for (const value of Object.values(service)) if (vi.isMockFunction(value)) expect(value).not.toHaveBeenCalled();
  });
  it('snapshot rechaza getters, ciclos y cuota real sin evaluarlos', () => {
    const getter = vi.fn(() => 20); const input = Object.defineProperty({}, 'maxSteps', { enumerable: true, get: getter });
    expect(() => desktopInputSnapshot([input])).toThrow(); expect(getter).not.toHaveBeenCalled();
    const cycle: Record<string, unknown> = {}; cycle.self = cycle; expect(() => desktopInputSnapshot([cycle])).toThrow();
    expect(() => desktopInputSnapshot(['😀'.repeat(33000)])).toThrow();
  });
  it.each(['navegación', 'A/B/A', 'destrucción'] as const)('revoca aprobación nativa durante %s', async reason => {
    nativeDialog.mockImplementationOnce(async () => {
      if (reason === 'navegación') hub.sender.emit('did-start-navigation', { isMainFrame: true });
      if (reason === 'destrucción') hub.destroy();
      if (reason === 'A/B/A') { setAuthState({ authenticated: true, userId: 'otra' }); setAuthState({ authenticated: true, userId: 'usuario-qa' }); }
      return { response: 1, checkboxChecked: false };
    });
    expect(await invoke('click', [10, 20])).toMatchObject({ success: false }); expect(service.mouseClick).not.toHaveBeenCalled();
  });
  it('snapshot aprobado no cambia al mutar opciones originales', async () => {
    const config = { maxSteps: 20 };
    nativeDialog.mockImplementationOnce(async (_window, options) => { expect(options.detail).toContain('20'); config.maxSteps = 30; return { response: 1, checkboxChecked: false }; });
    await invoke('set-config', [config]); expect(service.setConfig).toHaveBeenCalledWith({ maxSteps: 20 });
  });
  it('abort/consultas siguen disponibles durante tarea; otro efecto devuelve busy', async () => {
    nativeDialog.mockResolvedValueOnce({ response: 1, checkboxChecked: false });
    let finish!: (value: Awaited<ReturnType<DesktopAgentService['executeTaskDetailed']>>) => void;
    service.executeTaskDetailed.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const pending = invoke('execute-task', ['tarea']); await vi.waitFor(() => expect(service.executeTaskDetailed).toHaveBeenCalledOnce());
    expect(await invoke('click', [10, 20])).toMatchObject({ error: 'BUSY' });
    expect(await invoke('get-config')).toMatchObject({ maxSteps: expect.any(Number) });
    expect(await invoke('abort')).toMatchObject({ success: true }); expect(service.abortAll).toHaveBeenCalledOnce();
    finish({ taskId: 'qa', estado: 'cancelada', mensaje: 'Cancelada', pasosEjecutados: 0, duracionMs: 1 }); await pending;
  });
  it('revocación aborta señal del trabajo sin liberar plaza física prematuramente', async () => {
    nativeDialog.mockResolvedValueOnce({ response: 1, checkboxChecked: false });
    let finish!: (value: Awaited<ReturnType<DesktopAgentService['executeTaskDetailed']>>) => void;
    service.executeTaskDetailed.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const pending = invoke('execute-task', ['tarea']); await vi.waitFor(() => expect(service.executeTaskDetailed).toHaveBeenCalledOnce());
    const options = service.executeTaskDetailed.mock.calls[0][1] as { signal?: AbortSignal };
    setAuthState({ authenticated: true, userId: 'otra' }); expect(options.signal?.aborted).toBe(true);
    expect(await invoke('click', [10, 20])).toMatchObject({ error: 'BUSY' });
    finish({ taskId: 'qa', estado: 'completada', mensaje: 'obsoleto', pasosEjecutados: 1, duracionMs: 1 });
    expect(await pending).toMatchObject({ error: 'IPC_DENIED' }); expect(hub.sender.listenerCount('did-start-navigation')).toBe(0);
  });
  it('observación retiene contexto hasta stop y revoca al navegar', async () => {
    nativeDialog.mockResolvedValueOnce({ response: 1, checkboxChecked: false });
    expect(await invoke('start-observation', ['Observar'])).toMatchObject({ success: true });
    expect(hub.sender.listenerCount('did-start-navigation')).toBe(1);
    hub.sender.emit('did-start-navigation', { isMainFrame: true });
    expect(service.stopObservation).toHaveBeenCalledOnce();
    for (let index = 0; index < 8; index++) await Promise.resolve();
    expect(hub.sender.listenerCount('did-start-navigation')).toBe(0);
  });
  it('cuatro capas conservan tarea y la aprobación se realiza en main', async () => {
    let api: DesktopAgentApi | undefined;
    const safe = createSafeIpc({ invoke: (channel, ...args) => ipc._getHandler(channel)(hub.event, ...args), send: vi.fn(), on: vi.fn(), off: vi.fn(), removeAllListeners: vi.fn() });
    exposeDesktopApi({ exposeInMainWorld: (_name, value) => { api = value as DesktopAgentApi; } }, safe);
    expect(api?.nativeActionReview).toBe(true); nativeDialog.mockResolvedValueOnce({ response: 1, checkboxChecked: false });
    expect(await executeDesktopTool('use_computer', { task: 'Tarea ficticia', max_steps: 3 }, api!)).toMatchObject({ success: true });
    expect(service.executeTaskDetailed).toHaveBeenCalledWith('Tarea ficticia', expect.objectContaining({ maxSteps: 3, signal: expect.any(AbortSignal) }));
    expect(() => safe.safeInvoke('desktop-agent:shell')).toThrow();
  });
  it('excepción del servicio no refleja información privada', async () => {
    service.listWindows.mockRejectedValueOnce(new Error('secreto-ficticio'));
    const result = await invoke('list-windows'); expect(result).toMatchObject({ error: 'DESKTOP_FAILED' }); expect(JSON.stringify(result)).not.toContain('secreto-ficticio');
  });
  it('paralelo propaga señal a cada tarea y sanea excepciones individuales', async () => {
    nativeDialog.mockResolvedValueOnce({ response: 1, checkboxChecked: false });
    service.executeTask.mockRejectedValueOnce(new Error('secreto-ficticio')).mockResolvedValueOnce('resultado-válido');
    const result = await invoke('execute-parallel', [[{ task: 'Primera' }, { task: 'Segunda' }]]);
    expect(JSON.stringify(result)).not.toContain('secreto-ficticio'); expect(JSON.stringify(result)).toContain('resultado-válido');
    expect(service.executeTask).toHaveBeenCalledTimes(2);
    for (const [, options] of service.executeTask.mock.calls) expect(options?.signal).toBeInstanceOf(AbortSignal);
  });
  it('stop de observación no necesita diálogo adicional', async () => {
    nativeDialog.mockResolvedValueOnce({ response: 1, checkboxChecked: false }); await invoke('start-observation', ['Objetivo']);
    expect(await invoke('stop-observation')).toMatchObject({ success: true }); expect(nativeDialog).toHaveBeenCalledOnce();
    for (let index = 0; index < 8; index++) await Promise.resolve(); expect(hub.sender.listenerCount('did-start-navigation')).toBe(0);
  });
  it('timeout de aprobación no ejecuta respuesta tardía', async () => {
    vi.useFakeTimers(); let close!: (value: MessageBoxReturnValue) => void;
    nativeDialog.mockImplementationOnce(() => new Promise(resolve => { close = resolve; }));
    const pending = invoke('click', [1, 2]); await vi.advanceTimersByTimeAsync(120001);
    expect(await pending).toMatchObject({ success: false }); expect(service.mouseClick).not.toHaveBeenCalled();
    close({ response: 1, checkboxChecked: false }); for (let index = 0; index < 8; index++) await Promise.resolve();
    expect(service.mouseClick).not.toHaveBeenCalled();
  });
});
