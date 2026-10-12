import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserWindow, ipcMain, type IpcMainInvokeEvent } from 'electron';
import { resetAuthStateForTests, setAuthState } from '../main/auth-state';
import { registerGuidanceHandlers } from '../orb-guidance/handlers';
import { OrbGuidanceService } from '../orb-guidance/service';
import { exposeOrbGuidanceApi } from '../preload/orb-guidance-api';
import { ALLOWED_IPC_CHANNELS } from '../preload/channels';
import type { SafeIpc } from '../preload/types';
import type { OrbGuidanceBridge } from '../../src/services/orb-guidance-service';

const harness = ipcMain as unknown as { _clearHandlers(): void; _getHandler(channel: string): (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<{ success: boolean }> };
let dispose: () => void;
beforeEach(() => { harness._clearHandlers(); resetAuthStateForTests(); });
afterEach(() => { dispose?.(); resetAuthStateForTests(); });
function fixture() {
  const main = new BrowserWindow(), orb = new BrowserWindow();
  for (const window of [main, orb]) Object.defineProperty(window.webContents, 'mainFrame', { configurable: true, value: {} });
  const service = new OrbGuidanceService({ surfaces: { render: async () => undefined, clear: vi.fn(), capture: async operation => operation() }, authorized: () => true, locate: async () => null });
  const abortComputer = vi.fn(), computerRunning = vi.fn(() => false);
  dispose = registerGuidanceHandlers({ service, getWindows: () => [main, orb], abortComputer, computerRunning });
  const event = { sender: main.webContents, senderFrame: main.webContents.mainFrame } as IpcMainInvokeEvent;
  return { main, orb, service, abortComputer, computerRunning, event };
}
describe('IPC autorizado de la guía', () => {
  it('rechaza falta de sesión, ventana ajena, subframe y payload extra', async () => {
    const { event } = fixture(), handler = harness._getHandler('orb:guidance-control');
    expect((await handler(event, { action: 'pause' })).success).toBe(false);
    setAuthState({ authenticated: true, userId: 'usuario-1' });
    expect((await handler({ ...event, senderFrame: {} } as IpcMainInvokeEvent, { action: 'pause' })).success).toBe(false);
    expect((await handler({ ...event, sender: { id: 9999 } } as IpcMainInvokeEvent, { action: 'pause' })).success).toBe(false);
    expect((await handler(event, { action: 'pause', extra: true })).success).toBe(false);
    expect((await handler(event, { action: 'pause' }, 'extra')).success).toBe(false);
    expect((await handler(event, { action: 'pause' })).success).toBe(true);
  });
  it('detener cancela Computer Use y una revocación limpia la guía', async () => {
    setAuthState({ authenticated: true, userId: 'usuario-1' });
    const { event, service, abortComputer } = fixture();
    await harness._getHandler('orb:guidance-control')(event, { action: 'stop' });
    expect(abortComputer).toHaveBeenCalledTimes(1);
    service.control({ action: 'pause' }); setAuthState({ authenticated: false, userId: null });
    expect(service.getState().phase).toBe('idle'); expect(abortComputer).toHaveBeenCalledTimes(2);
  });
  it('no inicia práctica durante una tarea activa ni acepta recetas incompletas', async () => {
    setAuthState({ authenticated: true, userId: 'usuario-1' });
    const { event, computerRunning } = fixture(), handler = harness._getHandler('orb:practice-start');
    expect((await handler(event, { title: 'Práctica', steps: [] })).success).toBe(false);
    computerRunning.mockReturnValue(true);
    expect((await handler(event, { title: 'Práctica', steps: [{ instruction: 'Abre', targetText: 'Insertar', expectedText: 'Tabla' }] })).success).toBe(false);
  });
  it('preload sólo expone operaciones específicas y todas usan allowlist', async () => {
    const bridge = { exposeInMainWorld: vi.fn() };
    const unsubscribe = vi.fn();
    const ipc = { safeInvoke: vi.fn(), safeOn: vi.fn(() => unsubscribe) } as unknown as SafeIpc;
    exposeOrbGuidanceApi(bridge, ipc);
    const api = bridge.exposeInMainWorld.mock.calls[0][1] as OrbGuidanceBridge;
    await api.getState(); await api.control({ action: 'stop' }); await api.checkPractice();
    await api.showTarget({ targetText: 'Guardar', instruction: 'Aquí se guarda' });
    expect(api.onState(() => undefined)).toBe(unsubscribe);
    for (const channel of ['orb:guidance-get', 'orb:guidance-control', 'orb:guidance-state', 'orb:practice-start', 'orb:practice-check', 'orb:guidance-show']) expect(ALLOWED_IPC_CHANNELS).toContain(channel);
    expect(Object.keys(api)).not.toContain('moveWindow');
  });
});
