import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserWindow, ipcMain } from 'electron';
import { registerIntegratedBrowserHandlers } from '../integrated-browser-handlers';
import type { IntegratedBrowserService } from '../integrated-browser';

type TestHandler = (event: { sender: { id: number } }, input?: unknown) => Promise<{
  success: boolean;
  error?: string;
  state?: unknown;
}>;

const ipcMainHarness = ipcMain as unknown as {
  _clearHandlers: () => void;
  _getHandler: (channel: string) => TestHandler;
  _getHandlers: () => Map<string, TestHandler>;
};

describe('handlers del navegador integrado', () => {
  const service = {
    getState: vi.fn(() => ({ url: 'about:blank' })),
    captureVisiblePage: vi.fn(async () => 'data:image/png;base64,captura'),
    captureVisibleBackdrop: vi.fn(async () => ({
      screenshot: 'data:image/png;base64,captura',
      bounds: { x: 12, y: 34, width: 800, height: 600 },
    })),
    getObservation: vi.fn(async () => ({ observation: null, observationStatus: { enabled: true } })),
    setObservationEnabled: vi.fn(async (enabled: boolean) => ({ observation: null, observationStatus: { enabled } })),
    open: vi.fn(async () => ({ url: 'https://example.com' })),
    navigate: vi.fn(async () => ({ url: 'https://example.com' })),
    createTab: vi.fn(async () => ({ url: 'https://www.google.com/' })),
    closeTab: vi.fn(() => ({ url: 'https://example.com' })),
    activateTab: vi.fn(() => ({ url: 'https://example.com' })),
    detachTab: vi.fn(() => ({ url: 'https://example.com', detached: true })),
    reattachTab: vi.fn(() => ({ url: 'https://example.com', detached: false })),
    setViewMode: vi.fn(async () => ({ viewMode: 'split' })),
    goBack: vi.fn(), goForward: vi.fn(), reload: vi.fn(), stop: vi.fn(), focus: vi.fn(),
    setViewport: vi.fn(() => ({ isVisible: true })), hide: vi.fn(),
    readActiveDocument: vi.fn(async () => ({ tabId: 'tab-1', url: 'https://docs.google.com/document/d/1/edit', title: 'Documento', language: 'es', text: 'Contenido documental', truncated: false })),
    listHistory: vi.fn(async () => []), clearHistory: vi.fn(async () => true),
    clearBrowsingData: vi.fn(async (input: unknown) => {
      const { categories, range } = (input ?? {}) as { categories?: string[]; range?: string };
      if (!Array.isArray(categories) || categories.length === 0) throw new Error('Elige al menos un tipo de dato para borrar.');
      return { range, results: categories.map((category) => ({ category, cleared: true, ignoredRange: false })) };
    }),
    listCredentials: vi.fn(async () => []), saveCredential: vi.fn(async () => ({ id: 'credencial-id' })),
    fillCredential: vi.fn(async () => ({ id: 'credencial-id' })), removeCredential: vi.fn(async () => true),
    listExtensions: vi.fn(async () => []), prepareExtensionInstall: vi.fn(async () => ({ canceled: true })),
    confirmExtensionInstall: vi.fn(async () => ({ installId: 'extension-id' })),
    setExtensionEnabled: vi.fn(async () => ({ installId: 'extension-id' })), removeExtension: vi.fn(async () => true),
    prepareReadingMode: vi.fn(async () => ({ readingId: 'reading-id', text: 'Contenido legible' })),
    synthesizeReadingSegment: vi.fn(async () => ({ readingId: 'reading-id', timings: [] })),
    highlightReadingRange: vi.fn(async () => ({ highlighted: true })),
    waitForReadingToolbarAction: vi.fn(async () => ({ readingId: 'reading-id', action: 'toggle' as const })),
    syncReadingToolbar: vi.fn(async () => ({ toolbarVisible: true })),
    cancelReadingSpeech: vi.fn(() => ({ canceled: 1 })),
    closeReadingMode: vi.fn(async () => ({ closed: true })),
    resolvePermissionPrompt: vi.fn(() => true),
  };
  let window: BrowserWindow;

  beforeEach(() => {
    vi.clearAllMocks();
    ipcMainHarness._clearHandlers();
    window = new BrowserWindow();
    registerIntegratedBrowserHandlers(service as unknown as IntegratedBrowserService, () => window);
  });

  it('registra el contrato completo y enruta payloads validos', async () => {
    const handlers = ipcMainHarness._getHandlers();
    expect(Array.from(handlers.keys()).filter((key: unknown) => String(key).startsWith('integrated-browser:'))).toHaveLength(53);
    expect(handlers.has('integrated-browser:clear-browsing-data')).toBe(true);
    expect(handlers.has('integrated-browser:writing-resolve')).toBe(true);
    expect(handlers.has('integrated-browser:reading-download')).toBe(false);
    expect(handlers.has('integrated-browser:permission-decide')).toBe(true);
    expect(handlers.has('integrated-browser:tab-summaries')).toBe(true);
    expect(handlers.has('integrated-browser:get-tab-content')).toBe(true);
    expect(handlers.has('integrated-browser:document-read')).toBe(true);
    expect(await handlers.get('integrated-browser:document-read')!({ sender: window.webContents }))
      .toMatchObject({ success: true, document: { tabId: 'tab-1', text: 'Contenido documental' } });
    const captureHandler = handlers.get('integrated-browser:capture-visible');
    expect(await captureHandler!({ sender: window.webContents })).toMatchObject({
      success: true,
      screenshot: 'data:image/png;base64,captura',
      // El renderer necesita el rectangulo real para no estirar el respaldo.
      captureBounds: { x: 12, y: 34, width: 800, height: 600 },
      state: { url: 'about:blank' },
    });
    const navigateHandler = handlers.get('integrated-browser:navigate');
    expect(navigateHandler).toBeDefined();
    const result = await navigateHandler!(
      { sender: window.webContents },
      { target: 'example.com' },
    );
    expect(result.success).toBe(true);
    expect(service.navigate).toHaveBeenCalledWith('example.com');

    const observationHandler = handlers.get('integrated-browser:get-observation');
    expect(await observationHandler!({ sender: window.webContents }, { forceFresh: true }))
      .toMatchObject({ success: true, observationStatus: { enabled: true } });
    expect(service.getObservation).toHaveBeenCalledWith(true);

    const perceptionHandler = handlers.get('integrated-browser:set-observation-enabled');
    expect(await perceptionHandler!({ sender: window.webContents }, { enabled: false }))
      .toMatchObject({ success: true, observationStatus: { enabled: false } });
    expect(service.setObservationEnabled).toHaveBeenCalledWith(false);

    const viewModeHandler = handlers.get('integrated-browser:view-mode');
    expect(await viewModeHandler!({ sender: window.webContents }, { mode: 'split', secondaryTabId: 'tab-2' }))
      .toMatchObject({ success: true, state: { viewMode: 'split' } });
    expect(service.setViewMode).toHaveBeenCalledWith('split', 'tab-2');

    const detachHandler = handlers.get('integrated-browser:tab-detach');
    expect(await detachHandler!({ sender: window.webContents }, { tabId: 'tab-1' }))
      .toMatchObject({ success: true, state: { detached: true } });
    expect(service.detachTab).toHaveBeenCalledWith('tab-1');

    const clearDataHandler = handlers.get('integrated-browser:clear-browsing-data');
    expect(await clearDataHandler!({ sender: window.webContents }, { categories: ['cookies'], range: 'todo' }))
      .toMatchObject({ success: true, summary: { range: 'todo', results: [{ category: 'cookies', cleared: true }] } });
    // Un payload sin categorias no borra nada y vuelve como error saneado.
    expect(await clearDataHandler!({ sender: window.webContents }, { categories: [], range: 'todo' }))
      .toMatchObject({ success: false });

    const saveHandler = handlers.get('integrated-browser:credentials-save');
    const saved = await saveHandler!(
      { sender: window.webContents },
      { username: 'persona@example.com', password: 'secreto' },
    );
    expect(saved).toMatchObject({ success: true, credential: { id: 'credencial-id' } });
    expect(service.saveCredential).toHaveBeenCalledWith({ id: undefined, username: 'persona@example.com', password: 'secreto' });

    const confirmInstallHandler = handlers.get('integrated-browser:extensions-confirm-install');
    expect(await confirmInstallHandler!({ sender: window.webContents }, { token: '12345678-1234-1234-1234-123456789abc' }))
      .toMatchObject({ success: true, extension: { installId: 'extension-id' } });

    const readingHandler = handlers.get('integrated-browser:reading-prepare');
    expect(await readingHandler!({ sender: window.webContents }, { sourceUrl: 'https://example.com', selection: 'Texto' }))
      .toMatchObject({ success: true, reading: { readingId: 'reading-id' } });
    expect(service.prepareReadingMode).toHaveBeenCalledWith({ sourceUrl: 'https://example.com', selection: 'Texto' });

    const synthesisHandler = handlers.get('integrated-browser:reading-synthesize');
    expect(await synthesisHandler!({ sender: window.webContents }, {
      readingId: 'reading-id', requestId: 'request-id', start: 0, end: 16,
    })).toMatchObject({ success: true, speech: { readingId: 'reading-id' } });

    const highlightHandler = handlers.get('integrated-browser:reading-highlight');
    expect(await highlightHandler!({ sender: window.webContents }, {
      readingId: 'reading-id', start: 0, end: 9,
    })).toMatchObject({ success: true, highlighted: true });
    expect(service.highlightReadingRange).toHaveBeenCalledWith({ readingId: 'reading-id', start: 0, end: 9 });

    const toolbarWaitHandler = handlers.get('integrated-browser:reading-toolbar-wait');
    expect(await toolbarWaitHandler!({ sender: window.webContents }, { readingId: 'reading-id' }))
      .toMatchObject({ success: true, toolbarAction: { action: 'toggle' } });
    const toolbarSyncHandler = handlers.get('integrated-browser:reading-toolbar-sync');
    expect(await toolbarSyncHandler!({ sender: window.webContents }, {
      readingId: 'reading-id', status: 'playing', speed: 1.25,
    })).toMatchObject({ success: true, toolbarVisible: true });
    expect(service.syncReadingToolbar).toHaveBeenCalledWith({
      readingId: 'reading-id', status: 'playing', speed: 1.25, message: undefined,
    });

    const closeHandler = handlers.get('integrated-browser:reading-close');
    expect(await closeHandler!({ sender: window.webContents }, { readingId: 'reading-id' }))
      .toMatchObject({ success: true, closed: true });
  });

  it('entrega la decision del aviso de permiso y rechaza payloads invalidos', async () => {
    const decide = ipcMainHarness._getHandlers().get('integrated-browser:permission-decide');
    expect(await decide!({ sender: window.webContents }, { id: 'aviso-1', granted: true }))
      .toMatchObject({ success: true, resolved: true });
    expect(service.resolvePermissionPrompt).toHaveBeenCalledWith('aviso-1', true);

    // Un aviso sin identificador o con una decision que no es booleana nunca
    // llega al servicio: concederia o denegaria un permiso a ciegas.
    expect(await decide!({ sender: window.webContents }, { granted: true })).toMatchObject({ success: false });
    expect(await decide!({ sender: window.webContents }, { id: 'aviso-1', granted: 'si' })).toMatchObject({ success: false });
    expect(await decide!({ sender: window.webContents }, null)).toMatchObject({ success: false });
    expect(service.resolvePermissionPrompt).toHaveBeenCalledTimes(1);
  });

  it('rechaza emisores distintos y payloads malformados', async () => {
    const handler = ipcMainHarness._getHandler('integrated-browser:navigate');
    expect(await handler({ sender: { id: 999 } }, { target: 'example.com' })).toEqual({ success: false, error: 'sender_denied' });
    const invalid = await handler({ sender: window.webContents }, { target: 42 });
    expect(invalid.success).toBe(false);
    expect(service.navigate).not.toHaveBeenCalled();

    const extensionHandler = ipcMainHarness._getHandler('integrated-browser:extensions-set-enabled');
    const malformed = await extensionHandler({ sender: window.webContents }, { installId: 'extension-id', enabled: 'si' });
    expect(malformed.success).toBe(false);
    expect(service.setExtensionEnabled).not.toHaveBeenCalled();

    const confirmInstall = ipcMainHarness._getHandler('integrated-browser:extensions-confirm-install');
    expect((await confirmInstall({ sender: window.webContents }, { token: 42 })).success).toBe(false);
    expect(service.confirmExtensionInstall).not.toHaveBeenCalled();

    const viewModeHandler = ipcMainHarness._getHandler('integrated-browser:view-mode');
    expect((await viewModeHandler({ sender: window.webContents }, { mode: 'tiles' })).success).toBe(false);
    expect(service.setViewMode).not.toHaveBeenCalled();

    const perceptionHandler = ipcMainHarness._getHandler('integrated-browser:set-observation-enabled');
    expect((await perceptionHandler({ sender: window.webContents }, { enabled: 'si' })).success).toBe(false);
    expect(service.setObservationEnabled).not.toHaveBeenCalled();

    const detachHandler = ipcMainHarness._getHandler('integrated-browser:tab-detach');
    expect((await detachHandler({ sender: window.webContents }, { tabId: '' })).success).toBe(false);
    expect(service.detachTab).not.toHaveBeenCalled();

    const synthesisHandler = ipcMainHarness._getHandler('integrated-browser:reading-synthesize');
    expect((await synthesisHandler({ sender: window.webContents }, {
      readingId: 'reading-id', requestId: 'request-id', start: -1, end: 99_999,
    })).success).toBe(false);
    expect(service.synthesizeReadingSegment).not.toHaveBeenCalled();

    const highlightHandler = ipcMainHarness._getHandler('integrated-browser:reading-highlight');
    expect((await highlightHandler({ sender: window.webContents }, {
      readingId: 'reading-id', start: 20, end: 10,
    })).success).toBe(false);
    expect(service.highlightReadingRange).not.toHaveBeenCalled();

    const toolbarSyncHandler = ipcMainHarness._getHandler('integrated-browser:reading-toolbar-sync');
    expect((await toolbarSyncHandler({ sender: window.webContents }, {
      readingId: 'reading-id', status: 'volando', speed: 99,
    })).success).toBe(false);
    expect(service.syncReadingToolbar).not.toHaveBeenCalled();

    const closeHandler = ipcMainHarness._getHandler('integrated-browser:reading-close');
    expect((await closeHandler({ sender: window.webContents }, { readingId: 42 })).success).toBe(false);
    expect(service.closeReadingMode).not.toHaveBeenCalled();
  });
});
