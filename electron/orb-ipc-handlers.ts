// =============================================================================
// Pulse Hub - IPC de la Orbe de Voz
// =============================================================================
// Puente entre la ventana orbe (renderer) y el sidecar Python (via
// PythonRuntimeService): dictado libre, TTS local y ciclo de vida de la
// conversacion (suspension/reanudacion del wake listener).
// =============================================================================
import { BrowserWindow, dialog, ipcMain } from 'electron';
import { executeBrowserVoiceCommand, type IntegratedBrowserService } from './integrated-browser';
import { getAuthState, onAuthStateChange } from './main/auth-state';
import { synthesizeOrbSpeech } from './orb-tts';
import type { PythonRuntimeService } from './python-runtime-service';
import { handleIPC, handleIPCVoid } from './utils/ipc-helpers';
import { denyIfUnauthenticated } from './main/require-auth';
import type { OrbAnnouncements } from './main/orb-announcements';

interface OrbIpcOptions {
  integratedBrowser?: IntegratedBrowserService;
  pythonRuntimeService: PythonRuntimeService;
  getOrbWindow: () => BrowserWindow | null;
  getMainWindow: () => BrowserWindow | null;
  showOrbWindow: () => Promise<void>;
  consumePendingWake: () => boolean;
  /** Cola de anuncios proactivos. Ver `main/orb-announcements.ts`. */
  announcements: OrbAnnouncements;
}

export function registerOrbIpcHandlers(options: OrbIpcOptions): void {
  const { pythonRuntimeService, getOrbWindow, getMainWindow, showOrbWindow, consumePendingWake, announcements } = options;
  let browserVoicePending = false;
  ipcMain.handle('orb:browser-command', async (event, ...args: unknown[]) => {
    const orb = getOrbWindow(); const parent = getMainWindow(); const auth = getAuthState();
    let sessionChanged = false;
    const unsubscribe = onAuthStateChange(() => { sessionChanged = true; });
    const assertCaller = () => {
      const now = getAuthState();
      if (sessionChanged || !auth.authenticated || !now.authenticated || now.userId !== auth.userId
        || !orb || orb.isDestroyed() || !orb.isVisible() || getOrbWindow() !== orb
        || !parent || parent.isDestroyed() || getMainWindow() !== parent
        || event.sender.id !== orb.webContents.id || !event.senderFrame || event.senderFrame !== orb.webContents.mainFrame) throw new Error('Emisor inválido.');
    };
    try {
      assertCaller();
      if (args.length !== 1 || !options.integratedBrowser) throw new Error('Solicitud inválida.');
      // Detener no queda bloqueado por una confirmación de reanudación pendiente.
      if (browserVoicePending && args[0] !== 'stop' && args[0] !== 'take-control' && args[0] !== 'pause') throw new Error('Revisión pendiente.');
      return await executeBrowserVoiceCommand(options.integratedBrowser, args[0], async () => {
        browserVoicePending = true;
        try {
          const result = await dialog.showMessageBox(parent!, { type: 'question', title: 'Reanudar tarea del navegador', message: '¿Permitir que SofLIA vuelva a controlar la pestaña?', detail: 'La orden provino de Orbe. Revisa el navegador antes de continuar.', buttons: ['Cancelar', 'Reanudar'], defaultId: 0, cancelId: 0 });
          return result.response === 1;
        } finally { browserVoicePending = false; }
      }, assertCaller);
    } catch { return { success: false, error: 'No se pudo aplicar la orden. Revisa la pestaña, la tarea y la sesión; puedes usar los controles del navegador.' }; }
    finally { unsubscribe(); }
  });

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

  // Relevo del push: si la orbe acababa de crearse, `orb:announce` se emitio
  // antes de que React montara sus listeners y se habria perdido.
  ipcMain.handle('orb:get-pending-announcement', () =>
    handleIPC(async () => ({ announcement: announcements.consumePending() })));

  // Acuse de fin de locucion: libera el siguiente anuncio de la cola.
  ipcMain.handle('orb:announcement-finished', (_event, announcementId?: string | null) =>
    handleIPCVoid(async () => announcements.finish(announcementId ?? null)));

  ipcMain.handle('orb:show', (event) => handleIPC(async () => {
    const denied = denyIfUnauthenticated('orb:show');
    if (denied) throw new Error(denied.error);
    const mainWindow = getMainWindow();
    if (!mainWindow || mainWindow.isDestroyed() || event.sender.id !== mainWindow.webContents.id) {
      throw new Error('sender_denied');
    }
    await showOrbWindow();
    return { visible: true };
  }));

  // Voz de la orbe: se sintetiza en main (unico lugar con la key del .env).
  ipcMain.handle('orb:synthesize', (event, text: unknown) =>
    handleIPC(async () => {
      const denied = denyIfUnauthenticated('orb:synthesize');
      if (denied) throw new Error(denied.error);
      const allowedSenderIds = [getMainWindow(), getOrbWindow()]
        .filter((window): window is BrowserWindow => Boolean(window && !window.isDestroyed()))
        .map((window) => window.webContents.id);
      if (!allowedSenderIds.includes(event.sender.id)) throw new Error('sender_denied');
      if (typeof text !== 'string') throw new Error('El texto de voz no es válido.');
      const speech = text.replace(/\s+/g, ' ').trim();
      if (!speech) throw new Error('No hay texto que sintetizar.');
      const audio = await synthesizeOrbSpeech(speech);
      return {
        audioBase64: audio.audioBase64,
        mimeType: audio.mimeType,
        voiceId: audio.voiceId,
        modelId: audio.modelId,
      };
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
