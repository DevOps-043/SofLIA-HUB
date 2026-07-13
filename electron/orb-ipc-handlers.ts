// =============================================================================
// SofLIA Hub - IPC de la Orbe de Voz
// =============================================================================
// Puente entre la ventana orbe (renderer) y el sidecar Python (via
// PythonRuntimeService): dictado libre, TTS local y ciclo de vida de la
// conversacion (suspension/reanudacion del wake listener).
// =============================================================================
import { BrowserWindow, ipcMain } from 'electron';
import { synthesizeOrbSpeech } from './orb-tts';
import type { PythonRuntimeService } from './python-runtime-service';
import { handleIPC, handleIPCVoid } from './utils/ipc-helpers';

interface OrbIpcOptions {
  pythonRuntimeService: PythonRuntimeService;
  getOrbWindow: () => BrowserWindow | null;
  consumePendingWake: () => boolean;
}

export function registerOrbIpcHandlers(options: OrbIpcOptions): void {
  const { pythonRuntimeService, getOrbWindow, consumePendingWake } = options;

  const sendToOrb = (channel: string, payload?: unknown): void => {
    const win = getOrbWindow();
    if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
  };

  // El TTS se difunde a todas las ventanas: la orbe lo reproduce en conversacion
  // y la ventana principal lo usa para "Probar voz" desde Configuracion → Voz.
  const broadcast = (channel: string, payload?: unknown): void => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) win.webContents.send(channel, payload);
    }
  };

  // Eventos del sidecar → renderer (dictado solo a la orbe; TTS a todas).
  pythonRuntimeService.on('dictation-partial', (payload) => sendToOrb('orb:dictation-partial', payload));
  pythonRuntimeService.on('dictation-final', (payload) => sendToOrb('orb:dictation-final', payload));
  pythonRuntimeService.on('dictation-timeout', (payload) => sendToOrb('orb:dictation-error', payload));
  pythonRuntimeService.on('tts-chunk', (payload) => broadcast('orb:tts-chunk', payload));
  pythonRuntimeService.on('tts-end', (payload) => broadcast('orb:tts-end', payload));

  ipcMain.handle('orb:get-pending-wake', () =>
    handleIPC(async () => ({ wake: consumePendingWake() })));

  // Voz de la orbe: se sintetiza en main (unico lugar con la key del .env).
  ipcMain.handle('orb:synthesize', (_event, text: string) =>
    handleIPC(async () => {
      const speech = String(text || '').trim();
      if (!speech) throw new Error('No hay texto que sintetizar.');
      const audio = await synthesizeOrbSpeech(speech);
      return { audioBase64: audio.audioBase64, voice: audio.voice };
    }));

  ipcMain.handle('orb:start-dictation', () =>
    handleIPC(async () => {
      const result = await pythonRuntimeService.startDictation();
      if (!result.success) throw new Error(result.error || 'No se pudo iniciar el dictado.');
      if (!result.sessionId) throw new Error('El dictado inicio sin un identificador de sesion.');
      return { sessionId: result.sessionId };
    }));

  ipcMain.handle('orb:stop-dictation', (_event, sessionId?: string | null) =>
    handleIPCVoid(async () => pythonRuntimeService.stopDictation(sessionId)));

  ipcMain.handle('orb:speak', (_event, text: string) =>
    handleIPC(async () => {
      const result = await pythonRuntimeService.speak(String(text || '').trim());
      if (!result.success) throw new Error(result.error || 'No se pudo sintetizar la voz.');
      if (!result.speechId) throw new Error('La sintesis inicio sin un identificador de voz.');
      return { speechId: result.speechId };
    }));

  ipcMain.handle('orb:stop-speaking', (_event, speechId?: string | null) =>
    handleIPCVoid(async () => pythonRuntimeService.stopSpeaking(speechId)));

  // La conversacion termino (idle o ventana oculta): reanudar la escucha pasiva.
  ipcMain.handle('orb:conversation-ended', (_event, sessionId?: string | null) =>
    handleIPCVoid(async () => pythonRuntimeService.resumeWakeAfterConversation(sessionId)));

  ipcMain.on('orb:hide', () => {
    const win = getOrbWindow();
    if (win && !win.isDestroyed()) win.hide();
    void pythonRuntimeService.resumeWakeAfterConversation(null, true);
  });

  console.log('[OrbIpcHandlers] Registered successfully');
}
