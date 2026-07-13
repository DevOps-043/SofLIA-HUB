import { ipcMain } from 'electron';
import type { PythonRuntimeService, VoicePassiveConfig } from './python-runtime-service';
import { handleIPC } from './utils/ipc-helpers';

export function registerVoicePassiveHandlers(pythonRuntimeService: PythonRuntimeService): void {
  ipcMain.handle('voice:get-status', () =>
    handleIPC(async () => ({ status: pythonRuntimeService.getStatus(), config: pythonRuntimeService.getConfig() })));

  ipcMain.handle('voice:set-config', (_event, updates: Partial<VoicePassiveConfig>) =>
    handleIPC(async () => ({ config: await pythonRuntimeService.setConfig(updates || {}) })));

  ipcMain.handle('voice:start', () =>
    handleIPC(async () => {
      const result = await pythonRuntimeService.startPassiveListening();
      if (!result.success) throw new Error(result.error || 'No se pudo iniciar la escucha pasiva.');
      return { status: pythonRuntimeService.getStatus() };
    }));

  ipcMain.handle('voice:stop', () =>
    handleIPC(async () => {
      await pythonRuntimeService.stopPassiveListening();
      return { status: pythonRuntimeService.getStatus() };
    }));

  ipcMain.handle('voice:install-model', (_event, size?: string) =>
    handleIPC(async () => {
      const modelSize = size === 'large' ? 'large' : 'small';
      const result = await pythonRuntimeService.installModel(modelSize);
      if (!result.success) throw new Error(result.error || 'No se pudo instalar el modelo de voz.');
      return { status: pythonRuntimeService.getStatus() };
    }));

  ipcMain.handle('voice:install-tts-voice', (_event, voiceId: string) =>
    handleIPC(async () => {
      const result = await pythonRuntimeService.installTtsVoice(String(voiceId || ''));
      if (!result.success) throw new Error(result.error || 'No se pudo instalar la voz.');
      return { status: pythonRuntimeService.getStatus(), voices: pythonRuntimeService.listTtsVoices() };
    }));

  ipcMain.handle('voice:list-tts-voices', () =>
    handleIPC(async () => ({ voices: pythonRuntimeService.listTtsVoices() })));

  ipcMain.handle('voice:list-mic-devices', () =>
    handleIPC(async () => {
      const result = await pythonRuntimeService.listMicDevices();
      if (!result.success) throw new Error(result.error || 'No se pudieron listar los microfonos.');
      return { devices: result.devices };
    }));

  ipcMain.handle('voice:test-mic', (_event, device: string | number | null) =>
    handleIPC(async () => {
      const result = await pythonRuntimeService.probeMic(device ?? null);
      if (!result.success) throw new Error(result.error || 'No se pudo probar el microfono.');
      return { rms: result.rms, peak: result.peak, hasSignal: result.hasSignal };
    }));

  console.log('[VoicePassiveHandlers] Registered successfully');
}
