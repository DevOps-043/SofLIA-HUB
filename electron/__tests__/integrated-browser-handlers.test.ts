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
    expect(Array.from(handlers.keys()).filter((key: unknown) => String(key).startsWith('integrated-browser:'))).toHaveLength(10);
    const navigateHandler = handlers.get('integrated-browser:navigate');
    expect(navigateHandler).toBeDefined();
    const result = await navigateHandler!(
      { sender: window.webContents },
      { target: 'example.com' },
    );
    expect(result.success).toBe(true);
    expect(service.navigate).toHaveBeenCalledWith('example.com');
  });

  it('rechaza emisores distintos y payloads malformados', async () => {
    const handler = ipcMainHarness._getHandler('integrated-browser:navigate');
    expect(await handler({ sender: { id: 999 } }, { target: 'example.com' })).toEqual({ success: false, error: 'sender_denied' });
    const invalid = await handler({ sender: window.webContents }, { target: 42 });
    expect(invalid.success).toBe(false);
    expect(service.navigate).not.toHaveBeenCalled();
  });
});
