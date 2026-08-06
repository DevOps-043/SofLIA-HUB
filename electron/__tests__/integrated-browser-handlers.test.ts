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
    listHistory: vi.fn(async () => []), clearHistory: vi.fn(async () => true),
    listCredentials: vi.fn(async () => []), saveCredential: vi.fn(async () => ({ id: 'credencial-id' })),
    fillCredential: vi.fn(async () => ({ id: 'credencial-id' })), removeCredential: vi.fn(async () => true),
    listExtensions: vi.fn(async () => []), prepareExtensionInstall: vi.fn(async () => ({ canceled: true })),
    confirmExtensionInstall: vi.fn(async () => ({ installId: 'extension-id' })),
    setExtensionEnabled: vi.fn(async () => ({ installId: 'extension-id' })), removeExtension: vi.fn(async () => true),
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
    expect(Array.from(handlers.keys()).filter((key: unknown) => String(key).startsWith('integrated-browser:'))).toHaveLength(33);
    const captureHandler = handlers.get('integrated-browser:capture-visible');
    expect(await captureHandler!({ sender: window.webContents })).toMatchObject({
      success: true,
      screenshot: 'data:image/png;base64,captura',
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
  });
});
