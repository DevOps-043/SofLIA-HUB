import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserWindow, WebContentsView, dialog } from 'electron';
import { IntegratedBrowserService } from '../integrated-browser';

type MockIntegratedBrowserView = {
  options?: { webPreferences?: Record<string, unknown> };
  setBounds: ReturnType<typeof vi.fn>;
    webContents: {
      close: ReturnType<typeof vi.fn>;
      loadURL: ReturnType<typeof vi.fn>;
      setWindowOpenHandler: ReturnType<typeof vi.fn>;
      session: {
        setPermissionCheckHandler: ReturnType<typeof vi.fn>;
        setPermissionRequestHandler: ReturnType<typeof vi.fn>;
      };
  };
};

const browserViewHarness = WebContentsView as unknown as {
  instances: MockIntegratedBrowserView[];
};

describe('IntegratedBrowserService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    browserViewHarness.instances.length = 0;
  });

  it('crea una sola vista aislada, persiste la particion y reutiliza la instancia', async () => {
    const window = new BrowserWindow();
    const service = new IntegratedBrowserService();
    service.attachWindow(window);

    await service.open('https://example.com');
    await service.open();

    expect(browserViewHarness.instances).toHaveLength(1);
    const view = browserViewHarness.instances[0];
    expect(view.options?.webPreferences).toMatchObject({
      partition: 'persist:soflia-integrated-browser',
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    });
    expect(window.contentView.addChildView).toHaveBeenCalledTimes(1);
  });

  it('publica bounds visibles, estado y libera recursos al cerrar', async () => {
    const window = new BrowserWindow();
    const service = new IntegratedBrowserService();
    service.attachWindow(window);
    await service.open('https://example.com');
    const state = service.setViewport({ x: 200, y: 80, width: 800, height: 600 });
    const view = browserViewHarness.instances[0];

    expect(view.setBounds).toHaveBeenCalledWith({ x: 200, y: 80, width: 800, height: 600 });
    expect(state.isVisible).toBe(true);
    expect(window.webContents.send).toHaveBeenCalledWith('integrated-browser:state-changed', expect.objectContaining({ isVisible: true }));

    service.detachWindow();
    expect(window.contentView.removeChildView).toHaveBeenCalledWith(view);
    expect(view.webContents.close).toHaveBeenCalled();
    expect(service.getState().isVisible).toBe(false);
  });

  it('bloquea popups peligrosos y confina HTTP(S) a la misma vista', async () => {
    const service = new IntegratedBrowserService();
    service.attachWindow(new BrowserWindow());
    await service.open('https://example.com');
    const contents = browserViewHarness.instances[0].webContents;
    const handler = contents.setWindowOpenHandler.mock.calls[0][0];

    expect(handler({ url: 'https://safe.example/path' })).toEqual({ action: 'deny' });
    expect(contents.loadURL).toHaveBeenCalledWith('https://safe.example/path');
    expect(handler({ url: 'javascript:alert(1)' })).toEqual({ action: 'deny' });
    expect(service.getState().error).toMatch(/protocolo no permitido/i);
  });

  it('deniega permisos no allowlisted y exige aprobacion para media', async () => {
    vi.mocked(dialog.showMessageBox).mockResolvedValueOnce({ response: 1, checkboxChecked: false });
    const service = new IntegratedBrowserService();
    service.attachWindow(new BrowserWindow());
    await service.open('https://example.com');
    const contents = browserViewHarness.instances[0].webContents;
    const request = contents.session.setPermissionRequestHandler.mock.calls[0][0];
    const check = contents.session.setPermissionCheckHandler.mock.calls[0][0];
    const usbCallback = vi.fn();
    const mediaCallback = vi.fn();

    request(contents, 'usb', usbCallback, { requestingUrl: 'https://example.com' });
    request(contents, 'media', mediaCallback, { securityOrigin: 'https://example.com', mediaTypes: ['audio'] });
    await Promise.resolve();

    expect(usbCallback).toHaveBeenCalledWith(false);
    expect(dialog.showMessageBox).toHaveBeenCalled();
    expect(mediaCallback).toHaveBeenCalledWith(true);
    expect(check(contents, 'media', 'https://example.com', { isMainFrame: true, mediaType: 'audio' })).toBe(true);
    expect(check(contents, 'media', 'https://example.com', { isMainFrame: true, mediaType: 'video' })).toBe(false);
  });

  it('impide dos tareas agentes simultaneas y libera el control tras un fallo de viewport', async () => {
    const service = new IntegratedBrowserService();
    const window = new BrowserWindow();
    service.attachWindow(window);
    await service.open('https://example.com');
    service.setViewport({ x: 100, y: 100, width: 800, height: 600 });

    await service.openForAgent();
    await expect(service.openForAgent()).rejects.toThrow(/otra tarea/i);
    expect(service.getState().agentControlling).toBe(true);
    service.releaseAgentControl();
    expect(service.getState().agentControlling).toBe(false);

    service.hide();
    await expect(service.openForAgent(undefined, 1)).rejects.toThrow(/viewport visible/i);
    expect(service.getState().agentControlling).toBe(false);
  });
});
