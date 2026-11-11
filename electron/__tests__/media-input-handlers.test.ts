import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ipcMain } from 'electron';
import { authSourceFixture } from './helpers/auth-source.fixture';
import { registerMediaInputHandlers } from '../media-input-handlers';
import type { MediaInputService } from '../media-input/service';
import { resetAuthStateForTests, setAuthState } from '../main/auth-state';

const ipc = ipcMain as unknown as { _clearHandlers(): void; _getHandler(channel: string): (event: unknown, input: unknown) => Promise<unknown> };

describe('aislamiento de subidas de medios', () => {
  beforeEach(() => { ipc._clearHandlers(); resetAuthStateForTests(); });

  function fixture() {
    const { window } = authSourceFixture();
    const service = {
      upload: vi.fn(async (_input: unknown, guard: () => void) => { guard(); return { uploadId: 'propia', state: 'ready' }; }),
      status: vi.fn(() => ({ uploadId: 'propia', state: 'ready' })), cancel: vi.fn(() => true), release: vi.fn(async () => true), invalidateSession: vi.fn(),
    };
    registerMediaInputHandlers(service as unknown as MediaInputService, () => window, caller => ({ ...caller, key: async () => 'clave-nativa-ficticia-main' }));
    setAuthState({ authenticated: true, userId: 'cuenta-a' });
    return { service, window, event: { sender: window.webContents, senderFrame: window.webContents.mainFrame } };
  }

  const input = { path: 'C:/fixture/video.mp4', mimeType: 'video/mp4' };

  it('permite consultar solo subidas de la sesión actual y rechaza subframes', async () => {
    const { event, service } = fixture();
    expect(await ipc._getHandler('media-input:upload')({ ...event, senderFrame: {} }, input)).toMatchObject({ success: false });
    expect(service.upload).not.toHaveBeenCalled();
    expect(await ipc._getHandler('media-input:upload')(event, input)).toMatchObject({ success: true });
    expect(await ipc._getHandler('media-input:status')(event, { uploadId: 'propia' })).toMatchObject({ success: true });
    setAuthState({ authenticated: true, userId: 'cuenta-b' });
    for (const action of ['status', 'cancel', 'release']) {
      expect(await ipc._getHandler('media-input:' + action)(event, { uploadId: 'propia' })).toMatchObject({ success: false });
    }
    expect(service.cancel).not.toHaveBeenCalled();
    expect(service.release).not.toHaveBeenCalled();
  });

  it('no transfiere si cambia sesión mientras se resuelve la clave', async () => {
    const { event, service, window } = fixture(); let finish!: (value: string) => void;
    ipc._clearHandlers(); registerMediaInputHandlers(service as unknown as MediaInputService, () => window, caller => ({ ...caller, key: () => new Promise(resolve => { finish = resolve; }) }));
    const pending = ipc._getHandler('media-input:upload')(event, input); await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
    setAuthState({ authenticated: false, userId: null }); finish('clave-nativa-ficticia-main'); expect(await pending).toMatchObject({ success: false }); expect(service.upload).not.toHaveBeenCalled();
  });
  it('la clave nativa llega al servicio sin aceptarse desde renderer', async () => {
    const { event, service } = fixture();
    expect(await ipc._getHandler('media-input:upload')(event, { ...input, apiKey: 'clave-renderer' })).toMatchObject({ success: false });
    expect(service.upload).not.toHaveBeenCalled();
    expect(await ipc._getHandler('media-input:upload')(event, input)).toMatchObject({ success: true });
    expect(service.upload).toHaveBeenCalledWith(expect.objectContaining({ apiKey: 'clave-nativa-ficticia-main' }), expect.any(Function));
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
