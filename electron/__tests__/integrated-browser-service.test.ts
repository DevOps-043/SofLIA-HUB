import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { BaseWindow, BrowserWindow, WebContentsView, dialog, session, systemPreferences } from 'electron';
import { IntegratedBrowserService } from '../integrated-browser';
import { BrowserSitePermissionStore } from '../integrated-browser/site-permissions';
import {
  configureChromiumUserAgentFallback,
  toStandardChromiumUserAgent,
} from '../integrated-browser/user-agent';
import {
  browserPartitionFor,
  browserScopeIdFor,
  resetBrowserScopeForTests,
} from '../integrated-browser/profile-scope';
import {
  INTEGRATED_BROWSER_COLD_TAB_GRACE_MS,
  INTEGRATED_BROWSER_HIDDEN_WINDOW_GRACE_MS,
} from '../integrated-browser/types';

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
      getURL: ReturnType<typeof vi.fn>;
      getUserAgent: ReturnType<typeof vi.fn>;
      setUserAgent: ReturnType<typeof vi.fn>;
      setBackgroundThrottling: ReturnType<typeof vi.fn>;
      isCurrentlyAudible: ReturnType<typeof vi.fn>;
      isBeingCaptured: ReturnType<typeof vi.fn>;
      isDevToolsOpened: ReturnType<typeof vi.fn>;
      isLoadingMainFrame: ReturnType<typeof vi.fn>;
      isWaitingForResponse: ReturnType<typeof vi.fn>;
      loadURL: ReturnType<typeof vi.fn>;
      setWindowOpenHandler: ReturnType<typeof vi.fn>;
      session: {
        getUserAgent: ReturnType<typeof vi.fn>;
        setUserAgent: ReturnType<typeof vi.fn>;
        setPermissionCheckHandler: ReturnType<typeof vi.fn>;
        setPermissionRequestHandler: ReturnType<typeof vi.fn>;
      };
  };
};

const browserViewHarness = WebContentsView as unknown as {
  instances: MockIntegratedBrowserView[];
};

const browserWindowHarness = BrowserWindow as unknown as {
  instances: BrowserWindow[];
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

/**
 * Cuenta solo las lecturas del DOM. El servicio tambien inyecta piezas propias
 * —vigia de seleccion, menu flotante, panel de redaccion— y contar guiones a
 * secas confundia instalar la interfaz con leer la pagina del usuario.
 */
function domExtractions(contents: { executeJavaScript: { mock: { calls: unknown[][] } } }): number {
  return contents.executeJavaScript.mock.calls
    .filter((call) => String(call[0]).includes('const LIMITS = { text:'))
    .length;
}

type PermissionPromptPayload = { id: string; origin: string; kinds: string[]; labels: string[] };

/**
 * El aviso de permiso lo pinta el renderer, asi que en pruebas se responde
 * interceptando el envio a la ventana anfitriona. `onPrompt` permite observar
 * cuantos avisos coexisten.
 */
function answerPermissionPrompts(
  window: BrowserWindow,
  service: IntegratedBrowserService,
  granted: boolean,
  onPrompt?: (request: PermissionPromptPayload) => Promise<void> | void,
): PermissionPromptPayload[] {
  const seen: PermissionPromptPayload[] = [];
  const send = window.webContents.send as unknown as ReturnType<typeof vi.fn>;
  send.mockImplementation((channel: string, payload: unknown) => {
    if (channel !== 'integrated-browser:permission-prompt') return;
    const request = payload as PermissionPromptPayload;
    seen.push(request);
    void (async () => {
      await onPrompt?.(request);
      service.resolvePermissionPrompt(request.id, granted);
    })();
  });
  return seen;
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
    browserWindowHarness.instances.length = 0;
    detachedWindowHarness.instances.length = 0;
  });

  it('retira producto y Electron estable sin alterar Chromium', () => {
    expect(toStandardChromiumUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
      + '(KHTML, like Gecko) soflia-hub-desktop/0.9.6 Chrome/150.0.7871.224 '
      + 'Electron/43.4.0 Safari/537.36',
    )).toBe(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
      + '(KHTML, like Gecko) Chrome/150.0.7871.224 Safari/537.36',
    );
  });

  it('consume completo el sufijo prerelease de Electron', () => {
    expect(toStandardChromiumUserAgent(
      'Mozilla/5.0 soflia-hub-desktop/0.9.6 Chrome/152.0.7977.30 '
      + 'Electron/44.0.0-beta.3 Safari/537.36',
    )).toBe('Mozilla/5.0 Chrome/152.0.7977.30 Safari/537.36');
  });

  it('configura el fallback antes de que Electron cree contenidos', () => {
    const target = {
      userAgentFallback: 'Mozilla/5.0 soflia-hub-desktop/0.9.6 '
        + 'Chrome/150.0.7871.224 Electron/43.4.0 Safari/537.36',
    };

    expect(configureChromiumUserAgentFallback(target)).toBe(
      'Mozilla/5.0 Chrome/150.0.7871.224 Safari/537.36',
    );
    expect(target.userAgentFallback).toBe(
      'Mozilla/5.0 Chrome/150.0.7871.224 Safari/537.36',
    );
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
      partition: browserPartitionFor(browserScopeIdFor(null)),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: true,
    });
    // El User-Agent queda identico al de un Chromium de escritorio: sin el
    // nombre de la aplicacion ni la ficha `Electron/`, que lo convertian en un
    // cliente desconocido frente a lo que anuncia `Sec-CH-UA`.
    expect(view.webContents.setUserAgent).toHaveBeenCalledWith(
      'Mozilla/5.0 (KHTML, like Gecko) Chrome/152.0.7977.30 Safari/537.36',
    );
    // Los workers y ciertos subframes cruzados toman el UA de Session. El HAR
    // de Meet mostro que normalizar solo WebContents dejaba 137 solicitudes
    // anunciando Electron y el flujo no alcanzaba CreateMeetingDevice.
    expect(view.webContents.session.setUserAgent).toHaveBeenCalledWith(
      'Mozilla/5.0 (KHTML, like Gecko) Chrome/152.0.7977.30 Safari/537.36',
    );
    expect(window.contentView.addChildView).toHaveBeenCalledTimes(1);
  });

  it('normaliza tambien el User-Agent de las ventanas reales que abre un sitio', async () => {
    const window = new BrowserWindow();
    const service = new IntegratedBrowserService();
    service.attachWindow(window);
    await service.open('https://mail.google.com');

    const popup = new BrowserWindow();
    browserViewHarness.instances[0].webContents.emit('did-create-window', popup);

    // Google Meet abre su ventana de llamada desde Gmail por esta via. La
    // ventana no hereda el User-Agent de quien la abrio, asi que sin esto era
    // la unica superficie que seguia anunciando `soflia-hub-desktop/x.y.z` y
    // `Electron/x.y.z`.
    expect(popup.webContents.setUserAgent).toHaveBeenCalledWith(
      'Mozilla/5.0 (KHTML, like Gecko) Chrome/152.0.7977.30 Safari/537.36',
    );
    expect(popup.webContents.session.setUserAgent).toHaveBeenCalledWith(
      'Mozilla/5.0 (KHTML, like Gecko) Chrome/152.0.7977.30 Safari/537.36',
    );
  });

  it('aisla la sesion de navegacion por usuario y derriba las pestañas al cambiar de cuenta', async () => {
    const window = new BrowserWindow();
    const service = newService();
    service.attachWindow(window);

    await service.applyUserScope('usuario-a');
    await service.open('https://example.com');
    const primeraParticion = browserViewHarness.instances[0].options?.webPreferences?.partition;
    expect(primeraParticion).toBe(browserPartitionFor(browserScopeIdFor('usuario-a')));
    expect(service.getState().tabs).toHaveLength(1);

    // Cambio de cuenta: no queda ninguna pestaña del usuario anterior viva y la
    // siguiente vista nace en otra particion.
    await service.applyUserScope('usuario-b');
    expect(service.getState().tabs).toHaveLength(0);
    expect(browserViewHarness.instances[0].webContents.close).toHaveBeenCalled();

    await service.open('https://example.com');
    const nuevaVista = browserViewHarness.instances[browserViewHarness.instances.length - 1];
    const segundaParticion = nuevaVista.options?.webPreferences?.partition;
    expect(segundaParticion).toBe(browserPartitionFor(browserScopeIdFor('usuario-b')));
    expect(segundaParticion).not.toBe(primeraParticion);

    service.detachWindow();
  });

  it('vacia la sesion sin usuario al cerrar sesion', async () => {
    const window = new BrowserWindow();
    const service = newService();
    service.attachWindow(window);

    await service.applyUserScope('usuario-a');
    await service.open('https://example.com');
    await service.applyUserScope(null);

    const anonima = vi.mocked(session.fromPartition).mock.results
      .map((result) => result.value as { clearStorageData?: ReturnType<typeof vi.fn> })
      .find((value) => Boolean(value?.clearStorageData));
    expect(anonima?.clearStorageData).toHaveBeenCalled();
    expect(service.getState().tabs).toHaveLength(0);

    service.detachWindow();
  });

  afterEach(async () => {
    vi.useRealTimers();
    resetBrowserScopeForTests();
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
    // Lo que no debe ocurrir sin peticion es leer el DOM. Instalar el vigia de
    // seleccion, el menu flotante o el panel de redaccion no lee la pagina.
    expect(domExtractions(contents)).toBe(0);
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
    expect(domExtractions(contents)).toBe(1);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(contents.capturePage).toHaveBeenCalledTimes(1);
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

  it('BR-SEL-005: el menú flotante adjunta la acción con su instrucción y abre el lector', async () => {
    vi.useFakeTimers();
    const parent = new BrowserWindow();
    const service = new IntegratedBrowserService();
    service.attachWindow(parent);
    await service.open('https://mail.google.com/chat');
    service.setViewport({ x: 0, y: 0, width: 1280, height: 720 });
    const contents = browserViewHarness.instances[0].webContents;
    const enviar = parent.webContents.send as unknown as ReturnType<typeof vi.fn>;
    const avisos = (canal: string) => enviar.mock.calls.filter((call: unknown[]) => call[0] === canal);
    enviar.mockClear();
    contents.executeJavaScript.mockResolvedValue('CONCEPTO 3.2');

    contents.emit('console-message', { message: '__SOFLIA_SELECTION_MENU__:translate' });
    await vi.advanceTimersByTimeAsync(500);

    const seleccion = avisos('integrated-browser:selection-action');
    expect(seleccion).toHaveLength(1);
    expect(seleccion[0][1]).toMatchObject({ action: 'translate', text: 'CONCEPTO 3.2' });
    expect((seleccion[0][1] as { instruction: string }).instruction).toContain('Traduce');

    // La lectura no adjunta texto al chat: abre el panel del modo lectura.
    contents.emit('console-message', { message: '__SOFLIA_SELECTION_MENU__:read' });
    await vi.advanceTimersByTimeAsync(500);
    expect(avisos('integrated-browser:selection-action')).toHaveLength(1);
    expect(avisos('integrated-browser:reading-mode-requested')).toHaveLength(1);
    expect(avisos('integrated-browser:reading-mode-requested')[0][1]).toMatchObject({ selection: 'CONCEPTO 3.2' });

    service.detachWindow();
    vi.useRealTimers();
  });

  it('BR-SEL-006: la página no puede inventar acciones ni actuar durante el control del agente', async () => {
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
    contents.executeJavaScript.mockResolvedValue('CONCEPTO 3.2');

    contents.emit('console-message', { message: '__SOFLIA_SELECTION_MENU__:borrar-todo' });
    await vi.advanceTimersByTimeAsync(500);
    expect(avisos()).toHaveLength(0);

    await service.openForAgent();
    enviar.mockClear();
    contents.emit('console-message', { message: '__SOFLIA_SELECTION_MENU__:summarize' });
    await vi.advanceTimersByTimeAsync(500);
    expect(avisos()).toHaveLength(0);

    service.detachWindow();
    vi.useRealTimers();
  });

  it('BR-SEL-007: la petición del panel de redacción sube al renderer y su respuesta baja a la página', async () => {
    vi.useFakeTimers();
    const parent = new BrowserWindow();
    const service = new IntegratedBrowserService();
    service.attachWindow(parent);
    await service.open('https://mail.google.com/chat');
    service.setViewport({ x: 0, y: 0, width: 1280, height: 720 });
    const contents = browserViewHarness.instances[0].webContents;
    const enviar = parent.webContents.send as unknown as ReturnType<typeof vi.fn>;
    enviar.mockClear();
    contents.executeJavaScript.mockResolvedValue({ requestId: 'w1a2b3c4d5', prompt: 'mas formal', text: 'hola q tal' });

    contents.emit('console-message', { message: '__SOFLIA_WRITING__' });
    await vi.advanceTimersByTimeAsync(100);

    const peticiones = enviar.mock.calls.filter((call: unknown[]) => call[0] === 'integrated-browser:writing-request');
    expect(peticiones).toHaveLength(1);
    expect(peticiones[0][1]).toMatchObject({
      requestId: 'w1a2b3c4d5',
      prompt: 'mas formal',
      text: 'hola q tal',
      url: 'https://mail.google.com/chat',
    });
    // El texto del usuario nunca viaja por la consola: el aviso solo avisa.
    expect(enviar.mock.calls.filter((call: unknown[]) => call[0] === 'integrated-browser:selection-action')).toHaveLength(0);

    contents.executeJavaScript.mockClear();
    contents.executeJavaScript.mockResolvedValue(true);
    await expect(service.resolveWritingRequest({ requestId: 'w1a2b3c4d5', text: 'Hola, ¿qué tal?' })).resolves.toEqual({ delivered: true });
    expect(String(contents.executeJavaScript.mock.calls[0][0])).toContain('w1a2b3c4d5');

    service.detachWindow();
    vi.useRealTimers();
  });

  it('BR-SEL-008: el panel de redacción no actúa mientras el agente conduce', async () => {
    vi.useFakeTimers();
    const parent = new BrowserWindow();
    const service = new IntegratedBrowserService();
    service.attachWindow(parent);
    await service.open('https://mail.google.com/chat');
    service.setViewport({ x: 0, y: 0, width: 1280, height: 720 });
    const contents = browserViewHarness.instances[0].webContents;
    const enviar = parent.webContents.send as unknown as ReturnType<typeof vi.fn>;
    await service.openForAgent();
    enviar.mockClear();
    contents.executeJavaScript.mockResolvedValue({ requestId: 'w1a2b3c4d5', prompt: '', text: 'hola' });

    contents.emit('console-message', { message: '__SOFLIA_WRITING__' });
    await vi.advanceTimersByTimeAsync(100);

    expect(enviar.mock.calls.filter((call: unknown[]) => call[0] === 'integrated-browser:writing-request')).toHaveLength(0);

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
    expect(domExtractions(contents)).toBe(1);
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

    // Instalar el vigia de seleccion al cargar, o apagar el menu flotante al
    // tomar el control, no es interactuar con la pagina: son piezas propias.
    browserViewHarness.instances[0].webContents.executeJavaScript.mockClear();
    service.setViewport({ x: 0, y: 0, width: 800, height: 600 });
    await service.openForAgent();
    await expect(service.clickElement('dom-1')).rejects.toThrow(/controlado por otra tarea/i);
    const guiones = browserViewHarness.instances[0].webContents.executeJavaScript.mock.calls.map((call: unknown[]) => String(call[0]));
    expect(guiones.every((guion: string) => /SelectionMenu|WritingPanel|sofliaSelWatch/.test(guion))).toBe(true);
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

  it('prioriza solo las superficies visibles y abarata las pestañas ocultas', async () => {
    const window = new BrowserWindow();
    const service = new IntegratedBrowserService();
    service.attachWindow(window);
    await service.open('https://primaria.example');
    service.setViewport({ x: 0, y: 0, width: 1_200, height: 800 });
    const first = browserViewHarness.instances[0];
    const firstId = service.getState().activeTabId!;
    await service.createTab('https://secundaria.example', false);
    const second = browserViewHarness.instances[1];
    const secondId = service.getState().tabs[1].id;
    await service.createTab('https://tercera.example', false);
    const third = browserViewHarness.instances[2];

    expect(first.webContents.setBackgroundThrottling).toHaveBeenLastCalledWith(false);
    expect(second.webContents.setBackgroundThrottling).toHaveBeenLastCalledWith(true);
    expect(third.webContents.setBackgroundThrottling).toHaveBeenLastCalledWith(true);

    await service.setViewMode('split', secondId);
    expect(first.webContents.setBackgroundThrottling).toHaveBeenLastCalledWith(false);
    expect(second.webContents.setBackgroundThrottling).toHaveBeenLastCalledWith(false);
    expect(service.getState()).toMatchObject({ primaryTabId: firstId, secondaryTabId: secondId });

    service.hide();
    expect(first.webContents.setBackgroundThrottling).toHaveBeenLastCalledWith(true);
    expect(second.webContents.setBackgroundThrottling).toHaveBeenLastCalledWith(true);
    service.detachWindow();
  });

  it('suspende una pestaña fría, protege audio y restaura la misma identidad', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-13T18:00:00.000Z'));
    const service = new IntegratedBrowserService();
    service.attachWindow(new BrowserWindow());
    await service.open('https://primaria.example');
    service.setViewport({ x: 0, y: 0, width: 1_200, height: 800 });

    await vi.advanceTimersByTimeAsync(10);
    await service.createTab('https://audio.example', false);
    const audioId = service.getState().tabs[1].id;
    const audioView = browserViewHarness.instances[1];
    audioView.webContents.isCurrentlyAudible.mockReturnValue(true);

    await vi.advanceTimersByTimeAsync(10);
    await service.createTab('https://reciente.example', false);
    const recentId = service.getState().tabs[2].id;

    await vi.advanceTimersByTimeAsync(INTEGRATED_BROWSER_COLD_TAB_GRACE_MS);
    expect(service.getState().tabs.find((tab) => tab.id === audioId)?.isSuspended).toBe(false);
    expect(service.getState().tabs.find((tab) => tab.id === recentId)?.isSuspended).toBe(false);

    audioView.webContents.isCurrentlyAudible.mockReturnValue(false);
    audioView.webContents.emit('audio-state-changed', {}, { audible: false });
    expect(service.getState().tabs.find((tab) => tab.id === audioId)?.isSuspended).toBe(true);
    expect(audioView.webContents.close).toHaveBeenCalled();

    service.activateTab(audioId);
    const restored = browserViewHarness.instances[browserViewHarness.instances.length - 1];
    expect(service.getState().tabs.find((tab) => tab.id === audioId)?.isSuspended).toBe(false);
    expect(restored.webContents.loadURL).toHaveBeenCalledWith('https://audio.example/');
    expect(service.getState().activeTabId).toBe(audioId);
    service.detachWindow();
  });

  it('reduce el margen de pestañas frías cuando la ventana anfitriona queda oculta', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-13T18:00:00.000Z'));
    const window = new BrowserWindow();
    const service = new IntegratedBrowserService();
    service.attachWindow(window);
    await service.open('https://primaria.example');
    service.setViewport({ x: 0, y: 0, width: 1_200, height: 800 });
    await vi.advanceTimersByTimeAsync(10);
    await service.createTab('https://fria.example', false);
    const coldId = service.getState().tabs[1].id;
    await vi.advanceTimersByTimeAsync(10);
    await service.createTab('https://respaldo.example', false);

    vi.mocked(window.isVisible).mockReturnValue(false);
    window.emit('hide');
    await vi.advanceTimersByTimeAsync(INTEGRATED_BROWSER_HIDDEN_WINDOW_GRACE_MS);

    expect(service.getState().tabs.find((tab) => tab.id === coldId)?.isSuspended).toBe(true);
    expect(service.getState().tabs.filter((tab) => !tab.isSuspended)).toHaveLength(1);
    service.detachWindow();
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

    // La verificacion en dos pasos redirige a direcciones de varios kilobytes:
    // acotarlas como si fueran entrada del usuario dejaba el login a medias.
    const preventAutenticacion = vi.fn();
    contents.emit('will-redirect', {
      url: `https://accounts.google.com/CheckCookie?TL=${'A'.repeat(3_000)}`,
      isMainFrame: true,
      preventDefault: preventAutenticacion,
    });
    expect(preventAutenticacion).not.toHaveBeenCalled();
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
    const service = newService();
    const window = new BrowserWindow();
    service.attachWindow(window);
    const avisos = answerPermissionPrompts(window, service, true);
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
    // El aviso lo pinta el renderer, no un cuadro del sistema.
    expect(dialog.showMessageBox).not.toHaveBeenCalled();
    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toMatchObject({
      origin: 'https://example.com',
      kinds: ['microphone'],
      labels: ['Micrófono'],
    });
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

  it('no bloquea la consulta de media sin dispositivo ni la que llega sin origen', async () => {
    const store = newStore();
    const service = newService(store);
    service.attachWindow(new BrowserWindow());
    await service.open('https://meet.google.com/');
    const contents = browserViewHarness.instances[0].webContents;
    const check = contents.session.setPermissionCheckHandler.mock.calls[0][0];
    contents.getURL.mockReturnValue('https://meet.google.com/call');

    // Chromium consulta `media` sin decir que dispositivo desde los marcos
    // embebidos. Responder que no dejaba a Meet leyendo camara y microfono como
    // bloqueados y abortando el arranque con StartupCode 219 al iniciar la
    // llamada desde Gmail.
    expect(check(contents, 'media', 'https://meet.google.com', {})).toBe(true);
    // Y a veces ni siquiera manda el origen: el del webContents es el respaldo.
    expect(check(contents, 'media', '', { mediaType: 'audio' })).toBe(true);

    // Electron entrega `webContents = null` para un iframe de origen cruzado.
    // Meet vive bajo mail.google.com con este formato: la identidad se valida
    // mediante los orígenes que Electron aporta, no mediante una instancia que
    // deliberadamente no está disponible.
    expect(check(null, 'media', '', {
      embeddingOrigin: 'https://mail.google.com',
      securityOrigin: 'https://meet.google.com',
      isMainFrame: false,
      mediaType: 'audio',
    })).toBe(true);
    expect(check(null, 'background-sync', 'https://meet.google.com', {
      embeddingOrigin: 'https://mail.google.com',
      isMainFrame: false,
    })).toBe(true);
    // Electron 43 también entrega el preflight de Meet sin webContents ni
    // ninguno de los orígenes opcionales. La sesión ya está aislada y este
    // `true` solo permite llegar a la solicitud real gobernada.
    expect(check(null, 'media', '', {
      isMainFrame: false,
      mediaType: 'audio',
    })).toBe(true);
    expect(check(null, 'media', '', {})).toBe(true);
    expect(check(null, 'media', '', undefined)).toBe(true);
    // Electron 43.3 puede entregar `undefined` aunque el contrato tipado documente
    // la identidad ausente como `null`; ambos valores representan el mismo preflight.
    expect(check(undefined as never, 'media', '', {
      isMainFrame: false,
      mediaType: 'audio',
    })).toBe(true);
    // Si sí existe un origen explícito inválido, el respaldo anónimo no aplica.
    expect(check(null, 'media', 'devtools://devtools', {
      isMainFrame: false,
      mediaType: 'audio',
    })).toBe(false);
    expect(check(null, 'media', '', {
      securityOrigin: 'devtools://devtools',
      isMainFrame: false,
      mediaType: 'audio',
    })).toBe(false);
    expect(check(undefined as never, 'media', '', {
      requestingOrigin: 'devtools://devtools',
      isMainFrame: false,
      mediaType: 'audio',
    })).toBe(false);
    expect(check(null, 'background-sync', 'https://meet.google.com', {
      embeddingOrigin: 'devtools://devtools',
      isMainFrame: false,
    })).toBe(false);

    // Una ventana abierta por Gmail nace en `about:blank` y puede consultar
    // media antes de comprometer la URL de Meet. Esto solo habilita que haga la
    // solicitud real; el request handler sigue exigiendo origen y aprobacion.
    contents.getURL.mockReturnValue('about:blank');
    expect(check(contents, 'media', '', { mediaType: 'audio' })).toBe(true);

    // Lo que el usuario denego sigue denegado por ambas vias.
    await store.set('https://meet.google.com', 'microphone', 'denied');
    await store.set('https://meet.google.com', 'camera', 'denied');
    await store.warmUp();
    expect(check(contents, 'media', 'https://meet.google.com', {})).toBe(false);
    contents.getURL.mockReturnValue('https://meet.google.com/call');
    expect(check(contents, 'media', '', { mediaType: 'audio' })).toBe(false);
    expect(check(null, 'media', '', {
      embeddingOrigin: 'https://mail.google.com',
      securityOrigin: 'https://meet.google.com',
      isMainFrame: false,
      mediaType: 'audio',
    })).toBe(false);
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
    const service = newService();
    const window = new BrowserWindow();
    service.attachWindow(window);
    answerPermissionPrompts(window, service, true);
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

  it('gobierna la ventana que abre otra ventana real y le hereda el origen del abridor', async () => {
    // La ventana flotante de la llamada abre a su vez sus propias ventanas.
    // Solo las pestañas tenian politica de apertura, asi que esas nietas nacian
    // fuera del navegador: la gobernanza las veia como contenido ajeno y les
    // negaba `media` sin origen con el que decidir. Es el
    // "(contenido ajeno al navegador): (sin origen) media" del registro.
    const service = newService();
    const window = new BrowserWindow();
    service.attachWindow(window);
    await service.open('https://mail.google.com/');
    const contents = browserViewHarness.instances[0].webContents;

    const abrir = (handler: (details: unknown) => { createWindow: (options: unknown) => unknown }) => (
      handler({ url: 'about:blank', disposition: 'new-window', features: '' })
    );
    const popupResponse = abrir(contents.setWindowOpenHandler.mock.calls[0][0]);
    const popupContents = popupResponse.createWindow({ webPreferences: {} }) as { setWindowOpenHandler: ReturnType<typeof vi.fn> };

    // La ventana flotante ya tiene politica propia: lo que abra queda dentro.
    expect(popupContents.setWindowOpenHandler).toHaveBeenCalled();
    expect(popupContents.setWindowOpenHandler.mock.calls[0][0]({
      url: 'https://meet.google.com/call?authuser=0',
      disposition: 'new-window',
      features: '',
    })).toEqual({ action: 'deny' });
    expect(service.getState().tabs).toHaveLength(1);
    const nietaResponse = abrir(popupContents.setWindowOpenHandler.mock.calls[0][0]);
    const nietaContents = nietaResponse.createWindow({ webPreferences: {} });

    const check = contents.session.setPermissionCheckHandler.mock.calls[0][0];
    // Hereda el origen del abridor original, que es contra quien un navegador
    // decide los permisos de un documento `about:blank`.
    expect(service.governedOriginFor(nietaContents as never)).toBe('https://mail.google.com');
    expect(check(nietaContents, 'media', '', { mediaType: 'audio' })).toBe(true);
  });

  it('gobierna camara y microfono antes de entregar la ventana real a Chromium', async () => {
    // Google Meet abre su ventana de llamada desde Gmail con `window.open`
    // sin destino. Esa ventana comparte la particion pero no es una pestaña,
    // asi que la gobernanza la trataba como contenido ajeno y le negaba camara
    // y microfono sin preguntar: la llamada nunca llegaba a arrancar.
    const service = newService();
    const window = new BrowserWindow();
    service.attachWindow(window);
    answerPermissionPrompts(window, service, true);
    await service.open('https://mail.google.com/');
    const contents = browserViewHarness.instances[0].webContents;
    const openHandler = contents.setWindowOpenHandler.mock.calls[0][0];
    const popupResponse = openHandler({
      url: 'about:blank',
      disposition: 'new-window',
      features: 'width=900,height=700',
    });
    // `createWindow` sustituye a la creacion automatica de Electron, por lo
    // que `did-create-window` no se emite. La ventana debe quedar adoptada
    // sincronamente antes de devolver el webContents a Chromium.
    const popupContents = popupResponse.createWindow({ webPreferences: {} });

    const request = contents.session.setPermissionRequestHandler.mock.calls[0][0];
    const check = contents.session.setPermissionCheckHandler.mock.calls[0][0];
    const mediaCallback = vi.fn();

    // La ventana hija todavia esta en `about:blank`: esta consulta provisional
    // debe dejar que el flujo alcance la solicitud real con origen.
    expect(check(popupContents, 'media', '', { mediaType: 'audio' })).toBe(true);
    const withoutOrigin = vi.fn();
    request(popupContents, 'media', withoutOrigin, { mediaTypes: ['audio'] });
    await vi.waitFor(() => expect(withoutOrigin).toHaveBeenCalledWith(false));

    request(popupContents, 'media', mediaCallback, {
      securityOrigin: 'https://meet.google.com',
      mediaTypes: ['audio', 'video'],
    });
    await vi.waitFor(() => expect(mediaCallback).toHaveBeenCalledWith(true));

    expect(check(popupContents, 'media', 'https://meet.google.com', { mediaType: 'audio' })).toBe(true);
    expect(check(popupContents, 'media', 'https://meet.google.com', { mediaType: 'video' })).toBe(true);

    // Adoptar la ventana concreta no convierte toda la sesion en contenido de
    // confianza. Una ventana no registrada sigue fallando de forma cerrada.
    const foreignContents = new BrowserWindow().webContents;
    const foreignCallback = vi.fn();
    expect(check(foreignContents, 'media', 'https://meet.google.com', { mediaType: 'audio' })).toBe(false);
    request(foreignContents, 'media', foreignCallback, {
      securityOrigin: 'https://meet.google.com',
      mediaTypes: ['audio'],
    });
    await vi.waitFor(() => expect(foreignCallback).toHaveBeenCalledWith(false));
  });

  it('muestra un aviso a la vez y no repite lo ya concedido', async () => {
    // Una videollamada pide camara y microfono desde varios marcos a la vez.
    // Con los avisos superpuestos el usuario no podia responder y la solicitud
    // quedaba colgada, dejando la llamada sin arrancar.
    let abiertos = 0;
    let maximoSimultaneo = 0;
    const service = newService();
    const window = new BrowserWindow();
    service.attachWindow(window);
    const avisos = answerPermissionPrompts(window, service, true, async () => {
      abiertos += 1;
      maximoSimultaneo = Math.max(maximoSimultaneo, abiertos);
      await new Promise((resolve) => setImmediate(resolve));
      abiertos -= 1;
    });
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
    // Camara y microfono se preguntan juntos, y la segunda solicitud encuentra
    // la camara ya concedida: un solo aviso para todo.
    expect(avisos).toHaveLength(1);
    expect(avisos[0].kinds).toEqual(['microphone', 'camera']);
  });

  it('responde que no cuando el aviso de permiso no se puede mostrar', async () => {
    const service = newService();
    const window = new BrowserWindow();
    service.attachWindow(window);
    await service.open('https://example.com');
    // Sin ventana donde pintar el aviso no hay a quien preguntar.
    vi.mocked(window.isDestroyed).mockReturnValue(true);
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

    for (const permission of ['fullscreen', 'pointerLock', 'keyboardLock', 'mediaKeySystem', 'speaker-selection', 'background-sync', 'clipboard-sanitized-write', 'storage-access', 'midi', 'openExternal']) {
      const callback = vi.fn();
      responses.set(permission, callback);
      request(contents, permission, callback, { securityOrigin: 'https://example.com' });
    }
    await flushPermissionQueue();

    for (const permission of ['fullscreen', 'pointerLock', 'keyboardLock', 'mediaKeySystem', 'speaker-selection', 'background-sync', 'clipboard-sanitized-write', 'storage-access']) {
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
    expect(pip.createWindow).toEqual(expect.any(Function));
    const pipContents = pip.createWindow({ webPreferences: { partition: browserPartitionFor() } });
    // Las opciones que Electron entrega al creador conservan la sesion y la
    // relacion con `window.opener`; main adopta la ventana antes de retornarla.
    expect(pipContents.setUserAgent).toHaveBeenCalledWith(
      'Mozilla/5.0 (KHTML, like Gecko) Chrome/152.0.7977.30 Safari/537.36',
    );
    // El popup con destino real sigue convirtiendose en pestaña interna.
    expect(popup.action).toBe('deny');
    expect(service.getState().tabs.map((tab) => tab.url)).toContain('https://accounts.example/oauth');
    // Y ya no queda ninguna pestaña vacia de las que dejaba el PiP.
    expect(service.getState().tabs.filter((tab) => tab.url === 'about:blank')).toHaveLength(0);
  });

  it('bloquea la llamada directa de Google Chat sin crear pestañas ni ventanas', async () => {
    const service = newService();
    service.attachWindow(new BrowserWindow());
    const sourceUrl = 'https://mail.google.com/mail/u/0/#chat/dm/1dV7USAAAAE';
    await service.open(sourceUrl);
    const contents = browserViewHarness.instances[0].webContents;
    const openHandler = contents.setWindowOpenHandler.mock.calls[0][0];
    const directCallUrl = 'https://meet.google.com/call?authuser=0&hl=es-419&iilm=1786577388646';
    const response = openHandler({
      url: directCallUrl,
      disposition: 'new-window',
      features: 'width=420,height=260',
    });

    expect(response).toEqual({ action: 'deny' });
    expect(service.getState().tabs.map((tab) => tab.url)).toEqual([sourceUrl]);
    expect(service.getState().url).toBe(sourceUrl);
    expect(service.getState().tabs.some((tab) => tab.url === 'https://meet.google.com/new')).toBe(false);
    expect(detachedWindowHarness.instances).toHaveLength(0);
  });

  it('bloquea /call desde navegación y redirección de subframe sin crear una reunión', async () => {
    const service = newService();
    service.attachWindow(new BrowserWindow());
    await service.open('https://mail.google.com/mail/u/0/#chat/dm/1dV7USAAAAE');
    const contents = browserViewHarness.instances[0].webContents;
    const frameNavigation = {
      url: 'https://meet.google.com/call?authuser=0',
      isMainFrame: false,
      preventDefault: vi.fn(),
    };
    const redirect = {
      url: 'https://meet.google.com/call?authuser=0',
      isMainFrame: false,
      preventDefault: vi.fn(),
    };

    contents.emit('will-frame-navigate', frameNavigation);
    contents.emit('will-redirect', redirect);

    expect(frameNavigation.preventDefault).toHaveBeenCalledOnce();
    expect(redirect.preventDefault).toHaveBeenCalledOnce();
    expect(service.getState().tabs).toHaveLength(1);
    expect(service.getState().url).toContain('mail.google.com');
    expect(service.getState().tabs.some((tab) => tab.url === 'https://meet.google.com/new')).toBe(false);
  });

  it('cancela about:blank -> /call sin crear pestaña y mantiene bloqueados protocolos externos', async () => {
    const service = newService();
    service.attachWindow(new BrowserWindow());
    await service.open('https://mail.google.com/mail/u/0/#chat/dm/1dV7USAAAAE');
    const source = browserViewHarness.instances[0].webContents;
    const openHandler = source.setWindowOpenHandler.mock.calls[0][0];
    const response = openHandler({ url: 'about:blank', disposition: 'new-window', features: '' });
    const popupContents = response.createWindow({ webPreferences: {} });
    const popupWindow = browserWindowHarness.instances[browserWindowHarness.instances.length - 1];
    const popupOn = popupContents.on as ReturnType<typeof vi.fn>;
    const navigate = popupOn.mock.calls.find(([eventName]) => eventName === 'will-navigate')?.[1] as
      ((event: { url: string; preventDefault: ReturnType<typeof vi.fn> }) => void);
    const directCall = { url: 'https://meet.google.com/call?authuser=0', preventDefault: vi.fn() };
    const externalProtocol = { url: 'file:///C:/Windows/System32', preventDefault: vi.fn() };

    navigate(directCall);
    navigate(externalProtocol);

    expect(directCall.preventDefault).toHaveBeenCalledOnce();
    expect(popupWindow.close).toHaveBeenCalledOnce();
    expect(externalProtocol.preventDefault).toHaveBeenCalledOnce();
    expect(service.getState().tabs).toHaveLength(1);
    expect(service.getState().url).toContain('mail.google.com');
    expect((popupContents.on as ReturnType<typeof vi.fn>).mock.calls.some(([name]) => name === 'will-frame-navigate')).toBe(true);
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
