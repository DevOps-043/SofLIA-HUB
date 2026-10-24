import { EventEmitter } from 'node:events';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { app, dialog, ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import { registerVoicePassiveHandlers } from '../voice-passive-handlers';
import { registerOrbIpcHandlers } from '../orb-ipc-handlers';
import type { PythonRuntimeService, VoicePassiveConfig, SpeechStartResult, DictationStartResult } from '../python-runtime-service';
import type { LocalVoiceSession } from '../voice/session';
import { VoiceEventOwner } from '../voice/event-owner';
import { resetAuthStateForTests, setAuthState } from '../main/auth-state';
import { deferred } from './project-hub/fixtures';

const harness = ipcMain as unknown as { _getHandler(channel: string): (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<Record<string, unknown>> };
function windowFixture() {
  const sender = Object.assign(new EventEmitter(), { mainFrame: { url: pathToFileURL(path.join(app.getAppPath(), 'dist', 'index.html')).href }, isDestroyed: () => false, send: vi.fn() });
  const win = { webContents: sender, isDestroyed: () => false, isVisible: vi.fn(() => true), hide: vi.fn() } as unknown as BrowserWindow;
  const event = { sender, senderFrame: sender.mainFrame } as unknown as IpcMainInvokeEvent;
  return { sender, win, event };
}
let main: ReturnType<typeof windowFixture>;
let orb: ReturnType<typeof windowFixture>;
let config: VoicePassiveConfig;
let listening = false;
let sequence = 0;
let session: LocalVoiceSession;
let authorize: (cmd: string, params: Record<string, unknown>) => void;
let runtime: ReturnType<typeof runtimeFixture>;
function runtimeFixture() {
  return Object.assign(new EventEmitter(), {
    configureCaptureAuthorization: vi.fn((fn: typeof authorize) => { authorize = fn; }),
    getConfig: vi.fn(() => ({ ...config, wakeWords: [...config.wakeWords] })),
    getStatus: vi.fn(() => ({ runtimeAvailable: true, sidecarRunning: false, enabled: config.enabled, listening, dictating: false,
      pythonPath: 'C:/privado/python.exe', modelPath: 'C:/privado/modelo', largeModelInstalled: false, modelDownloadProgress: null,
      ttsReady: true, ttsDownloadProgress: null, lastError: null })),
    setConfig: vi.fn(async (updates: Partial<VoicePassiveConfig>) => { config = { ...config, ...updates }; return config; }),
    stop: vi.fn(async () => { listening = false; }),
    stopPassiveListening: vi.fn(async () => { listening = false; }),
    startPassiveListening: vi.fn(async () => { authorize('start_wake', {}); listening = true; return { success: true }; }),
    startDictation: vi.fn(async (created?: (id: string) => void): Promise<DictationStartResult> => { authorize('start_dictation', {}); const id = `dictation-test-${++sequence}`; created?.(id); return { success: true, sessionId: id }; }),
    stopDictation: vi.fn(async () => {}), resumeWakeAfterConversation: vi.fn(async () => {}),
    speak: vi.fn(async (_text: string, created?: (id: string) => void): Promise<SpeechStartResult> => { const id = `speech-test-${++sequence}`; created?.(id); return { success: true, speechId: id }; }),
    stopSpeaking: vi.fn(async () => {}),
    installModel: vi.fn(async () => ({ success: true })), installTtsVoice: vi.fn(async () => ({ success: true })),
    listTtsVoices: vi.fn(() => []), listMicDevices: vi.fn(async () => ({ success: true, devices: [] })),
    probeMic: vi.fn(async (device: unknown): ReturnType<PythonRuntimeService['probeMic']> => { authorize('mic_probe', { device, seconds: 3 }); return { success: true, rms: 0, peak: 0, hasSignal: false }; }),
  });
}
const invoke = (channel: string, ...args: unknown[]) => harness._getHandler(channel)(main.event, ...args);
const invokeOrb = (channel: string, ...args: unknown[]) => harness._getHandler(channel)(orb.event, ...args);
beforeEach(() => {
  vi.clearAllMocks(); resetAuthStateForTests(); setAuthState({ authenticated: true, userId: 'usuario-A' });
  main = windowFixture(); orb = windowFixture(); listening = false; sequence = 0;
  config = { enabled: false, wakeWords: ['soflia'], micDevice: null, ttsVoice: 'Aoede', ttsSpeed: 1 };
  runtime = runtimeFixture(); vi.mocked(dialog.showMessageBox).mockResolvedValue({ response: 1, checkboxChecked: false });
  session = registerVoicePassiveHandlers(runtime as unknown as PythonRuntimeService, () => main.win, () => orb.win);
  registerOrbIpcHandlers({ pythonRuntimeService: runtime as unknown as PythonRuntimeService, voiceSession: session,
    getMainWindow: () => main.win, getOrbWindow: () => orb.win, showOrbWindow: async () => {}, consumePendingWake: () => true,
    announcements: { announce: async () => {}, consumePending: () => null, finish: async () => {}, clear: vi.fn(), size: () => 0 } });
});
afterEach(() => { session.dispose(); resetAuthStateForTests(); });

describe('Autorización integrada de voz local', () => {
  it.each(['dictado', 'prueba'] as const)('un fallo devuelto por %s retira el hijo y el grant', async mode => {
    if (mode === 'dictado') runtime.startDictation.mockResolvedValueOnce({ success: false, error: 'Fallo nativo ficticio.' });
    else runtime.probeMic.mockResolvedValueOnce({ success: false, error: 'Fallo nativo ficticio.' });
    const result = mode === 'dictado' ? await invokeOrb('orb:start-dictation') : await invoke('voice:test-mic', null);
    expect(result).toMatchObject({ success: false, uncertain: true }); expect(runtime.stop).toHaveBeenCalled(); expect(session.isApproved('dictation')).toBe(false);
  });
  it('si Orbe pierde visibilidad durante activación se retira la captura ya invocada', async () => {
    const result = deferred<{ success: boolean; sessionId: string }>();
    runtime.startDictation.mockImplementationOnce(async created => { created?.('dictation-pendiente'); return result.promise; });
    const pending = invokeOrb('orb:start-dictation'); await vi.waitFor(() => expect(runtime.startDictation).toHaveBeenCalledOnce());
    vi.mocked(orb.win.isVisible).mockReturnValue(false); result.resolve({ success: true, sessionId: 'dictation-pendiente' });
    expect(await pending).toMatchObject({ success: false, uncertain: true }); expect(runtime.stop).toHaveBeenCalled(); expect(session.isApproved('dictation')).toBe(false);
  });
  it('un destinatario rechazado no conserva listeners de su contexto', () => {
    const owner = new VoiceEventOwner(() => [main.win]);
    expect(() => owner.bind({ ...main.event, senderFrame: {} } as IpcMainInvokeEvent, 'speech-invalido')).toThrow();
    expect(main.sender.eventNames()).toEqual([]);
  });
  it('stop-speaking antiguo en vuelo no retira el destinatario que lo reemplazó', async () => {
    const first = await invoke('orb:speak', 'Primero'); const stopped = deferred<void>(); runtime.stopSpeaking.mockReturnValueOnce(stopped.promise);
    const pending = invoke('orb:stop-speaking', first.speechId); await vi.waitFor(() => expect(runtime.stopSpeaking).toHaveBeenCalledOnce());
    const second = await invokeOrb('orb:speak', 'Segundo'); stopped.resolve(); await pending; orb.sender.send.mockClear();
    runtime.emit('tts-chunk', { speechId: second.speechId, audioBase64: 'actual' }); expect(orb.sender.send).toHaveBeenCalledOnce();
  });
  it('terminar conversación antigua en vuelo conserva el dictado nuevo', async () => {
    const first = await invokeOrb('orb:start-dictation'); const resumed = deferred<void>(); runtime.resumeWakeAfterConversation.mockReturnValueOnce(resumed.promise);
    const pending = invokeOrb('orb:conversation-ended', first.sessionId); await vi.waitFor(() => expect(runtime.resumeWakeAfterConversation).toHaveBeenCalledOnce());
    const second = await invokeOrb('orb:start-dictation'); resumed.resolve(); await pending; orb.sender.send.mockClear();
    runtime.emit('dictation-partial', { sessionId: second.sessionId, text: 'actual' }); expect(orb.sender.send).toHaveBeenCalledOnce();
  });
  it('restaurar enabled pide autorización nueva y cancelarla conserva inactividad', async () => {
    config.enabled = true; vi.mocked(dialog.showMessageBox).mockResolvedValueOnce({ response: 0, checkboxChecked: false });
    setAuthState({ authenticated: true, userId: 'usuario-B' });
    await vi.waitFor(() => expect(dialog.showMessageBox).toHaveBeenCalledOnce()); await Promise.resolve();
    expect(runtime.startPassiveListening).not.toHaveBeenCalled(); expect(config.enabled).toBe(true); expect(session.isApproved()).toBe(false);
  });
  it('el resumen aprobado es una copia independiente del payload original', async () => {
    const answer = deferred<{ response: number; checkboxChecked: boolean }>(); vi.mocked(dialog.showMessageBox).mockReturnValueOnce(answer.promise);
    const input = { enabled: true, micDevice: 0, wakeWords: ['soflia'] }; const pending = invoke('voice:set-config', input);
    await vi.waitFor(() => expect(dialog.showMessageBox).toHaveBeenCalledOnce()); input.micDevice = 9; input.wakeWords[0] = 'otra';
    answer.resolve({ response: 1, checkboxChecked: false }); expect(await pending).toMatchObject({ success: true });
    expect(config.micDevice).toBe(0); expect(config.wakeWords).toEqual(['soflia']);
  });
  it('una voz antigua que termina después no retira el consumidor nuevo', async () => {
    const result = deferred<{ success: boolean; speechId?: string }>();
    runtime.speak.mockImplementationOnce(async (_text, created) => { created?.('speech-lento'); return result.promise; });
    const old = invoke('orb:speak', 'Prueba lenta'); await vi.waitFor(() => expect(runtime.speak).toHaveBeenCalledOnce());
    const current = await invokeOrb('orb:speak', 'Prueba nueva'); result.resolve({ success: false }); await old;
    orb.sender.send.mockClear(); runtime.emit('tts-chunk', { speechId: current.speechId, audioBase64: 'actual' });
    expect(orb.sender.send).toHaveBeenCalledOnce();
  });
  it('Orbe puede cancelar el dictado antes de que termine la aprobación', async () => {
    const answer = deferred<{ response: number; checkboxChecked: boolean }>(); vi.mocked(dialog.showMessageBox).mockReturnValueOnce(answer.promise);
    const pending = invokeOrb('orb:start-dictation'); await vi.waitFor(() => expect(dialog.showMessageBox).toHaveBeenCalledOnce());
    expect(await invokeOrb('orb:stop-dictation')).toMatchObject({ success: true }); answer.resolve({ response: 1, checkboxChecked: false });
    expect(await pending).toMatchObject({ success: false }); expect(runtime.startDictation).not.toHaveBeenCalled();
  });
  const channels = ['voice:get-status', 'voice:set-config', 'voice:start', 'voice:stop', 'voice:install-model', 'voice:install-tts-voice', 'voice:list-tts-voices', 'voice:list-mic-devices', 'voice:test-mic'];
  it.each(channels)('deniega %s sin sesión antes de consultar servicios', async channel => {
    setAuthState({ authenticated: false, userId: null }); vi.clearAllMocks();
    expect(await invoke(channel)).toMatchObject({ success: false, code: 'context_invalid' });
    for (const method of [runtime.getStatus, runtime.getConfig, runtime.setConfig, runtime.startPassiveListening, runtime.installModel, runtime.listMicDevices, runtime.probeMic]) expect(method).not.toHaveBeenCalled();
  });
  it.each(['subframe', 'origen', 'ventana'] as const)('deniega caller %s', async mode => {
    if (mode === 'subframe') main.event = { ...main.event, senderFrame: {} } as IpcMainInvokeEvent;
    if (mode === 'origen') main.sender.mainFrame.url = 'https://externo.example.test';
    if (mode === 'ventana') main.event = orb.event;
    expect(await invoke('voice:start')).toMatchObject({ success: false }); expect(runtime.startPassiveListening).not.toHaveBeenCalled(); expect(dialog.showMessageBox).not.toHaveBeenCalled();
  });
  it.each([
    ['voice:install-model', 'otro'], ['voice:install-tts-voice', '../voz'], ['voice:test-mic', {}], ['voice:test-mic', -1],
    ['voice:set-config', { enabled: 'true' }], ['voice:set-config', { approved: true }], ['voice:set-config', { wakeWords: Array(11).fill('soflia') }],
    ['voice:set-config', { ttsSpeed: 3 }], ['voice:set-config', { micDevice: 65536 }], ['voice:set-config', { modelPath: 'relativo' }],
    ['voice:set-config', { enabled: undefined }], ['voice:set-config', { wakeWords: undefined }], ['voice:set-config', { wakeWords: [' '] }], ['voice:set-config', {}],
  ])('rechaza payload de %s antes de aprobación', async (channel, value) => {
    expect(await invoke(channel as string, value)).toMatchObject({ success: false }); expect(dialog.showMessageBox).not.toHaveBeenCalled();
    expect(runtime.setConfig).not.toHaveBeenCalled(); expect(runtime.installModel).not.toHaveBeenCalled(); expect(runtime.probeMic).not.toHaveBeenCalled();
  });
  it('proyecta estado y configuración sin rutas ni error libre', async () => {
    config.modelPath = 'C:/privado/modelo';
    const result = await invoke('voice:get-status');
    expect(result).toMatchObject({ success: true, status: { modelInstalled: true, approvalRequired: true } }); expect(JSON.stringify(result)).not.toContain('privado');
  });
  it('cancelar no concede captura y conserva la preferencia', async () => {
    vi.mocked(dialog.showMessageBox).mockResolvedValueOnce({ response: 0, checkboxChecked: false });
    expect(await invoke('voice:set-config', { enabled: true })).toMatchObject({ success: false });
    expect(runtime.startPassiveListening).not.toHaveBeenCalled(); expect(runtime.setConfig).not.toHaveBeenCalled(); expect(session.isApproved()).toBe(false);
  });
  it('aprobar habilita la configuración de sesión y no repite diálogo para dictado', async () => {
    expect(await invoke('voice:set-config', { enabled: true })).toMatchObject({ success: true, status: { listening: true, approvalRequired: false } });
    expect(await invokeOrb('orb:start-dictation')).toMatchObject({ success: true }); expect(dialog.showMessageBox).toHaveBeenCalledOnce();
    expect(session.isApproved()).toBe(true);
  });
  it('detener no espera una aprobación pendiente ni permite su respuesta tardía', async () => {
    const answer = deferred<{ response: number; checkboxChecked: boolean }>();
    vi.mocked(dialog.showMessageBox).mockReturnValueOnce(answer.promise);
    const pending = invoke('voice:start'); await vi.waitFor(() => expect(dialog.showMessageBox).toHaveBeenCalledOnce());
    expect(await invoke('voice:stop')).toMatchObject({ success: true }); answer.resolve({ response: 1, checkboxChecked: false });
    expect(await pending).toMatchObject({ success: false }); expect(runtime.startPassiveListening).not.toHaveBeenCalled();
  });
  it.each(['sesión', 'navegación'] as const)('no instala tras invalidar %s durante aprobación', async mode => {
    const answer = deferred<{ response: number; checkboxChecked: boolean }>(); vi.mocked(dialog.showMessageBox).mockReturnValueOnce(answer.promise);
    const pending = invoke('voice:install-model', 'small'); await vi.waitFor(() => expect(dialog.showMessageBox).toHaveBeenCalledOnce());
    if (mode === 'sesión') { setAuthState({ authenticated: true, userId: 'usuario-B' }); setAuthState({ authenticated: true, userId: 'usuario-A' }); }
    else main.sender.emit('did-start-navigation', {}, main.sender.mainFrame.url, true, true);
    answer.resolve({ response: 1, checkboxChecked: false }); expect(await pending).toMatchObject({ success: false }); expect(runtime.installModel).not.toHaveBeenCalled();
  });
  it('una instalación iniciada devuelve incertidumbre al perder contexto, sin repetir', async () => {
    const effect = deferred<{ success: boolean }>(); runtime.installModel.mockReturnValueOnce(effect.promise);
    const pending = invoke('voice:install-model', 'small'); await vi.waitFor(() => expect(runtime.installModel).toHaveBeenCalledOnce());
    setAuthState({ authenticated: false, userId: null }); effect.resolve({ success: true });
    expect(await pending).toMatchObject({ success: false, uncertain: true, recoveryRequired: true }); expect(runtime.installModel).toHaveBeenCalledOnce();
  });
  it('A/B/A revoca el grant y deniega comandos nativos', async () => {
    await invoke('voice:start'); setAuthState({ authenticated: true, userId: 'usuario-B' }); setAuthState({ authenticated: true, userId: 'usuario-A' });
    expect(session.isApproved()).toBe(false); expect(() => authorize('start_dictation', {})).toThrow('voice_approval_required'); expect(runtime.stop).toHaveBeenCalled();
  });
  it('probe usa aprobación temporal y nunca concede dictado', async () => {
    expect(await invoke('voice:test-mic', null)).toMatchObject({ success: true });
    expect(() => authorize('mic_probe', { device: null, seconds: 3 })).toThrow('voice_approval_required');
    expect(() => authorize('start_dictation', {})).toThrow('voice_approval_required');
  });
  it('audio sólo llega al consumidor propietario y el reemplazado no corta al nuevo', async () => {
    const first = await invoke('orb:speak', 'Prueba principal'); const second = await invokeOrb('orb:speak', 'Prueba Orbe');
    main.sender.send.mockClear(); orb.sender.send.mockClear();
    runtime.emit('tts-chunk', { speechId: first.speechId, audioBase64: 'viejo' });
    runtime.emit('tts-chunk', { speechId: second.speechId, audioBase64: 'nuevo' });
    expect(main.sender.send).not.toHaveBeenCalled(); expect(orb.sender.send).toHaveBeenCalledOnce();
    await invoke('orb:stop-speaking', first.speechId); expect(runtime.stopSpeaking).not.toHaveBeenCalled();
    orb.sender.emit('did-start-navigation', {}, orb.sender.mainFrame.url, false, true);
    runtime.emit('tts-chunk', { speechId: second.speechId, audioBase64: 'tardío' }); expect(orb.sender.send).toHaveBeenCalledOnce();
  });
  it('dictado rechaza ventana principal y Orbe oculta', async () => {
    expect(await invoke('orb:start-dictation')).toMatchObject({ success: false });
    vi.mocked(orb.win.isVisible).mockReturnValue(false); expect(await invokeOrb('orb:start-dictation')).toMatchObject({ success: false }); expect(runtime.startDictation).not.toHaveBeenCalled();
  });
});
