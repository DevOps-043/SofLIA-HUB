import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ipcMain, BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import { UpdaterService } from '../updater-service';
import { registerUpdaterHandlers } from '../updater-handlers';

const updater = vi.hoisted(() => ({
  on: vi.fn(), checkForUpdates: vi.fn(async () => {}), downloadUpdate: vi.fn(async () => {}), quitAndInstall: vi.fn(),
}));
vi.mock('electron-updater', () => ({ default: { autoUpdater: updater } }));

function fixture(downloaded = true) {
  const events = new EventEmitter();
  updater.on.mockImplementation((name: string, callback: (...args: unknown[]) => void) => { events.on(name, callback); return updater; });
  const service = new UpdaterService();
  service.on('error', () => {});
  service.init();
  if (downloaded) events.emit('update-downloaded', {});
  return { service, events };
}

beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); updater.quitAndInstall.mockReset(); });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

describe('instalación después del guardado', () => {
  it('no instala sin descarga o sin protección de cierre', async () => {
    const f = fixture(false);
    await expect(f.service.installUpdate()).rejects.toThrow(/descargada/);
    f.events.emit('update-downloaded', {});
    await expect(f.service.installUpdate()).rejects.toThrow(/protección de cierre/i);
    expect(updater.quitAndInstall).not.toHaveBeenCalled();
  });

  it('espera la aprobación, agrupa clics repetidos y no repite la instalación aceptada', async () => {
    const f = fixture();
    let approve!: () => void;
    const guard = vi.fn((install: () => void) => new Promise<boolean>((resolve) => {
      approve = () => { install(); resolve(true); };
    }));
    f.service.setInstallGuard(guard);
    const first = f.service.installUpdate();
    expect(f.service.installUpdate()).toBe(first);
    expect(updater.quitAndInstall).not.toHaveBeenCalled();
    approve();
    await first;
    await f.service.installUpdate();
    expect(updater.quitAndInstall).toHaveBeenCalledExactlyOnceWith(true, true);
    expect(guard).toHaveBeenCalledOnce();
  });

  it('cancelar o fallar permite reintentar y no informa éxito', async () => {
    const f = fixture();
    f.service.setInstallGuard(async () => false);
    await expect(f.service.installUpdate()).rejects.toThrow(/canceló/);
    expect(updater.quitAndInstall).not.toHaveBeenCalled();
    f.service.setInstallGuard(async (install) => { install(); return true; });
    updater.quitAndInstall.mockImplementationOnce(() => { throw new Error('ocupado'); });
    await expect(f.service.installUpdate()).rejects.toThrow('ocupado');
    await f.service.installUpdate();
    expect(updater.quitAndInstall).toHaveBeenCalledTimes(2);
  });

  it('el error emitido por el instalador devuelve el control al cierre y permite reintentar', async () => {
    const f = fixture();
    const onFailure = vi.fn();
    f.service.setInstallGuard(async (install) => { install(); return true; }, onFailure);
    updater.quitAndInstall.mockImplementationOnce(() => f.events.emit('error', new Error('fallo del instalador')));
    await expect(f.service.installUpdate()).rejects.toThrow(/instalador/);
    expect(onFailure).toHaveBeenCalledOnce();
    f.events.emit('update-downloaded', {});
    await f.service.installUpdate();
    expect(updater.quitAndInstall).toHaveBeenCalledTimes(2);
  });

  it('stop cancela también la comprobación retrasada del arranque', async () => {
    const f = fixture();
    f.service.stop();
    await vi.advanceTimersByTimeAsync(5 * 60 * 60 * 1000);
    expect(updater.checkForUpdates).not.toHaveBeenCalled();
  });
});

describe('IPC de instalación', () => {
  function handlerFixture() {
    const f = fixture();
    const window = new BrowserWindow();
    Object.defineProperty(window.webContents, 'mainFrame', { value: {}, configurable: true });
    registerUpdaterHandlers(f.service, () => window);
    const handler = vi.mocked(ipcMain.handle).mock.calls.find(([channel]) => channel === 'updater:install-update')![1];
    const event = { sender: window.webContents, senderFrame: window.webContents.mainFrame } as IpcMainInvokeEvent;
    return { ...f, window, handler, event };
  }

  it('espera la operación y transmite un error saneado cuando falla', async () => {
    const f = handlerFixture();
    let finish!: () => void;
    vi.spyOn(f.service, 'installUpdate').mockReturnValueOnce(new Promise<void>((resolve) => { finish = resolve; }));
    let finished = false;
    const pending = Promise.resolve(f.handler(f.event)).then((result) => { finished = true; return result; });
    await Promise.resolve();
    expect(finished).toBe(false);
    finish();
    expect(await pending).toEqual({ success: true });
    vi.spyOn(f.service, 'installUpdate').mockRejectedValueOnce(new Error('C:/ruta-privada/clave'));
    const failed = await f.handler(f.event);
    expect(failed.success).toBe(false);
    expect(failed.error).not.toContain('ruta-privada');
  });

  it('rechaza otro WebContents y subframes antes de invocar la instalación', async () => {
    const f = handlerFixture();
    const install = vi.spyOn(f.service, 'installUpdate');
    expect(await f.handler({ sender: new BrowserWindow().webContents } as IpcMainInvokeEvent)).toEqual({ success: false, error: 'sender_denied' });
    expect(await f.handler({ ...f.event, senderFrame: {} } as IpcMainInvokeEvent)).toEqual({ success: false, error: 'sender_denied' });
    expect(await f.handler({ ...f.event, senderFrame: null } as IpcMainInvokeEvent)).toEqual({ success: false, error: 'sender_denied' });
    expect(install).not.toHaveBeenCalled();
  });
});
