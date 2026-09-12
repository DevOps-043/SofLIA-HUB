import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { app, BrowserWindow, dialog, globalShortcut } from 'electron';
import { registerAppLifecycle } from '../main/app-lifecycle';
import { createRuntimeState } from '../main/runtime-state';

vi.mock('../python-runtime-service', () => ({ pythonRuntimeService: { stop: vi.fn() } }));
vi.mock('../python-tools-service', () => ({ pythonToolsService: { stop: vi.fn() } }));

function fixture() {
  const events = new EventEmitter();
  vi.mocked(app.on).mockImplementation(((name: string, listener: (...args: unknown[]) => void) => {
    events.on(name, listener);
    return app;
  }) as typeof app.on);
  const state = createRuntimeState(null);
  state.win = new BrowserWindow();
  const services = {
    integratedBrowserService: {
      flushSessionForShutdown: vi.fn(async () => {}), flushClosedProfileForShutdown: vi.fn(async () => {}),
      commitShutdown: vi.fn(), resumeAfterShutdown: vi.fn(),
    },
    updaterService: { setInstallGuard: vi.fn<(guard: (install: () => void) => Promise<boolean>) => void>(), stop: vi.fn() },
    pathMemoryService: { stop: vi.fn() },
    clipboardAssistant: { stop: vi.fn() },
    meetingPassiveDetectionService: { stopPolling: vi.fn() },
  };
  const controls = { createWindow: vi.fn(), routeShareLinkToRenderer: vi.fn(), routeAuthCallbackToRenderer: vi.fn(), routeMeetingTriggerToRenderer: vi.fn() };
  registerAppLifecycle({ services, state, controls });
  return { events, services, state, controls };
}

const settle = async () => { for (let i = 0; i < 8; i += 1) await Promise.resolve(); };

beforeEach(() => { vi.clearAllMocks(); vi.mocked(dialog.showMessageBox).mockResolvedValue({ response: 1, checkboxChecked: false }); });
afterEach(() => { vi.mocked(app.on).mockReset(); vi.mocked(app.quit).mockReset(); });

describe('cierre de la aplicación', () => {
  it('detiene la primera salida, guarda y sólo libera servicios en will-quit', async () => {
    const f = fixture();
    let finish!: () => void;
    f.services.integratedBrowserService.flushSessionForShutdown.mockReturnValue(new Promise<void>((resolve) => { finish = resolve; }));
    const preventDefault = vi.fn();
    f.events.emit('before-quit', { preventDefault });
    f.events.emit('before-quit', { preventDefault });
    await settle();
    expect(preventDefault).toHaveBeenCalledTimes(2);
    expect(app.quit).not.toHaveBeenCalled();
    expect(f.services.pathMemoryService.stop).not.toHaveBeenCalled();
    finish();
    await settle();
    expect(app.quit).toHaveBeenCalledOnce();
    expect(f.state.isQuitting).toBe(true);
    const secondPrevent = vi.fn();
    f.events.emit('before-quit', { preventDefault: secondPrevent });
    expect(secondPrevent).not.toHaveBeenCalled();
    const preventFinal = vi.fn();
    f.events.emit('will-quit', { preventDefault: preventFinal });
    expect(preventFinal).toHaveBeenCalledOnce();
    expect(f.services.pathMemoryService.stop).not.toHaveBeenCalled();
    await settle();
    expect(app.quit).toHaveBeenCalledTimes(2);
    const finalBefore = vi.fn();
    f.events.emit('before-quit', { preventDefault: finalBefore });
    expect(finalBefore).not.toHaveBeenCalled();
    f.events.emit('will-quit', { preventDefault: vi.fn() });
    f.events.emit('will-quit', { preventDefault: vi.fn() });
    expect(f.services.pathMemoryService.stop).toHaveBeenCalledOnce();
    expect(f.services.updaterService.stop).toHaveBeenCalledOnce();
    expect(globalShortcut.unregisterAll).toHaveBeenCalledOnce();
  });

  it('un servicio que falla al detenerse no impide liberar los siguientes', async () => {
    const f = fixture();
    f.services.pathMemoryService.stop.mockImplementationOnce(() => { throw new Error('fallo'); });
    f.events.emit('will-quit', { preventDefault: vi.fn() });
    await settle();
    expect(() => f.events.emit('will-quit', { preventDefault: vi.fn() })).not.toThrow();
    expect(f.services.clipboardAssistant.stop).toHaveBeenCalledOnce();
    expect(f.services.updaterService.stop).toHaveBeenCalledOnce();
  });

  it('cancelar conserva servicios y revierte la marca de salida del tray', async () => {
    const f = fixture();
    f.state.isQuitting = true;
    f.services.integratedBrowserService.flushSessionForShutdown.mockRejectedValueOnce(new Error('ruta privada'));
    f.events.emit('before-quit', { preventDefault: vi.fn() });
    await settle();
    expect(dialog.showMessageBox).toHaveBeenCalledWith(f.state.win, expect.objectContaining({ defaultId: 1, cancelId: 1 }));
    expect(JSON.stringify(vi.mocked(dialog.showMessageBox).mock.calls)).not.toContain('ruta privada');
    expect(app.quit).not.toHaveBeenCalled();
    expect(f.state.isQuitting).toBe(false);
    expect(f.services.integratedBrowserService.resumeAfterShutdown).toHaveBeenCalledOnce();
    expect(f.services.pathMemoryService.stop).not.toHaveBeenCalled();
    expect(f.services.integratedBrowserService.flushClosedProfileForShutdown).not.toHaveBeenCalled();
  });

  it('espera la limpieza después de cerrar vistas y evita una salida paralela', async () => {
    const f = fixture();
    let finish!: () => void;
    f.services.integratedBrowserService.flushClosedProfileForShutdown.mockReturnValueOnce(new Promise<void>((resolve) => { finish = resolve; }));
    const prevent = vi.fn();
    f.events.emit('will-quit', { preventDefault: prevent });
    f.events.emit('will-quit', { preventDefault: prevent });
    f.events.emit('before-quit', { preventDefault: prevent });
    f.events.emit('activate');
    await settle();
    expect(f.services.integratedBrowserService.flushClosedProfileForShutdown).toHaveBeenCalledOnce();
    expect(f.controls.createWindow).not.toHaveBeenCalled();
    expect(app.quit).not.toHaveBeenCalled();
    expect(f.services.pathMemoryService.stop).not.toHaveBeenCalled();
    finish();
    await settle();
    expect(app.quit).toHaveBeenCalledOnce();
  });

  it('cancelar una limpieza fallida vuelve a la aplicación sin publicar el error interno', async () => {
    const f = fixture();
    f.services.integratedBrowserService.flushClosedProfileForShutdown.mockRejectedValueOnce(new Error('ruta privada del equipo'));
    f.events.emit('will-quit', { preventDefault: vi.fn() });
    await settle();
    expect(f.controls.createWindow).toHaveBeenCalledExactlyOnceWith(true);
    expect(f.state.isQuitting).toBe(false);
    expect(app.quit).not.toHaveBeenCalled();
    expect(JSON.stringify(vi.mocked(dialog.showMessageBox).mock.calls)).not.toContain('ruta privada del equipo');
  });

  it('sólo permite salir con limpieza incompleta por una decisión explícita', async () => {
    const f = fixture();
    vi.mocked(dialog.showMessageBox).mockResolvedValueOnce({ response: 2, checkboxChecked: false });
    f.services.integratedBrowserService.flushClosedProfileForShutdown.mockRejectedValueOnce(new Error('ocupado'));
    f.events.emit('will-quit', { preventDefault: vi.fn() });
    await settle();
    expect(app.quit).toHaveBeenCalledOnce();
    expect(f.controls.createWindow).not.toHaveBeenCalled();
  });

  it('la misma protección espera antes de iniciar una instalación explícita', async () => {
    const f = fixture();
    const guard = f.services.updaterService.setInstallGuard.mock.calls[0][0] as (install: () => void) => Promise<boolean>;
    let finish!: () => void;
    f.services.integratedBrowserService.flushSessionForShutdown.mockReturnValue(new Promise<void>((resolve) => { finish = resolve; }));
    const install = vi.fn();
    const pending = guard(install);
    await settle();
    expect(install).not.toHaveBeenCalled();
    finish();
    expect(await pending).toBe(true);
    expect(install).toHaveBeenCalledOnce();
    const preventDefault = vi.fn();
    f.events.emit('before-quit', { preventDefault });
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it('un beforeunload cancelado devuelve el control sin desmontar servicios', async () => {
    const f = fixture();
    const contents = new EventEmitter();
    f.events.emit('web-contents-created', {}, contents);
    f.events.emit('before-quit', { preventDefault: vi.fn() });
    await settle();
    contents.emit('will-prevent-unload');
    expect(f.state.isQuitting).toBe(false);
    expect(f.services.integratedBrowserService.resumeAfterShutdown).toHaveBeenCalledOnce();
    expect(f.services.pathMemoryService.stop).not.toHaveBeenCalled();
  });
});
