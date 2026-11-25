import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import { CHANNEL_GROUP_1 } from '../preload/channel-group-1';
import { exposeComputerApis } from '../preload/computer-apis';
import { authSourceFixture } from './helpers/auth-source.fixture';
import { mountComputerApprovalFixture } from './helpers/computer-approval.fixture';
import { resetAuthStateForTests, setAuthState } from '../main/auth-state';
import { registerComputerUseHandlers } from '../computer-use/ipc-registration';
vi.mock('../computer-use/tool-dispatch', () => ({ executeToolDirect: vi.fn() }));
const ipc = ipcMain as unknown as { _clearHandlers(): void; _getHandler(channel: string): (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown> };
let review: ReturnType<typeof mountComputerApprovalFixture>['review'];
let hub: ReturnType<typeof authSourceFixture>;
const invoke = (message: unknown, options?: unknown) => ipc._getHandler('computer:confirm-action')(hub.event, message, options);
describe('confirmación en SofLIA e IPC', () => {
  beforeEach(() => {
    vi.clearAllMocks(); ipc._clearHandlers(); resetAuthStateForTests();
    setAuthState({ authenticated: true, userId: 'usuario-qa' }); hub = authSourceFixture();
    review = mountComputerApprovalFixture(hub.window, true).review;
    registerComputerUseHandlers(() => hub.window);
  });
  afterEach(() => { resetAuthStateForTests(); vi.restoreAllMocks(); });
  it('aceptar información no concede permiso persistente de ejecución', async () => {
    await expect(invoke('Ejecutar comando: npm run build', { allowAlways: true, command: 'npm run build' })).resolves.toEqual({ confirmed: true, always: false });
    review.mockResolvedValueOnce(false);
    await expect(invoke('Ejecutar comando: npm run build')).resolves.toEqual({ confirmed: false, always: false });
  });
  it('variables del sistema no ofrecen recordar aunque el payload lo solicite', async () => {
    await expect(invoke('Ejecutar comando: setx PATH x', { allowAlways: true, command: 'setx PATH x' })).resolves.toEqual({ confirmed: true, always: false });
    expect(review.mock.calls[0][0]).not.toContain('Siempre permitir');
  });
  it('segundo plano no transforma información en autorización durable', async () => {
    await expect(invoke('Ejecutar en segundo plano: npm run build', { allowAlways: true, command: 'npm run build' })).resolves.toEqual({ confirmed: true, always: false });
    await expect(invoke('Ejecutar comando: setx PATH x', { allowAlways: true, command: 'npm run build' })).resolves.toEqual({ confirmed: true, always: false });
  });
  it.each([null, '', 'x'.repeat(8001), 42])('rechaza mensajes inválidos sin abrir diálogo', async message => {
    await expect(invoke(message)).resolves.toEqual({ confirmed: false }); expect(review).not.toHaveBeenCalled();
  });
  it('deniega payload inválido, falta de sesión y ventana ausente', async () => {
    await expect(invoke('comando', { allowAlways: 'sí' })).resolves.toEqual({ confirmed: false });
    resetAuthStateForTests(); await expect(invoke('comando')).resolves.toEqual({ confirmed: false });
    setAuthState({ authenticated: true, userId: 'usuario-qa' }); ipc._clearHandlers(); registerComputerUseHandlers();
    await expect(invoke('comando')).resolves.toEqual({ confirmed: false }); expect(review).not.toHaveBeenCalled();
  });
  it('preload transmite sólo el canal permitido y declara revisión en main', () => {
    expect(CHANNEL_GROUP_1).toContain('computer:confirm-action'); const expose = vi.fn(), safeInvoke = vi.fn();
    exposeComputerApis({ exposeInMainWorld: expose }, { safeInvoke } as never);
    expect(expose.mock.calls[0][1].nativeActionReview).toBe(true);
    expose.mock.calls[0][1].confirmAction('comando', { allowAlways: true });
    expect(safeInvoke).toHaveBeenCalledWith('computer:confirm-action', 'comando', { allowAlways: true });
  });
});
