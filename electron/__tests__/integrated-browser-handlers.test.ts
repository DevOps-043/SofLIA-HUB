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
    open: vi.fn(async () => ({ url: 'https://example.com' })),
    navigate: vi.fn(async () => ({ url: 'https://example.com' })),
    goBack: vi.fn(), goForward: vi.fn(), reload: vi.fn(), stop: vi.fn(), focus: vi.fn(),
    setViewport: vi.fn(() => ({ isVisible: true })), hide: vi.fn(),
    listHistory: vi.fn(async () => []), clearHistory: vi.fn(async () => true),
    listCredentials: vi.fn(async () => []), saveCredential: vi.fn(async () => ({ id: 'credencial-id' })),
    fillCredential: vi.fn(async () => ({ id: 'credencial-id' })), removeCredential: vi.fn(async () => true),
    listExtensions: vi.fn(async () => []), installExtension: vi.fn(async () => ({ canceled: true })),
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
    expect(Array.from(handlers.keys()).filter((key: unknown) => String(key).startsWith('integrated-browser:'))).toHaveLength(20);
    const navigateHandler = handlers.get('integrated-browser:navigate');
    expect(navigateHandler).toBeDefined();
    const result = await navigateHandler!(
      { sender: window.webContents },
      { target: 'example.com' },
    );
    expect(result.success).toBe(true);
    expect(service.navigate).toHaveBeenCalledWith('example.com');

    const saveHandler = handlers.get('integrated-browser:credentials-save');
    const saved = await saveHandler!(
      { sender: window.webContents },
      { username: 'persona@example.com', password: 'secreto' },
    );
    expect(saved).toMatchObject({ success: true, credential: { id: 'credencial-id' } });
    expect(service.saveCredential).toHaveBeenCalledWith({ id: undefined, username: 'persona@example.com', password: 'secreto' });
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
  });
});
