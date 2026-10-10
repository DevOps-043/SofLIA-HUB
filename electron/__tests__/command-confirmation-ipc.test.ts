import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IpcMainInvokeEvent } from 'electron';
import { CHANNEL_GROUP_1 } from '../preload/channel-group-1';
import { exposeComputerApis } from '../preload/computer-apis';

const mocks = vi.hoisted(() => ({
  handlers: new Map<string, (...args: unknown[]) => Promise<unknown>>(),
  fromWebContents: vi.fn(), dialog: vi.fn(), deny: vi.fn(), execute: vi.fn(),
}));
vi.mock('electron', () => ({
  ipcMain: { handle: (channel: string, handler: (...args: unknown[]) => Promise<unknown>) => mocks.handlers.set(channel, handler) },
  BrowserWindow: { fromWebContents: mocks.fromWebContents },
  dialog: { showMessageBox: mocks.dialog },
}));
vi.mock('../main/require-auth', () => ({ denyIfUnauthenticated: mocks.deny }));
vi.mock('../computer-use/tool-dispatch', () => ({ executeToolDirect: mocks.execute }));
import { registerComputerUseHandlers } from '../computer-use/ipc-registration';

describe('confirmación nativa e IPC', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.handlers.clear();
    mocks.deny.mockReturnValue(null);
    mocks.fromWebContents.mockReturnValue({ isDestroyed: () => false });
    mocks.dialog.mockResolvedValue({ response: 1, checkboxChecked: true });
    registerComputerUseHandlers();
  });
  const invoke = (message: unknown, options?: unknown) => mocks.handlers.get('computer:confirm-action')!({ sender: {} } as IpcMainInvokeEvent, message, options);
  it('devuelve Siempre permitir sólo con aceptar y checkbox autorizado', async () => {
    await expect(invoke('Ejecutar comando: npm run build', { allowAlways: true, command: 'npm run build' })).resolves.toEqual({ confirmed: true, always: true });
    mocks.dialog.mockResolvedValueOnce({ response: 0, checkboxChecked: true });
    await expect(invoke('Ejecutar comando: npm run build', { allowAlways: true, command: 'npm run build' })).resolves.toEqual({ confirmed: false, always: false });
  });
  it('variables del sistema no son recordables aunque el payload solicite siempre', async () => {
    await expect(invoke('Ejecutar comando: setx PATH x', { allowAlways: true, command: 'setx PATH x' })).resolves.toEqual({ confirmed: true, always: false });
    expect(mocks.dialog.mock.calls[0][1]).not.toHaveProperty('checkboxLabel');
  });
  it('el comando de segundo plano conserva recordar al incluir la carpeta en el detalle', async () => {
    await expect(invoke('Ejecutar en segundo plano: npm run build\nEn: C:\\proyecto', { allowAlways: true, command: 'npm run build' })).resolves.toEqual({ confirmed: true, always: true });
    await expect(invoke('Ejecutar comando: setx PATH x', { allowAlways: true, command: 'npm run build' })).resolves.toEqual({ confirmed: true, always: false });
  });
  it.each([null, '', 'x'.repeat(8001), 42])('rechaza mensajes inválidos sin abrir diálogo', async message => {
    await expect(invoke(message)).resolves.toEqual({ confirmed: false });
    expect(mocks.dialog).not.toHaveBeenCalled();
  });
  it('deniega payload inválido, falta de sesión y ventana ausente', async () => {
    await expect(invoke('comando', { allowAlways: 'sí' })).resolves.toEqual({ confirmed: false });
    mocks.deny.mockReturnValue({ error: 'auth_required' });
    await expect(invoke('comando')).resolves.toEqual({ confirmed: false });
    mocks.deny.mockReturnValue(null);
    mocks.fromWebContents.mockReturnValue(null);
    await expect(invoke('comando')).resolves.toEqual({ confirmed: false });
    expect(mocks.dialog).not.toHaveBeenCalled();
  });
  it('preload transmite el contrato del canal permitido sin abrir otro canal', () => {
    expect(CHANNEL_GROUP_1).toContain('computer:confirm-action');
    const expose = vi.fn(), safeInvoke = vi.fn();
    exposeComputerApis({ exposeInMainWorld: expose }, { safeInvoke } as never);
    expose.mock.calls[0][1].confirmAction('comando', { allowAlways: true });
    expect(safeInvoke).toHaveBeenCalledWith('computer:confirm-action', 'comando', { allowAlways: true });
  });
});
