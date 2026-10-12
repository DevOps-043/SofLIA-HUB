import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserWindow, ipcMain } from 'electron';
import { registerMediaInputHandlers } from '../media-input-handlers';
import type { MediaInputService } from '../media-input/service';
import { resetAuthStateForTests, setAuthState } from '../main/auth-state';

const ipc = ipcMain as unknown as { _clearHandlers(): void; _getHandler(channel: string): (event: unknown, input: unknown) => Promise<unknown> };

describe('aislamiento de subidas de medios', () => {
  beforeEach(() => { ipc._clearHandlers(); resetAuthStateForTests(); });

  function fixture() {
    const window = new BrowserWindow();
    Object.defineProperty(window.webContents, 'mainFrame', { value: {}, configurable: true });
    const service = {
      upload: vi.fn(async (_input: unknown, guard: () => void) => { guard(); return { uploadId: 'propia', state: 'ready' }; }),
      status: vi.fn(() => ({ uploadId: 'propia', state: 'ready' })), cancel: vi.fn(() => true), release: vi.fn(async () => true), invalidateSession: vi.fn(),
    };
    registerMediaInputHandlers(service as unknown as MediaInputService, () => window);
    setAuthState({ authenticated: true, userId: 'cuenta-a' });
    return { service, event: { sender: window.webContents, senderFrame: window.webContents.mainFrame } };
  }

  const input = { path: 'C:/fixture/video.mp4', mimeType: 'video/mp4', apiKey: 'clave-ficticia-para-pruebas' };

  it('permite consultar solo subidas de la sesión actual y rechaza subframes', async () => {
    const { event, service } = fixture();
    expect(await ipc._getHandler('media-input:upload')({ ...event, senderFrame: {} }, input)).toMatchObject({ success: false });
    expect(service.upload).not.toHaveBeenCalled();
    expect(await ipc._getHandler('media-input:upload')(event, input)).toMatchObject({ success: true });
    expect(await ipc._getHandler('media-input:status')(event, { uploadId: 'propia' })).toMatchObject({ success: true });
    setAuthState({ authenticated: true, userId: 'cuenta-b' });
    for (const action of ['status', 'cancel', 'release']) {
      expect(await ipc._getHandler('media-input:' + action)(event, { uploadId: 'propia', apiKey: input.apiKey })).toMatchObject({ success: false });
    }
    expect(service.cancel).not.toHaveBeenCalled();
    expect(service.release).not.toHaveBeenCalled();
  });

  it('no devuelve una subida que termine después de salir y volver a la misma cuenta', async () => {
    const { event, service } = fixture();
    service.upload.mockImplementationOnce(async (_input, guard) => {
      setAuthState({ authenticated: false, userId: null });
      setAuthState({ authenticated: true, userId: 'cuenta-a' });
      guard();
      return { uploadId: 'obsoleta', state: 'ready' };
    });
    expect(await ipc._getHandler('media-input:upload')(event, input)).toMatchObject({ success: false });
    expect(await ipc._getHandler('media-input:status')(event, { uploadId: 'obsoleta' })).toMatchObject({ success: false });
  });
});
