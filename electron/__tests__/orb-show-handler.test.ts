import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserWindow, ipcMain } from 'electron';
import { registerOrbIpcHandlers } from '../orb-ipc-handlers';
import { resetAuthStateForTests, setAuthState } from '../main/auth-state';
import type { PythonRuntimeService } from '../python-runtime-service';

const ipcMainHarness = ipcMain as unknown as {
  _clearHandlers: () => void;
  _getHandler: (channel: string) => (event: { sender: { id: number } }) => Promise<Record<string, unknown>>;
};

function createPythonRuntime(): PythonRuntimeService {
  return Object.assign(new EventEmitter(), {
    startDictation: vi.fn(),
    stopDictation: vi.fn(),
    speak: vi.fn(),
    stopSpeaking: vi.fn(),
    resumeWakeAfterConversation: vi.fn(),
  }) as unknown as PythonRuntimeService;
}

describe('handler de apertura de la Orbe', () => {
  const mainWindow = new BrowserWindow();
  const showOrbWindow = vi.fn(async () => undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    ipcMainHarness._clearHandlers();
    resetAuthStateForTests();
    registerOrbIpcHandlers({
      pythonRuntimeService: createPythonRuntime(),
      getOrbWindow: () => null,
      getMainWindow: () => mainWindow,
      showOrbWindow,
      consumePendingWake: () => false,
    });
  });

  afterEach(() => resetAuthStateForTests());

  it('abre la Orbe solo para el renderer principal autenticado', async () => {
    setAuthState({ authenticated: true, userId: 'usuario-1' });
    const result = await ipcMainHarness._getHandler('orb:show')({ sender: mainWindow.webContents });

    expect(result).toMatchObject({ success: true, visible: true });
    expect(showOrbWindow).toHaveBeenCalledTimes(1);
  });

  it('rechaza falta de sesión y un emisor distinto', async () => {
    const handler = ipcMainHarness._getHandler('orb:show');
    await expect(handler({ sender: mainWindow.webContents })).resolves.toMatchObject({ success: false, error: 'auth_required' });
    setAuthState({ authenticated: true, userId: 'usuario-1' });
    await expect(handler({ sender: { id: 999 } })).resolves.toMatchObject({ success: false, error: 'sender_denied' });
    expect(showOrbWindow).not.toHaveBeenCalled();
  });
});
