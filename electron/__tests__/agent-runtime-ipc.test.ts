import { describe, it, expect, vi } from 'vitest';
import type { BrowserWindow, IpcMainInvokeEvent } from 'electron';
import { assertRuntimeSender, startSchema } from '../agent-runtime/handlers';
import { exposeAgentRuntimeApi } from '../preload/agent-runtime-api';
import { createSafeIpc } from '../preload/safe-ipc';
describe('Frontera IPC del arnés', () => {
  it('solo permite la ventana y frame principal conocidos', () => {
    const frame = {};
    const webContents = { mainFrame: frame };
    const window = { isDestroyed: () => false, webContents } as unknown as BrowserWindow;
    expect(() => assertRuntimeSender({ sender: webContents, senderFrame: frame } as IpcMainInvokeEvent, window)).not.toThrow();
    expect(() => assertRuntimeSender({ sender: webContents, senderFrame: {} } as IpcMainInvokeEvent, window)).toThrow();
    expect(() => assertRuntimeSender({ sender: {}, senderFrame: frame } as IpcMainInvokeEvent, window)).toThrow();
    expect(() => assertRuntimeSender({} as IpcMainInvokeEvent, null)).toThrow();
  });
  it('rechaza payload con identidad elegida, proveedor desconocido y exceso de datos', () => {
    const input = { title: 'Reunión', source: 'Transcripción completa', provider: 'gemini' };
    expect(startSchema.safeParse(input).success).toBe(true);
    expect(startSchema.safeParse({ ...input, userId: 'otro' }).success).toBe(false);
    expect(startSchema.safeParse({ ...input, provider: 'shell' }).success).toBe(false);
    expect(startSchema.safeParse({ ...input, source: 'x'.repeat(80_001) }).success).toBe(false);
  });
  it('expone canales concretos y rechaza RPC genérico', async () => {
    const invoke = vi.fn(async () => ({ success: true }));
    const safe = createSafeIpc({ invoke, send: vi.fn(), on: vi.fn(), off: vi.fn(), removeAllListeners: vi.fn() });
    const expose = vi.fn();
    exposeAgentRuntimeApi({ exposeInMainWorld: expose }, safe);
    const api = expose.mock.calls[0][1];
    await api.start({ title: 'Reunión', source: 'Transcripción completa', provider: 'gemini' });
    expect(invoke).toHaveBeenCalledWith('agent-runtime:start', expect.objectContaining({ provider: 'gemini' }));
    expect(api.request).toBeUndefined();
    expect(() => safe.safeInvoke('agent-runtime:exec', {})).toThrow();
  });
});
