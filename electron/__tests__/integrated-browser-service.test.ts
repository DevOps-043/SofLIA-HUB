import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { BaseWindow, BrowserWindow, WebContentsView, dialog, systemPreferences } from 'electron';
import { IntegratedBrowserService } from '../integrated-browser';
import { BrowserSitePermissionStore } from '../integrated-browser/site-permissions';

// El servicio materializa su primera vista con el gestor de extensiones real,
// que lee su registro en disco de forma asincrona. Esta suite no ejercita
// extensiones y esa lectura emitia avisos despues del teardown del worker.
// El historial escribe y lee en disco de forma asincrona al terminar cada
// carga. Esta suite no lo ejercita y esas lecturas emitian avisos despues del
// teardown del worker.
vi.mock('../integrated-browser/browser-history-store', () => ({
  BrowserHistoryStore: class {
    record = vi.fn(async () => null);
    list = vi.fn(async () => []);
    clear = vi.fn(async () => {});
  },
}));

vi.mock('../integrated-browser/extension-manager', () => ({
  BrowserExtensionManager: class {
    restore = vi.fn(async () => []);
    list = vi.fn(async () => []);
    prepareFromDialog = vi.fn(async () => ({ canceled: true }));
    confirmInstall = vi.fn(async () => { throw new Error('Extensiones no disponibles en pruebas.'); });
    setEnabled = vi.fn(async () => { throw new Error('Extensiones no disponibles en pruebas.'); });
    remove = vi.fn(async () => false);
  },
}));

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

// La concesion de `media` encadena el almacen en disco, el dialogo HITL y la
// consulta al sistema operativo: la respuesta al renderer llega varios ciclos
// despues, incluidos los de entrada/salida.
const flushPermissionQueue = async () => {
  for (let index = 0; index < 6; index += 1) await new Promise((resolve) => setImmediate(resolve));
};

/**
 * Cada prueba usa su propio archivo de permisos: el almacen es persistente y
 * una decision guardada en una prueba cambiaria el resultado de la siguiente.
 */
const permissionStorePaths: string[] = [];

function newStore(): BrowserSitePermissionStore {
  const filePath = path.join(os.tmpdir(), `soflia-site-permissions-${randomUUID()}.json`);
  permissionStorePaths.push(filePath);
  return new BrowserSitePermissionStore(filePath);
}

function newService(store: BrowserSitePermissionStore = newStore()): IntegratedBrowserService {
  return new IntegratedBrowserService(undefined, undefined, undefined, undefined, store);
}

// `process.platform` decide si se consulta el permiso nativo. Fijarlo mantiene
// la prueba estable en cualquier runner.
const withPlatform = (platform: NodeJS.Platform, run: () => Promise<void>) => {
  const original = Object.getOwnPropertyDescriptor(process, 'platform')!;
  Object.defineProperty(process, 'platform', { ...original, value: platform });
  return run().finally(() => Object.defineProperty(process, 'platform', original));
};

describe('IntegratedBrowserService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // `clearAllMocks` borra las llamadas pero conserva las implementaciones:
    // sin reponerlas, el cuadro que una prueba deja rechazando arrastra a la
    // siguiente.
    vi.mocked(dialog.showMessageBox).mockResolvedValue({ response: 0, checkboxChecked: false });
    vi.mocked(systemPreferences.getMediaAccessStatus).mockReturnValue('granted');
    vi.mocked(systemPreferences.askForMediaAccess).mockResolvedValue(true);
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
    // El User-Agent queda identico al de un Chromium de escritorio: sin el
    // nombre de la aplicacion ni la ficha `Electron/`, que lo convertian en un
    // cliente desconocido frente a lo que anuncia `Sec-CH-UA`.
    expect(view.webContents.setUserAgent).toHaveBeenCalledWith(
      'Mozilla/5.0 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
    );
    expect(window.contentView.addChildView).toHaveBeenCalledTimes(1);
  });

  afterEach(async () => {
    vi.useRealTimers();
    await Promise.all(permissionStorePaths.splice(0).map((filePath) => fs.rm(filePath, { force: true })));
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
    await vi.advanceTimersByTimeAsync(11_999);
    expect(contents.capturePage).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(contents.capturePage).toHaveBeenCalledTimes(1);
    expect(contents.executeJavaScript).not.toHaveBeenCalled();
    const passiveImage = await contents.capturePage.mock.results[0].value;
    expect(passiveImage.resize).toHaveBeenCalledWith({ width: 1024, height: 576, quality: 'good' });
    await expect(service.getObservation(false)).resolves.toMatchObject({
      observation: null,
      observationStatus: { intervalMs: 30_000 },
    });

    await expect(service.getObservation(true)).resolves.toMatchObject({
      observation: expect.objectContaining({ screenshot: 'data:image/jpeg;base64,Y2FwdHVyYQ==' }),
    });
    expect(contents.capturePage).toHaveBeenCalledTimes(1);
    expect(contents.executeJavaScript).toHaveBeenCalledTimes(1);
    service.detachWindow();
  });

  it('BR-SEL-001: adjunta la selección viva al chat sin pasar por el menú contextual', async () => {
    vi.useFakeTimers();
    const parent = new BrowserWindow();
    const service = new IntegratedBrowserService();
    service.attachWindow(parent);
    await service.open('https://mail.google.com/chat');
    service.setViewport({ x: 0, y: 0, width: 1280, height: 720 });
    const contents = browserViewHarness.instances[0].webContents;
    const enviar = parent.webContents.send as unknown as ReturnType<typeof vi.fn>;
    enviar.mockClear();
    contents.executeJavaScript.mockResolvedValue('  CONCEPTO 3.2  ');

    contents.emit('input-event', {}, { type: 'mouseUp', x: 400, y: 300 });
    await vi.advanceTimersByTimeAsync(500);

    const avisos = enviar.mock.calls.filter(
      (call: unknown[]) => call[0] === 'integrated-browser:selection-action',
    );
    expect(avisos).toHaveLength(1);
    // Solo adjunta contexto: el compositor queda libre para que escriba el usuario.
    expect(avisos[0][1]).toMatchObject({ action: 'ask', text: 'CONCEPTO 3.2', instruction: '' });

    // La misma seleccion no se reenvia mientras siga viva.
    contents.emit('input-event', {}, { type: 'mouseUp', x: 410, y: 300 });
    await vi.advanceTimersByTimeAsync(500);
    expect(enviar.mock.calls.filter(
      (call: unknown[]) => call[0] === 'integrated-browser:selection-action',
    )).toHaveLength(1);

    service.detachWindow();
    vi.useRealTimers();
  });

  it('BR-SEL-002: al deshacer la selección deja de adjuntarla', async () => {
    vi.useFakeTimers();
    const parent = new BrowserWindow();
    const service = new IntegratedBrowserService();
    service.attachWindow(parent);
    await service.open('https://mail.google.com/chat');
    service.setViewport({ x: 0, y: 0, width: 1280, height: 720 });
    const contents = browserViewHarness.instances[0].webContents;
    const enviar = parent.webContents.send as unknown as ReturnType<typeof vi.fn>;
    enviar.mockClear();
    contents.executeJavaScript.mockResolvedValue('');

    contents.emit('input-event', {}, { type: 'mouseUp', x: 400, y: 300 });
    await vi.advanceTimersByTimeAsync(500);

    expect(enviar.mock.calls.filter(
      (call: unknown[]) => call[0] === 'integrated-browser:selection-action',
    )).toHaveLength(0);

    service.detachWindow();
    vi.useRealTimers();
  });

  it('BR-SEL-003: encuentra la selección aunque viva dentro de un iframe', async () => {
    vi.useFakeTimers();
    const parent = new BrowserWindow();
    const service = new IntegratedBrowserService();
    service.attachWindow(parent);
    await service.open('https://mail.google.com/mail/u/0/#chat/dm/wOBiBCAAAAE');
    service.setViewport({ x: 0, y: 0, width: 1280, height: 720 });
    const contents = browserViewHarness.instances[0].webContents;
    const enviar = parent.webContents.send as unknown as ReturnType<typeof vi.fn>;
    enviar.mockClear();
    // Gmail rinde el panel de chat en un marco anidado: el documento principal
    // no tiene seleccion, pero el hijo si.
    const marcoPrincipal = { executeJavaScript: vi.fn(async () => '') };
    const marcoHijo = { executeJavaScript: vi.fn(async () => '  CONCEPTO 3.2  ') };
    (contents as unknown as { mainFrame: unknown }).mainFrame = { framesInSubtree: [marcoPrincipal, marcoHijo] };

    contents.emit('input-event', {}, { type: 'mouseUp', x: 400, y: 300 });
    await vi.advanceTimersByTimeAsync(500);

    const avisos = enviar.mock.calls.filter(
      (call: unknown[]) => call[0] === 'integrated-browser:selection-action',
    );
    expect(avisos).toHaveLength(1);
    expect(avisos[0][1]).toMatchObject({ action: 'ask', text: 'CONCEPTO 3.2' });
    expect(marcoPrincipal.executeJavaScript).toHaveBeenCalled();

    service.detachWindow();
    vi.useRealTimers();
  });

  it('BR-SEL-004: el aviso de la página dispara el sondeo y retira el adjunto al deseleccionar', async () => {
    vi.useFakeTimers();
    const parent = new BrowserWindow();
    const service = new IntegratedBrowserService();
    service.attachWindow(parent);
    await service.open('https://mail.google.com/chat');
    service.setViewport({ x: 0, y: 0, width: 1280, height: 720 });
    const contents = browserViewHarness.instances[0].webContents;
    const enviar = parent.webContents.send as unknown as ReturnType<typeof vi.fn>;
    const avisos = () => enviar.mock.calls.filter((call: unknown[]) => call[0] === 'integrated-browser:selection-action');
    enviar.mockClear();

    // La pagina avisa por consola: no hace falta ningun evento de entrada.
    contents.executeJavaScript.mockResolvedValue('CONCEPTO 3.2');
    contents.emit('console-message', { message: '__SOFLIA_SELECTION__' });
    await vi.advanceTimersByTimeAsync(500);
    expect(avisos()).toHaveLength(1);
    expect(avisos()[0][1]).toMatchObject({ text: 'CONCEPTO 3.2' });

    // Al deshacer la seleccion se avisa con texto vacio para retirar el chip.
    contents.executeJavaScript.mockResolvedValue('');
    contents.emit('console-message', { message: '__SOFLIA_SELECTION__' });
    await vi.advanceTimersByTimeAsync(500);
    expect(avisos()).toHaveLength(2);
    expect(avisos()[1][1]).toMatchObject({ text: '' });

    // Y no se repite el aviso mientras siga sin haber seleccion.
    contents.emit('console-message', { message: '__SOFLIA_SELECTION__' });
    await vi.advanceTimersByTimeAsync(500);
    expect(avisos()).toHaveLength(2);

    service.detachWindow();
    vi.useRealTimers();
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
    await vi.advanceTimersByTimeAsync(11_999);
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

    // Instalar el vigia de seleccion al cargar no es interactuar con la pagina.
    browserViewHarness.instances[0].webContents.executeJavaScript.mockClear();
    service.setViewport({ x: 0, y: 0, width: 800, height: 600 });
    await service.openForAgent();
    await expect(service.clickElement('dom-1')).rejects.toThrow(/controlado por otra tarea/i);
    expect(browserViewHarness.instances[0].webContents.executeJavaScript).not.toHaveBeenCalled();
    service.detachWindow();
  });

  it('no reporta como error la navegacion que el propio sitio reemplaza', async () => {
    const service = new IntegratedBrowserService();
    service.attachWindow(new BrowserWindow());
    await service.open('https://www.youtube.com/watch?v=video');
    const contents = browserViewHarness.instances[0].webContents;

    // YouTube reescribe su URL al arrancar y aborta la carga en curso.
    contents.loadURL.mockRejectedValueOnce(new Error("ERR_ABORTED (-3) loading 'https://www.youtube.com/watch?v=video&sttick=0'"));
    await expect(service.navigate('https://www.youtube.com/watch?v=video')).resolves.toBeTruthy();
    expect(service.getState().error).toBeNull();

    contents.loadURL.mockRejectedValueOnce(new Error('ERR_NAME_NOT_RESOLVED (-105) loading https://inexistente.example'));
    await expect(service.navigate('https://inexistente.example')).rejects.toThrow();
    expect(service.getState().error).toMatch(/ERR_NAME_NOT_RESOLVED/);
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

  it('deniega permisos de dispositivo y exige aprobacion para media', async () => {
    vi.mocked(dialog.showMessageBox).mockResolvedValue({ response: 1, checkboxChecked: false });
    const service = newService();
    service.attachWindow(new BrowserWindow());
    await service.open('https://example.com');
    const contents = browserViewHarness.instances[0].webContents;
    const request = contents.session.setPermissionRequestHandler.mock.calls[0][0];
    const check = contents.session.setPermissionCheckHandler.mock.calls[0][0];
    const usbCallback = vi.fn();
    const mediaCallback = vi.fn();

    request(contents, 'usb', usbCallback, { requestingUrl: 'https://example.com' });
    request(contents, 'media', mediaCallback, { securityOrigin: 'https://example.com', mediaTypes: ['audio'] });
    await vi.waitFor(() => expect(mediaCallback).toHaveBeenCalledWith(true));

    expect(usbCallback).toHaveBeenCalledWith(false);
    expect(dialog.showMessageBox).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ message: '¿Permitir acceso a micrófono?' }),
    );
    expect(check(contents, 'media', 'https://example.com', { isMainFrame: true, mediaType: 'audio' })).toBe(true);
    // Un permiso de dispositivo nunca es configurable ni consultable.
    expect(check(contents, 'usb', 'https://example.com', { isMainFrame: true })).toBe(false);
  });

  it('reporta camara y microfono sin decidir como disponibles para permissions.query', async () => {
    const service = newService();
    service.attachWindow(new BrowserWindow());
    await service.open('https://meet.example/');
    const contents = browserViewHarness.instances[0].webContents;
    const check = contents.session.setPermissionCheckHandler.mock.calls[0][0];

    // Sin esto, Google Meet leia "denied", mostraba "no puede usar el
    // microfono" y jamas llamaba a getUserMedia: el permiso no se podia
    // conceder nunca porque el dialogo no llegaba a abrirse.
    expect(check(contents, 'media', 'https://meet.example', { isMainFrame: true, mediaType: 'audio' })).toBe(true);
    expect(check(contents, 'media', 'https://meet.example', { isMainFrame: true, mediaType: 'video' })).toBe(true);
    // Lo que no se consulta antes de pedirlo sigue respondiendo que no.
    expect(check(contents, 'notifications', 'https://meet.example', { isMainFrame: true })).toBe(false);
  });

  it('respeta una decision guardada sin volver a preguntar', async () => {
    const store = newStore();
    await store.set('https://guardado.example', 'microphone', 'granted');
    await store.set('https://guardado.example', 'camera', 'denied');
    const service = newService(store);
    service.attachWindow(new BrowserWindow());
    await service.open('https://guardado.example/');
    const contents = browserViewHarness.instances[0].webContents;
    const request = contents.session.setPermissionRequestHandler.mock.calls[0][0];
    const check = contents.session.setPermissionCheckHandler.mock.calls[0][0];
    const micCallback = vi.fn();
    const camCallback = vi.fn();

    request(contents, 'media', micCallback, { securityOrigin: 'https://guardado.example', mediaTypes: ['audio'] });
    request(contents, 'media', camCallback, { securityOrigin: 'https://guardado.example', mediaTypes: ['video'] });
    await flushPermissionQueue();

    expect(micCallback).toHaveBeenCalledWith(true);
    expect(camCallback).toHaveBeenCalledWith(false);
    expect(dialog.showMessageBox).not.toHaveBeenCalled();
    expect(check(contents, 'media', 'https://guardado.example', { mediaType: 'video' })).toBe(false);
  });

  it('concede camara y microfono a una pestaña no activa de la misma particion', async () => {
    vi.mocked(dialog.showMessageBox).mockResolvedValue({ response: 1, checkboxChecked: false });
    const service = newService();
    service.attachWindow(new BrowserWindow());
    await service.open('https://activa.example/');
    await service.createTab('https://reunion.example/', false);
    const activeContents = browserViewHarness.instances[0].webContents;
    const backgroundContents = browserViewHarness.instances[1].webContents;
    const request = activeContents.session.setPermissionRequestHandler.mock.calls[0][0];
    const check = activeContents.session.setPermissionCheckHandler.mock.calls[0][0];
    const mediaCallback = vi.fn();

    request(backgroundContents, 'media', mediaCallback, {
      securityOrigin: 'https://reunion.example',
      mediaTypes: ['audio', 'video'],
    });
    await vi.waitFor(() => expect(mediaCallback).toHaveBeenCalledWith(true));

    expect(check(backgroundContents, 'media', 'https://reunion.example', { mediaType: 'video' })).toBe(true);
    expect(check(backgroundContents, 'media', 'https://reunion.example', { mediaType: 'audio' })).toBe(true);
  });

  it('muestra un cuadro a la vez y siempre responde a la pagina', async () => {
    // Una videollamada pide camara y microfono desde varios marcos a la vez.
    // Con los cuadros superpuestos el usuario no podia responder y la
    // solicitud quedaba colgada, dejando la llamada sin arrancar.
    let abiertos = 0;
    let maximoSimultaneo = 0;
    vi.mocked(dialog.showMessageBox).mockImplementation(async () => {
      abiertos += 1;
      maximoSimultaneo = Math.max(maximoSimultaneo, abiertos);
      await new Promise((resolve) => setImmediate(resolve));
      abiertos -= 1;
      return { response: 1, checkboxChecked: false };
    });
    const service = newService();
    service.attachWindow(new BrowserWindow());
    await service.open('https://meet.example/');
    const contents = browserViewHarness.instances[0].webContents;
    const request = contents.session.setPermissionRequestHandler.mock.calls[0][0];
    const primero = vi.fn();
    const segundo = vi.fn();

    request(contents, 'media', primero, { securityOrigin: 'https://meet.example', mediaTypes: ['audio', 'video'] });
    request(contents, 'media', segundo, { securityOrigin: 'https://meet.example', mediaTypes: ['video'] });

    await vi.waitFor(() => expect(primero).toHaveBeenCalledWith(true));
    await vi.waitFor(() => expect(segundo).toHaveBeenCalledWith(true));
    expect(maximoSimultaneo).toBe(1);
  });

  it('responde que no cuando el cuadro de permiso no se puede mostrar', async () => {
    vi.mocked(dialog.showMessageBox).mockRejectedValue(new Error('sin ventana disponible'));
    const service = newService();
    service.attachWindow(new BrowserWindow());
    await service.open('https://example.com');
    const contents = browserViewHarness.instances[0].webContents;
    const request = contents.session.setPermissionRequestHandler.mock.calls[0][0];
    const callback = vi.fn();

    request(contents, 'media', callback, { securityOrigin: 'https://example.com', mediaTypes: ['audio'] });

    // Lo importante es que responda: dejar la promesa pendiente colgaba a la
    // pagina indefinidamente.
    await vi.waitFor(() => expect(callback).toHaveBeenCalledWith(false));
  });

  it('concede sin interrumpir lo que solo cambia la presentacion y deniega lo demas', async () => {
    const service = newService();
    service.attachWindow(new BrowserWindow());
    await service.open('https://example.com');
    const contents = browserViewHarness.instances[0].webContents;
    const request = contents.session.setPermissionRequestHandler.mock.calls[0][0];
    const responses = new Map<string, ReturnType<typeof vi.fn>>();

    for (const permission of ['fullscreen', 'pointerLock', 'keyboardLock', 'mediaKeySystem', 'speaker-selection', 'clipboard-sanitized-write', 'storage-access', 'midi', 'openExternal']) {
      const callback = vi.fn();
      responses.set(permission, callback);
      request(contents, permission, callback, { securityOrigin: 'https://example.com' });
    }
    await flushPermissionQueue();

    for (const permission of ['fullscreen', 'pointerLock', 'keyboardLock', 'mediaKeySystem', 'speaker-selection', 'clipboard-sanitized-write', 'storage-access']) {
      expect(responses.get(permission)).toHaveBeenCalledWith(true);
    }
    for (const permission of ['midi', 'openExternal']) {
      expect(responses.get(permission)).toHaveBeenCalledWith(false);
    }
    expect(dialog.showMessageBox).not.toHaveBeenCalled();
  });

  it('no pregunta y explica la ruta del sistema cuando el sistema operativo bloquea la camara', async () => {
    await withPlatform('win32', async () => {
      vi.mocked(systemPreferences.getMediaAccessStatus).mockImplementation((mediaType) => (
        mediaType === 'camera' ? 'denied' : 'granted'
      ));
      const service = newService();
      service.attachWindow(new BrowserWindow());
      await service.open('https://example.com');
      const contents = browserViewHarness.instances[0].webContents;
      const request = contents.session.setPermissionRequestHandler.mock.calls[0][0];
      const mediaCallback = vi.fn();

      request(contents, 'media', mediaCallback, { securityOrigin: 'https://example.com', mediaTypes: ['video'] });
      await flushPermissionQueue();

      expect(mediaCallback).toHaveBeenCalledWith(false);
      expect(dialog.showMessageBox).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ title: 'Permiso del sistema bloqueado' }),
      );
      expect(dialog.showMessageBox).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ title: 'Permiso del navegador' }),
      );
    });
  });

  it('abre una ventana real para Document Picture-in-Picture en vez de una pestaña vacia', async () => {
    const service = newService();
    service.attachWindow(new BrowserWindow());
    await service.open('https://meet.example/');
    const contents = browserViewHarness.instances[0].webContents;
    const openHandler = contents.setWindowOpenHandler.mock.calls[0][0];

    const pip = openHandler({ url: 'about:blank', disposition: 'new-window', features: 'width=420,height=260' });
    const popup = openHandler({ url: 'https://accounts.example/oauth', disposition: 'new-window', features: '' });
    await Promise.resolve();

    expect(pip.action).toBe('allow');
    expect(pip.overrideBrowserWindowOptions).toMatchObject({ width: 420, height: 260 });
    // Sin `webPreferences` propias: la ventana debe heredar las del abridor
    // para conservar su proceso y el acceso desde `window.opener`.
    expect(pip.overrideBrowserWindowOptions).not.toHaveProperty('webPreferences');
    // El popup con destino real sigue convirtiendose en pestaña interna.
    expect(popup.action).toBe('deny');
    expect(service.getState().tabs.map((tab) => tab.url)).toContain('https://accounts.example/oauth');
    // Y ya no queda ninguna pestaña vacia de las que dejaba el PiP.
    expect(service.getState().tabs.filter((tab) => tab.url === 'about:blank')).toHaveLength(0);
  });

  it('lleva la vista a pantalla completa y restaura el layout al salir', async () => {
    const service = newService();
    const window = new BrowserWindow();
    service.attachWindow(window);
    await service.open('https://video.example/');
    service.setViewport({ x: 200, y: 120, width: 800, height: 600 });
    const view = browserViewHarness.instances[0];
    const contents = view.webContents;
    view.setBounds.mockClear();

    contents.emit('enter-html-full-screen');

    expect(window.setFullScreen).toHaveBeenCalledWith(true);
    expect(view.setBounds).toHaveBeenCalledWith({ x: 0, y: 0, width: 1024, height: 768 });
    expect(service.getState().isFullscreen).toBe(true);

    view.setBounds.mockClear();
    contents.emit('leave-html-full-screen');

    expect(window.setFullScreen).toHaveBeenCalledWith(false);
    expect(view.setBounds).toHaveBeenCalledWith({ x: 200, y: 120, width: 800, height: 600 });
    expect(service.getState().isFullscreen).toBe(false);
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
