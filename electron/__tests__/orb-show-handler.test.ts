import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { app } from 'electron';
import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserWindow, ipcMain, dialog, type MessageBoxReturnValue } from 'electron';
import type { IpcMainEvent } from 'electron';
import { registerOrbIpcHandlers } from '../orb-ipc-handlers';
import type { IntegratedBrowserService } from '../integrated-browser';
import { resetAuthStateForTests, setAuthState } from '../main/auth-state';
import type { PythonRuntimeService } from '../python-runtime-service';

const ipcMainHarness = ipcMain as unknown as {
  _clearHandlers: () => void;
  _getHandler: (channel: string) => (event: { sender: { id: number }; senderFrame?: unknown }, ...args: unknown[]) => Promise<Record<string, unknown>>;
};

const originalFetch = globalThis.fetch;
const originalEnvironment = {
  key: process.env.ELEVENLABS_API_KEY,
  voice: process.env.ELEVENLABS_VOICE_ID,
  model: process.env.ELEVENLABS_MODEL_ID,
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
  const orbWindow = new BrowserWindow();
  const browser = { getState: vi.fn<IntegratedBrowserService['getState']>(), controlAgentTask: vi.fn() };
  const showOrbWindow = vi.fn(async () => undefined);
  const onHide = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    browser.getState.mockReturnValue({ agentTask: null } as ReturnType<IntegratedBrowserService['getState']>);
    for (const win of [mainWindow, orbWindow]) Object.defineProperty(win.webContents, 'mainFrame', { configurable: true, value: { url: pathToFileURL(path.join(app.getAppPath(), 'dist', 'index.html')).href } });
    ipcMainHarness._clearHandlers();
    resetAuthStateForTests();
    registerOrbIpcHandlers({
      pythonRuntimeService: createPythonRuntime(),
      getOrbWindow: () => orbWindow,
      integratedBrowser: browser as unknown as IntegratedBrowserService,
      getMainWindow: () => mainWindow,
      showOrbWindow,
      onHide,
      consumePendingWake: () => false,
      announcements: {
        announce: vi.fn(async () => undefined),
        consumePending: () => null,
        finish: vi.fn(async () => undefined),
        clear: vi.fn(),
        size: () => 0,
      },
    });
  });

  afterEach(() => resetAuthStateForTests());
  it('ocultar sólo puede cancelar la asistencia desde Hub/Orbe autenticados y su marco principal', () => {
    const hide = vi.mocked(ipcMain.on).mock.calls.find(([channel]) => channel === 'orb:hide')?.[1];
    expect(hide).toBeDefined();
    Object.defineProperty(orbWindow.webContents, 'mainFrame', { configurable: true, value: { url: pathToFileURL(path.join(app.getAppPath(), 'dist', 'index.html')).href } });
    const event = { sender: orbWindow.webContents, senderFrame: orbWindow.webContents.mainFrame } as IpcMainEvent;
    hide!(event); expect(onHide).not.toHaveBeenCalled();
    setAuthState({ authenticated: true, userId: 'usuario-1' });
    hide!({ ...event, senderFrame: {} } as IpcMainEvent);
    hide!({ ...event, sender: { id: 9999 } } as IpcMainEvent);
    hide!(event, 'extra'); expect(onHide).not.toHaveBeenCalled();
    hide!(event); expect(onHide).toHaveBeenCalledOnce();
  });
  it('la voz del navegador sólo acepta marco principal de Orbe con sesión y contrato cerrado', async () => {
    const handler = ipcMainHarness._getHandler('orb:browser-command');
    Object.defineProperty(orbWindow.webContents, 'mainFrame', { configurable: true, value: { url: pathToFileURL(path.join(app.getAppPath(), 'dist', 'index.html')).href } });
    vi.mocked(orbWindow.isVisible).mockReturnValue(true);
    const event = { sender: orbWindow.webContents, senderFrame: orbWindow.webContents.mainFrame };
    expect(await handler(event, 'task-status')).toMatchObject({ success: false });
    setAuthState({ authenticated: true, userId: 'usuario-1' });
    expect(await handler(event, 'task-status')).toMatchObject({ success: true });
    for (const input of [[{ ...event, senderFrame: {} }, 'stop'], [{ ...event, sender: mainWindow.webContents }, 'stop'], [event, {}], [event, 'task-status', 'extra']] as const) expect(await handler(input[0], ...input.slice(1))).toMatchObject({ success: false });
  });
  it.each(['sesión', 'marco', 'oculta'] as const)('detener sigue disponible y una reanudación obsoleta no actúa: %s', async mode => {
    const handler = ipcMainHarness._getHandler('orb:browser-command');
    Object.defineProperty(orbWindow.webContents, 'mainFrame', { configurable: true, value: { url: pathToFileURL(path.join(app.getAppPath(), 'dist', 'index.html')).href } });
    vi.mocked(orbWindow.isVisible).mockReturnValue(true);
    setAuthState({ authenticated: true, userId: 'usuario-1' });
    browser.getState.mockReturnValue({ profileRevision: 2, agentTask: { taskId: 'cu-id', revision: 1, status: 'paused', currentStep: 2, maxSteps: 5 } } as ReturnType<IntegratedBrowserService['getState']>);
    let resolve!: (result: MessageBoxReturnValue) => void;
    vi.mocked(dialog.showMessageBox).mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    const event = { sender: orbWindow.webContents, senderFrame: orbWindow.webContents.mainFrame };
    const pending = handler(event, 'resume'); await vi.waitFor(() => expect(resolve).toBeDefined());
    expect(await handler(event, 'resume')).toMatchObject({ success: false });
    expect(await handler(event, 'stop')).toMatchObject({ success: true });
    if (mode === 'sesión') { setAuthState({ authenticated: false, userId: null }); setAuthState({ authenticated: true, userId: 'usuario-1' }); }
    if (mode === 'marco') Object.defineProperty(orbWindow.webContents, 'mainFrame', { configurable: true, value: { url: pathToFileURL(path.join(app.getAppPath(), 'dist', 'index.html')).href } });
    if (mode === 'oculta') vi.mocked(orbWindow.isVisible).mockReturnValue(false);
    resolve({ response: 1, checkboxChecked: false });
    expect(await pending).toMatchObject({ success: false });
    expect(browser.controlAgentTask).toHaveBeenCalledTimes(1);
    expect(browser.controlAgentTask).toHaveBeenCalledWith(expect.objectContaining({ action: 'stop' }));
  });

  it('abre la Orbe solo para el renderer principal autenticado', async () => {
    setAuthState({ authenticated: true, userId: 'usuario-1' });
    const result = await ipcMainHarness._getHandler('orb:show')({ sender: mainWindow.webContents, senderFrame: mainWindow.webContents.mainFrame });

    expect(result).toMatchObject({ success: true, visible: true });
    expect(showOrbWindow).toHaveBeenCalledTimes(1);
  });

  it('rechaza falta de sesión y un emisor distinto', async () => {
    const handler = ipcMainHarness._getHandler('orb:show');
    await expect(handler({ sender: mainWindow.webContents, senderFrame: mainWindow.webContents.mainFrame })).resolves.toMatchObject({ success: false, code: 'context_invalid' });
    setAuthState({ authenticated: true, userId: 'usuario-1' });
    await expect(handler({ sender: { id: 999 } })).resolves.toMatchObject({ success: false, code: 'context_invalid' });
    expect(showOrbWindow).not.toHaveBeenCalled();
  });

  it('sintetiza sólo para una ventana autorizada y no expone la credencial', async () => {
    process.env.ELEVENLABS_API_KEY = 'elevenlabs-test-key';
    process.env.ELEVENLABS_VOICE_ID = 'voice_test_123';
    delete process.env.ELEVENLABS_MODEL_ID;
    globalThis.fetch = vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { status: 200 })) as typeof fetch;
    setAuthState({ authenticated: true, userId: 'usuario-1' });
    const handler = ipcMainHarness._getHandler('orb:synthesize');

    await expect(handler({ sender: { id: 999 } }, 'Hola')).resolves.toMatchObject({ success: false, code: 'context_invalid' });
    const result = await handler({ sender: mainWindow.webContents, senderFrame: mainWindow.webContents.mainFrame }, 'Hola');

    expect(result).toMatchObject({
      success: true,
      mimeType: 'audio/mpeg',
      voiceId: 'voice_test_123',
      modelId: 'eleven_turbo_v2_5',
    });
    expect(result).not.toHaveProperty('apiKey');
  });

  it('rechaza payload de voz malformado antes de llamar al proveedor', async () => {
    globalThis.fetch = vi.fn() as typeof fetch;
    setAuthState({ authenticated: true, userId: 'usuario-1' });
    const handler = ipcMainHarness._getHandler('orb:synthesize');

    await expect(handler({ sender: mainWindow.webContents, senderFrame: mainWindow.webContents.mainFrame }, { text: 'no permitido' })).resolves.toMatchObject({
      success: false,
      code: 'voice_invalid_input',
    });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalEnvironment.key === undefined) delete process.env.ELEVENLABS_API_KEY;
  else process.env.ELEVENLABS_API_KEY = originalEnvironment.key;
  if (originalEnvironment.voice === undefined) delete process.env.ELEVENLABS_VOICE_ID;
  else process.env.ELEVENLABS_VOICE_ID = originalEnvironment.voice;
  if (originalEnvironment.model === undefined) delete process.env.ELEVENLABS_MODEL_ID;
  else process.env.ELEVENLABS_MODEL_ID = originalEnvironment.model;
});



