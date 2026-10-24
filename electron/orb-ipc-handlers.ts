import { dialog, ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import { executeBrowserVoiceCommand, type IntegratedBrowserService } from './integrated-browser/voice';
import { onAuthStateChange } from './main/auth-state';
import { synthesizeOrbSpeech } from './orb-tts';
import type { PythonRuntimeService, DictationEventPayload } from './python-runtime-service';
import type { OrbAnnouncements } from './main/orb-announcements';
import { trustedAppCaller } from './ipc/caller-authorization';
import { voiceFailure, type LocalVoiceSession, type VoiceCall } from './voice/session';
import { speechTextSchema, voiceIdSchema } from './voice/contract';
import { VoiceEventOwner } from './voice/event-owner';
import { VoiceSynthesisQueue } from './voice/synthesis-queue';

interface OrbIpcOptions {
  integratedBrowser?: IntegratedBrowserService;
  pythonRuntimeService: PythonRuntimeService;
  voiceSession?: LocalVoiceSession;
  getOrbWindow: () => BrowserWindow | null;
  getMainWindow: () => BrowserWindow | null;
  showOrbWindow: () => Promise<void>;
  consumePendingWake: () => boolean;
  announcements: OrbAnnouncements;
  onHide?: () => void;
}

export function registerOrbIpcHandlers(options: OrbIpcOptions): void {
  const { pythonRuntimeService: runtime, getOrbWindow, getMainWindow, announcements, voiceSession } = options;
  const windows = (role: 'main' | 'orb' | 'both') => role === 'main' ? [getMainWindow()] : role === 'orb' ? [getOrbWindow()] : [getMainWindow(), getOrbWindow()];
  const caller = (event: IpcMainInvokeEvent, role: 'main' | 'orb' | 'both', visible: boolean): VoiceCall => {
    const source = trustedAppCaller(event, () => windows(role));
    const assert = () => { source.assert(); if (visible && !source.parent?.isVisible()) throw new Error('context_invalid'); };
    return { ...source, assert, effectStarted: false };
  };
  const register = (channel: string, role: 'main' | 'orb' | 'both', min: number, max: number, visible: boolean,
    run: (call: VoiceCall, args: unknown[], event: IpcMainInvokeEvent) => Promise<object | void>) => {
    ipcMain.handle(channel, async (event: IpcMainInvokeEvent, ...args: unknown[]) => {
      let call: VoiceCall | undefined;
      try {
        call = caller(event, role, visible); call.assert();
        if (args.length < min || args.length > max) throw new Error('voice_invalid_input');
        const result = await run(call, args, event); call.assert(); return { success: true, ...result };
      } catch (error) { return voiceFailure(error, call); }
      finally { call?.dispose(); }
    });
  };
  const dictation = new VoiceEventOwner(() => [getOrbWindow()], true, () => {
    voiceSession?.cancelCapture();
  });
  const speech = new VoiceEventOwner(() => [getMainWindow(), getOrbWindow()], false, id => {
    void runtime.stopSpeaking(id);
  });
  onAuthStateChange(() => { dictation.clear(); speech.clear(); announcements.clear(); });
  runtime.on('dictation-partial', (payload: DictationEventPayload) => dictation.send('orb:dictation-partial', payload.sessionId, payload));
  runtime.on('dictation-final', (payload: DictationEventPayload) => dictation.send('orb:dictation-final', payload.sessionId, payload));
  runtime.on('dictation-timeout', (payload: DictationEventPayload) => dictation.send('orb:dictation-error', payload.sessionId,
    { sessionId: payload.sessionId, reason: 'El dictado terminó o fue interrumpido.' }));
  runtime.on('tts-chunk', (payload: { speechId: string }) => speech.send('orb:tts-chunk', payload.speechId, payload));
  runtime.on('tts-end', (payload: { speechId: string; interrupted: boolean; error?: string }) => {
    speech.send('orb:tts-end', payload.speechId, { speechId: payload.speechId, interrupted: payload.interrupted,
      ...(payload.error ? { error: 'La reproducción de voz fue interrumpida.' } : {}) });
    speech.clearId(payload.speechId);
  });
  let browserVoicePending = false;
  register('orb:browser-command', 'orb', 1, 1, true, async (call, [input]) => {
    const parent = getMainWindow();
    const assertCaller = () => { call.assert(); if (!parent || parent.isDestroyed() || getMainWindow() !== parent) throw new Error('context_invalid'); };
    assertCaller();
    if (!options.integratedBrowser) throw new Error('voice_unavailable');
    if (browserVoicePending && input !== 'stop' && input !== 'take-control' && input !== 'pause') throw new Error('approval_pending');
    return executeBrowserVoiceCommand(options.integratedBrowser, input, async () => {
      browserVoicePending = true;
      try {
        const result = await dialog.showMessageBox(parent!, { type: 'question', title: 'Reanudar tarea del navegador',
          message: '¿Permitir que SofLIA vuelva a controlar la pestaña?', detail: 'La orden provino de Orbe. Revisa el navegador antes de continuar.',
          buttons: ['Cancelar', 'Reanudar'], defaultId: 0, cancelId: 0, signal: call.signal });
        return result.response === 1;
      } finally { browserVoicePending = false; }
    }, assertCaller);
  });
  register('orb:get-pending-wake', 'orb', 0, 0, true, async () => ({ wake: voiceSession?.isApproved() === true && options.consumePendingWake() }));
  register('orb:get-pending-announcement', 'orb', 0, 0, true, async () => ({ announcement: announcements.consumePending() }));
  register('orb:announcement-finished', 'orb', 0, 1, false, async (_call, [input]) => { await announcements.finish(voiceIdSchema.parse(input) ?? null); });
  register('orb:show', 'main', 0, 0, false, async call => { await options.showOrbWindow(); call.assert(); return { visible: true }; });
  const synthesis = new VoiceSynthesisQueue();
  register('orb:synthesize', 'both', 1, 1, false, async (call, [input]) => {
    const text = speechTextSchema.parse(input);
    return synthesis.run(call.signal, () => synthesizeOrbSpeech(text, { assertCurrent: call.assert, signal: call.signal }));
  });
  register('orb:start-dictation', 'orb', 0, 0, true, async (call, _args, event) => {
    if (!voiceSession) throw new Error('voice_approval_required');
    let ownId: string | undefined;
    try {
      const result = await voiceSession.capture(call, 'dictation', async () => {
        const started = await runtime.startDictation(id => { ownId = id; dictation.bind(event, id); });
        if (!started.success || !started.sessionId) throw new Error('voice_unavailable'); return started;
      });
      return { sessionId: result.sessionId };
    } catch (error) { dictation.clearId(ownId); throw error; }
  });
  register('orb:stop-dictation', 'orb', 0, 1, false, async (call, [input], event) => {
    const id = voiceIdSchema.parse(input);
    if ((!id || dictation.owns(event, id)) && voiceSession?.cancelPendingCapture(call)) return;
    if (dictation.owns(event, id)) await runtime.stopDictation(id);
  });
  register('orb:speak', 'both', 1, 1, false, async (call, [input], event) => {
    const text = speechTextSchema.parse(input);
    let ownId: string | undefined;
    const onAbort = () => { if (ownId) void runtime.stopSpeaking(ownId); };
    call.signal.addEventListener('abort', onAbort, { once: true });
    try {
      const result = await runtime.speak(text, id => { ownId = id; speech.replace(); speech.bind(event, id); }); call.assert();
      if (!result.success || !result.speechId) { speech.clearId(ownId); throw new Error('voice_unavailable'); }
      return { speechId: result.speechId };
    } finally { call.signal.removeEventListener('abort', onAbort); }
  });
  register('orb:stop-speaking', 'both', 0, 1, false, async (_call, [input], event) => {
    const id = speech.ownedId(event, voiceIdSchema.parse(input));
    if (id) { await runtime.stopSpeaking(id); speech.clearId(id); }
  });
  register('orb:conversation-ended', 'orb', 0, 1, false, async (_call, [input], event) => {
    const id = dictation.ownedId(event, voiceIdSchema.parse(input));
    if (id) { await runtime.resumeWakeAfterConversation(id); dictation.clearId(id); }
  });
  ipcMain.on('orb:hide', (event, ...args: unknown[]) => {
    let call: VoiceCall | undefined;
    try {
      call = caller(event as IpcMainInvokeEvent, 'both', false); call.assert(); if (args.length) return;
      options.onHide?.(); getOrbWindow()?.hide();
      voiceSession?.cancelPendingCapture(call);
      dictation.clear();
      if (voiceSession?.isApproved()) void runtime.resumeWakeAfterConversation(null, true);
      else voiceSession?.cancelCapture();
    } catch { /* Un emisor ajeno no puede ocultar ni reanudar la voz. */ }
    finally { call?.dispose(); }
  });
}
