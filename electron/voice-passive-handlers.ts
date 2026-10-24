import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import type { PythonRuntimeService } from './python-runtime-service';
import { LocalVoiceSession, voiceFailure, type VoiceCall } from './voice/session';
import { micDeviceSchema, modelSizeSchema, parseVoiceConfig, piperVoiceSchema } from './voice/contract';

export function registerVoicePassiveHandlers(runtime: PythonRuntimeService, getMain: () => BrowserWindow | null = () => null,
  getOrb: () => BrowserWindow | null = () => null, clearPendingWake?: () => void): LocalVoiceSession {
  const session = new LocalVoiceSession(runtime, getMain, getOrb, clearPendingWake);
  const register = (channel: string, min: number, max: number, run: (call: VoiceCall, args: unknown[]) => Promise<object>) => {
    ipcMain.handle(channel, async (event: IpcMainInvokeEvent, ...args: unknown[]) => {
      let call: VoiceCall | undefined;
      try {
        call = session.caller(event, 'main'); call.assert();
        if (args.length < min || args.length > max) throw new Error('voice_invalid_input');
        const data = await run(call, args); call.assert(); return { success: true, ...data };
      } catch (error) { return voiceFailure(error, call); }
      finally { call?.dispose(); }
    });
  };
  register('voice:get-status', 0, 0, async () => session.snapshot());
  register('voice:set-config', 1, 1, async (call, [input]) => {
    await session.setConfig(call, parseVoiceConfig(input)); return session.snapshot();
  });
  register('voice:start', 0, 0, async call => {
    await session.capture(call, 'passive', async () => {
      const result = await runtime.startPassiveListening(); if (!result.success) throw new Error('voice_unavailable');
    }); return session.snapshot();
  });
  register('voice:stop', 0, 0, async call => { await session.stop(call); return session.snapshot(); });
  register('voice:install-model', 0, 1, async (call, [input]) => {
    const size = modelSizeSchema.parse(input);
    const result = await session.install(call, `Instalar modelo de voz ${size === 'large' ? 'grande (~1.4 GB), y pequeño si falta' : 'pequeño (~39 MB)'}.`, () => runtime.installModel(size));
    if (!result.success) throw new Error('voice_unavailable'); return session.snapshot();
  });
  register('voice:install-tts-voice', 1, 1, async (call, [input]) => {
    const id = piperVoiceSchema.parse(input);
    const result = await session.install(call, `Instalar voz Piper ${id} y su runtime local si falta.`, () => runtime.installTtsVoice(id));
    if (!result.success) throw new Error('voice_unavailable'); return { ...session.snapshot(), voices: runtime.listTtsVoices() };
  });
  register('voice:list-tts-voices', 0, 0, async () => ({ voices: runtime.listTtsVoices() }));
  register('voice:list-mic-devices', 0, 0, async () => {
    const result = await runtime.listMicDevices(); if (!result.success) throw new Error('voice_unavailable');
    return { devices: result.devices };
  });
  register('voice:test-mic', 1, 1, async (call, [input]) => {
    const device = micDeviceSchema.parse(input);
    if (runtime.getStatus().listening || runtime.getStatus().dictating) throw new Error('voice_busy');
    const result = await session.capture(call, 'probe', async () => {
      const probe = await runtime.probeMic(device); if (!probe.success) throw new Error('voice_unavailable'); return probe;
    }, runtime.getConfig(), device);
    return { rms: result.rms, peak: result.peak, hasSignal: result.hasSignal };
  });
  return session;
}
