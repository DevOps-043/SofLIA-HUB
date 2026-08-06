import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BaseWindow, BrowserWindow, WebContentsView, dialog } from 'electron';
import { IntegratedBrowserService } from '../integrated-browser';

type MockIntegratedBrowserView = {
  options?: { webPreferences?: Record<string, unknown> };
  setBounds: ReturnType<typeof vi.fn>;
  setVisible: ReturnType<typeof vi.fn>;
    webContents: {
      close: ReturnType<typeof vi.fn>;
      emit: (event: string, ...args: unknown[]) => boolean;
      capturePage: ReturnType<typeof vi.fn>;
      executeJavaScript: ReturnType<typeof vi.fn>;
      sendInputEvent: ReturnType<typeof vi.fn>;
      insertText: ReturnType<typeof vi.fn>;
      getUserAgent: ReturnType<typeof vi.fn>;
      setUserAgent: ReturnType<typeof vi.fn>;
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

const detachedWindowHarness = BaseWindow as unknown as {
  instances: Array<BrowserWindow & { emit: (event: string, ...args: unknown[]) => boolean }>;
};

describe('IntegratedBrowserService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    browserViewHarness.instances.length = 0;
    detachedWindowHarness.instances.length = 0;
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
      backgroundThrottling: false,
    });
    expect(view.webContents.setUserAgent).toHaveBeenCalledWith('Mozilla/5.0 Chrome/140.0.0.0 Safari/537.36');
    expect(window.contentView.addChildView).toHaveBeenCalledTimes(1);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('mantiene la percepción pasiva ligera y extrae DOM solo bajo demanda', async () => {
    vi.useFakeTimers();
    const service = new IntegratedBrowserService();
    service.attachWindow(new BrowserWindow());
    await service.open('https://www.youtube.com/watch?v=video');
    const contents = browserViewHarness.instances[0].webContents;
    contents.capturePage.mockClear();
    contents.executeJavaScript.mockClear();

    service.setViewport({ x: 0, y: 0, width: 1280, height: 720 });

    expect(contents.capturePage).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(4_000);
    expect(contents.capturePage).toHaveBeenCalledTimes(1);
    expect(contents.executeJavaScript).not.toHaveBeenCalled();
    const passiveImage = await contents.capturePage.mock.results[0].value;
    expect(passiveImage.resize).toHaveBeenCalledWith({ width: 1024, height: 576, quality: 'good' });
    await expect(service.getObservation(false)).resolves.toMatchObject({
      observation: null,
      observationStatus: { intervalMs: 10_000 },
    });

    await expect(service.getObservation(true)).resolves.toMatchObject({
      observation: expect.objectContaining({ screenshot: 'data:image/jpeg;base64,Y2FwdHVyYQ==' }),
    });
    expect(contents.capturePage).toHaveBeenCalledTimes(1);
    expect(contents.executeJavaScript).toHaveBeenCalledTimes(1);
    service.detachWindow();
  });

  it('espera una ventana de calma y no compite con Computer Use', async () => {
    vi.useFakeTimers();
    const service = new IntegratedBrowserService();
    service.attachWindow(new BrowserWindow());
    await service.open('https://www.youtube.com/watch?v=video');
    service.setViewport({ x: 0, y: 0, width: 1280, height: 720 });
    const contents = browserViewHarness.instances[0].webContents;
    contents.capturePage.mockClear();

    await service.openForAgent();
    contents.emit('input-event', {}, { type: 'mouseDown', x: 900, y: 280 });
    await vi.advanceTimersByTimeAsync(2_000);
    contents.emit('input-event', {}, { type: 'mouseWheel', x: 900, y: 280 });
    await vi.advanceTimersByTimeAsync(4_000);
    expect(contents.capturePage).not.toHaveBeenCalled();

    service.releaseAgentControl();
    await vi.advanceTimersByTimeAsync(3_999);
    expect(contents.capturePage).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(contents.capturePage).toHaveBeenCalledTimes(1);
    service.detachWindow();
  });

  it('omite capturas pasivas sin foco y conserva la observación forzada del agente', async () => {
    const window = new BrowserWindow();
    vi.mocked(window.isFocused).mockReturnValue(false);
    const service = new IntegratedBrowserService();
    service.attachWindow(window);
    await service.open('https://example.com/dinamica');
    const contents = browserViewHarness.instances[0].webContents;
    contents.capturePage.mockClear();
    contents.executeJavaScript.mockClear();

    service.setViewport({ x: 0, y: 0, width: 1280, height: 720 });
    await Promise.resolve();
    expect(contents.capturePage).not.toHaveBeenCalled();

    await service.getObservation(true);
    expect(contents.capturePage).toHaveBeenCalledTimes(1);
    expect(contents.executeJavaScript).toHaveBeenCalledTimes(1);
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

  it('no oculta ni reposiciona la vista cuando el viewport se republica igual', async () => {
    const service = new IntegratedBrowserService();
    service.attachWindow(new BrowserWindow());
    await service.open('https://www.youtube.com/watch?v=video');
    const view = browserViewHarness.instances[0];

    service.setViewport({ x: 200, y: 80, width: 800, height: 600 });
    view.setBounds.mockClear();
    view.setVisible.mockClear();

    service.setViewport({ x: 200, y: 80, width: 800, height: 600 });
    service.setViewport({ x: 200, y: 80, width: 800, height: 600 });

    expect(view.setBounds).not.toHaveBeenCalled();
    expect(view.setVisible).not.toHaveBeenCalled();

    service.setViewport({ x: 200, y: 80, width: 640, height: 600 });
    expect(view.setBounds).toHaveBeenCalledTimes(1);
    expect(view.setVisible).not.toHaveBeenCalled();
    service.detachWindow();
  });

  it('interactua por referencia del DOM y rechaza referencias vencidas', async () => {
    const service = new IntegratedBrowserService();
    service.attachWindow(new BrowserWindow());
    await service.open('https://mail.example/inbox');
    service.setViewport({ x: 0, y: 0, width: 800, height: 600 });
    const contents = browserViewHarness.instances[0].webContents;

    contents.executeJavaScript.mockResolvedValueOnce({
      ok: true, tag: 'a', role: 'link', name: 'Correo de Israel', type: '',
      href: 'https://mail.example/mensaje/1', disabled: false, editable: false, x: 120, y: 240, occluded: false,
    });
    const outcome = await service.clickElement('dom-7');

    expect(outcome.target).toMatchObject({ ref: 'dom-7', name: 'Correo de Israel' });
    expect(outcome.warning).toBeNull();
    expect(contents.sendInputEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'mouseDown', x: 120, y: 240 }));
    expect(contents.sendInputEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'mouseUp', x: 120, y: 240 }));

    contents.executeJavaScript.mockResolvedValueOnce({ ok: false, reason: 'referencia-vencida' });
    await expect(service.clickElement('dom-7')).rejects.toThrow(/vuelve a leer el DOM/i);
    service.detachWindow();
  });

  it('no interactua sin pestaña visible ni mientras el actuador visual controla', async () => {
    const service = new IntegratedBrowserService();
    service.attachWindow(new BrowserWindow());
    await service.open('https://mail.example/inbox');

    await expect(service.clickElement('dom-1')).rejects.toThrow(/pestaña visible/i);

    service.setViewport({ x: 0, y: 0, width: 800, height: 600 });
    await service.openForAgent();
    await expect(service.clickElement('dom-1')).rejects.toThrow(/controlado por otra tarea/i);
    expect(browserViewHarness.instances[0].webContents.executeJavaScript).not.toHaveBeenCalled();
    service.detachWindow();
  });

  it('captura exclusivamente la pagina visible para el turno multimodal', async () => {
    const service = new IntegratedBrowserService();
    service.attachWindow(new BrowserWindow());
    await service.open('https://example.com');
    await expect(service.captureVisiblePage()).rejects.toThrow(/no esta visible/i);

    service.setViewport({ x: 200, y: 80, width: 800, height: 600 });

    await expect(service.captureVisiblePage()).resolves.toBe('data:image/jpeg;base64,Y2FwdHVyYQ==');
    expect(browserViewHarness.instances[0].webContents.capturePage).toHaveBeenCalled();
  });

  it('descarta la observacion al ocultar y nunca reutiliza la de otra pestaña', async () => {
    const service = new IntegratedBrowserService();
    service.attachWindow(new BrowserWindow());
    await service.open('https://primaria.example');
    const first = browserViewHarness.instances[0].webContents;
    first.executeJavaScript.mockResolvedValue({
      title: 'Primaria', url: 'https://primaria.example/', language: 'es', text: 'Primaria',
      headings: [], landmarks: [], controls: [], frames: [],
      viewport: { width: 800, height: 600, scrollX: 0, scrollY: 0, documentWidth: 800, documentHeight: 600 }, truncated: false,
    });
    service.setViewport({ x: 0, y: 0, width: 800, height: 600 });
    expect((await service.getObservation(true)).observation?.dom.title).toBe('Primaria');

    await service.createTab('https://secundaria.example', false);
    const second = browserViewHarness.instances[1].webContents;
    second.executeJavaScript.mockRejectedValue(new Error('DOM no disponible'));
    service.activateTab(service.getState().tabs[1].id);
    expect((await service.getObservation(true)).observation).toBeNull();

    service.activateTab(service.getState().tabs[0].id);
    expect((await service.getObservation(false)).observation?.dom.title).toBe('Primaria');
    service.hide();
    expect((await service.getObservation(false)).observation).toBeNull();
    service.detachWindow();
  });

  it('bloquea popups peligrosos y convierte HTTP(S) en una pestaña interna', async () => {
    const service = new IntegratedBrowserService();
    service.attachWindow(new BrowserWindow());
    await service.open('https://example.com');
    const contents = browserViewHarness.instances[0].webContents;
    const handler = contents.setWindowOpenHandler.mock.calls[0][0];

    expect(handler({ url: 'https://safe.example/path' })).toEqual({ action: 'deny' });
    await vi.waitFor(() => expect(browserViewHarness.instances).toHaveLength(2));
    expect(browserViewHarness.instances[1].webContents.loadURL).toHaveBeenCalledWith('https://safe.example/path');
    expect(handler({ url: 'javascript:alert(1)' })).toEqual({ action: 'deny' });
    expect(service.getState().error).toMatch(/protocolo no permitido/i);
  });

  it('mantiene dos pestañas vivas en división, enfoca el objetivo y libera solo la cerrada', async () => {
    const window = new BrowserWindow();
    const service = new IntegratedBrowserService();
    service.attachWindow(window);
    await service.open('https://primaria.example');
    const firstId = service.getState().activeTabId!;
    await service.createTab('https://secundaria.example');
    const secondId = service.getState().activeTabId!;
    service.activateTab(firstId);
    await service.setViewMode('split', secondId);
    service.setViewport({ x: 100, y: 80, width: 900, height: 600 });

    expect(service.getState()).toMatchObject({ viewMode: 'split', activeTabId: firstId, secondaryTabId: secondId });
    expect(browserViewHarness.instances[0].setBounds).toHaveBeenLastCalledWith({ x: 100, y: 80, width: 447, height: 600 });
    expect(browserViewHarness.instances[1].setBounds).toHaveBeenLastCalledWith({ x: 553, y: 80, width: 447, height: 600 });
    browserViewHarness.instances[1].webContents.emit('focus');
    expect(service.getState().activeTabId).toBe(secondId);
    expect(service.getViewportSize()).toEqual({ width: 447, height: 600 });

    service.closeTab(secondId);
    expect(browserViewHarness.instances[1].webContents.close).toHaveBeenCalled();
    expect(browserViewHarness.instances[0].webContents.close).not.toHaveBeenCalled();
    expect(service.getState()).toMatchObject({ viewMode: 'single', activeTabId: firstId });
  });

  it('separa y reintegra la misma vista sin recargar ni cambiar de sesión', async () => {
    const window = new BrowserWindow();
    const service = new IntegratedBrowserService();
    service.attachWindow(window);
    await service.open('https://example.com/transcripcion');
    service.setViewport({ x: 100, y: 80, width: 900, height: 600 });
    const tabId = service.getState().activeTabId!;
    const view = browserViewHarness.instances[0];
    view.webContents.loadURL.mockClear();

    const detachedState = service.detachTab(tabId);

    expect(detachedWindowHarness.instances).toHaveLength(1);
    const detached = detachedWindowHarness.instances[0];
    expect(window.contentView.removeChildView).toHaveBeenCalledWith(view);
    expect(detached.contentView.addChildView).toHaveBeenCalledWith(view);
    expect(detachedState.tabs.find((tab) => tab.id === tabId)?.isDetached).toBe(true);
    expect(view.webContents.loadURL).not.toHaveBeenCalled();
    expect(service.getViewportSize()).toEqual({ width: 1024, height: 768 });
    await expect(service.captureVisiblePage()).resolves.toContain('data:image/jpeg');

    window.emit('focus');
    expect(service.getState().activeTabId).not.toBe(tabId);
    detached.emit('focus');
    expect(service.getState().activeTabId).toBe(tabId);

    const preventDefault = vi.fn();
    detached.emit('close', { preventDefault });

    expect(preventDefault).toHaveBeenCalled();
    expect(window.contentView.addChildView).toHaveBeenLastCalledWith(view);
    expect(detached.destroy).toHaveBeenCalled();
    expect(service.getState().tabs.find((tab) => tab.id === tabId)?.isDetached).toBe(false);
    expect(view.webContents.loadURL).not.toHaveBeenCalled();
  });

  it('acota ventanas separadas y conserva el límite global de ocho vistas vivas', async () => {
    const service = new IntegratedBrowserService();
    service.attachWindow(new BrowserWindow());
    await service.open('https://example.com/0');
    service.setViewport({ x: 0, y: 0, width: 1200, height: 800 });
    const ids = [service.getState().activeTabId!];
    for (let index = 1; index < 5; index += 1) {
      await service.createTab(`https://example.com/${index}`);
      ids.push(service.getState().activeTabId!);
    }
    for (const id of ids.slice(0, 4)) service.detachTab(id);
    for (let index = 5; index < 13; index += 1) await service.createTab(`https://example.com/${index}`, false);

    expect(detachedWindowHarness.instances).toHaveLength(4);
    expect(() => service.detachTab(ids[4])).toThrow(/hasta 4 ventanas separadas/i);
    const tabs = service.getState().tabs;
    expect(tabs.filter((tab) => !tab.isSuspended)).toHaveLength(8);
    expect(ids.slice(0, 4).every((id) => tabs.find((tab) => tab.id === id)?.isDetached && !tabs.find((tab) => tab.id === id)?.isSuspended)).toBe(true);
  });

  it('virtualiza vistas inactivas, conserva 500 pestañas lógicas y aplica el límite', async () => {
    const service = new IntegratedBrowserService();
    service.attachWindow(new BrowserWindow());
    await service.open('https://example.com');
    await expect(service.createTab('javascript:alert(1)')).rejects.toThrow(/protocolo/i);
    expect(browserViewHarness.instances).toHaveLength(1);

    for (let index = 1; index < 500; index += 1) await service.createTab(`https://example.com/${index}`, false);
    const tabs = service.getState().tabs;
    expect(tabs).toHaveLength(500);
    expect(tabs.filter((tab) => !tab.isSuspended)).toHaveLength(8);
    expect(tabs.find((tab) => tab.id === service.getState().activeTabId)?.isSuspended).toBe(false);
    const suspended = tabs.find((tab) => tab.isSuspended)!;
    service.activateTab(suspended.id);
    expect(service.getState().tabs.find((tab) => tab.id === suspended.id)?.isSuspended).toBe(false);
    expect(browserViewHarness.instances[browserViewHarness.instances.length - 1]?.webContents.loadURL).toHaveBeenCalledWith(suspended.url);
    await expect(service.createTab('https://example.com/limite')).rejects.toThrow(/hasta 500 pestañas/i);
    expect(browserViewHarness.instances.filter((view) => !view.webContents.close.mock.calls.length)).toHaveLength(8);
  });

  it('ignora redirecciones de subframes y bloquea protocolos peligrosos en el frame principal', async () => {
    const service = new IntegratedBrowserService();
    service.attachWindow(new BrowserWindow());
    await service.open('https://accounts.google.com/');
    const contents = browserViewHarness.instances[0].webContents;
    const preventSubframe = vi.fn();
    contents.emit('will-redirect', { url: 'custom-auth://callback', isMainFrame: false, preventDefault: preventSubframe });
    expect(preventSubframe).not.toHaveBeenCalled();
    expect(service.getState().error).toBeNull();

    const preventMainFrame = vi.fn();
    contents.emit('will-redirect', { url: 'javascript:alert(1)', isMainFrame: true, preventDefault: preventMainFrame });
    expect(preventMainFrame).toHaveBeenCalled();
    expect(service.getState().error).toMatch(/redireccion fue bloqueada/i);
  });

  it('ignora eventos tardíos de una vista suspendida después de restaurarla', async () => {
    const service = new IntegratedBrowserService();
    service.attachWindow(new BrowserWindow());
    await service.open('https://activa.example/');
    for (let index = 1; index <= 8; index += 1) await service.createTab(`https://inactiva.example/${index}`, false);
    const suspended = service.getState().tabs.find((tab) => tab.isSuspended)!;
    const retiredContents = browserViewHarness.instances.find((view) => view.webContents.close.mock.calls.length)?.webContents;

    service.activateTab(suspended.id);
    retiredContents?.emit('did-fail-load', {}, -105, 'NAME_NOT_RESOLVED', suspended.url, true);

    expect(service.getState().activeTabId).toBe(suspended.id);
    expect(service.getState().error).toBeNull();
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
