import { registerWhatsAppHandlers } from '../whatsapp-handlers';
import { ipcMain, app, nativeTheme } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import type { MainRuntimeState } from './runtime-state';
import { registerLearningLiveHandlers } from '../learning-live-handlers';

export function registerMainServiceIpcHandlers(input: {
  services: any;
  state: MainRuntimeState;
  initWhatsAppAgent: (apiKey: string) => void;
}): void {
  const { services, state, initWhatsAppAgent } = input;
  registerLearningLiveHandlers((url) => services.integratedBrowserService.createTab(url, true, undefined, { sensitive: true, waitForLoad: false }), (reference) => {
    if (state.pendingLearningSession?.session_id === reference.session_id && state.pendingLearningSession.organization_slug === reference.organization_slug)
      state.pendingLearningSession = null;
  });
  ipcMain.handle('app:get-pending-learning-session', async () => {
    // Lectura no destructiva: StrictMode puede desmontar antes de adoptar
    // la respuesta. El handler confirma consumo después de procesarla.
    return state.pendingLearningSession;
  });
  registerWhatsAppHandlers(services, () => [state.win, state.orbWin], initWhatsAppAgent);

  ipcMain.handle('app:get-pending-share-link', async () => {
    const nextShareLink = state.pendingShareLink;
    state.pendingShareLink = null;
    return nextShareLink;
  });
  ipcMain.handle('app:get-pending-meeting-trigger', async () => {
    const nextMeetingTrigger = state.pendingMeetingTrigger;
    state.pendingMeetingTrigger = null;
    return nextMeetingTrigger;
  });
  ipcMain.handle('app:get-pending-auth-callback', async () => {
    const nextAuthCallback = state.pendingAuthCallback;
    state.pendingAuthCallback = null;
    return nextAuthCallback;
  });
  ipcMain.handle('app:window-minimize', async () => {
    if (state.win && !state.win.isDestroyed()) {
      state.win.minimize();
    }
  });
  ipcMain.handle('app:window-maximize', async () => {
    if (state.win && !state.win.isDestroyed()) {
      if (state.win.isMaximized()) {
        state.win.unmaximize();
      } else {
        state.win.maximize();
      }
    }
  });
  ipcMain.handle('app:window-close', async () => {
    if (state.win && !state.win.isDestroyed()) {
      state.win.close();
    }
  });
  ipcMain.handle('app:window-is-maximized', async () => {
    if (state.win && !state.win.isDestroyed()) {
      return state.win.isMaximized();
    }
    return false;
  });
  ipcMain.handle('app:window-get-platform', async () => {
    return process.platform;
  });
  // El renderer solo aporta su `state` y su desafio: la direccion la construye
  // el main desde la configuracion, para que este canal no sirva para abrir una
  // URL arbitraria en el navegador del usuario.
  ipcMain.handle('auth:open-sso', async (_event, input: { state: string; codeChallenge: string }) => {
    const { openLearningSso } = await import('../learning-sso');
    return openLearningSso(input);
  });

  const UI_PREFS_PATH = path.join(app.getPath('userData'), 'ui-preferences.json');

  ipcMain.handle('computer:get-sidebar-position', async () => {
    try {
      if (fs.existsSync(UI_PREFS_PATH)) {
        const content = fs.readFileSync(UI_PREFS_PATH, 'utf-8');
        const data = JSON.parse(content);
        if (data && typeof data.sidebarPosition === 'string') {
          return data.sidebarPosition;
        }
      }
    } catch (err) {
      console.error('[service-ipc] Error reading UI preferences:', err);
    }
    return 'left';
  });

  ipcMain.handle('computer:set-sidebar-position', async (_event, pos: string) => {
    try {
      let data: any = {};
      if (fs.existsSync(UI_PREFS_PATH)) {
        try {
          const content = fs.readFileSync(UI_PREFS_PATH, 'utf-8');
          data = JSON.parse(content) || {};
        } catch {
          // ignore parsing error, start fresh
        }
      }
      data.sidebarPosition = pos;
      fs.writeFileSync(UI_PREFS_PATH, JSON.stringify(data, null, 2), 'utf-8');
      return true;
    } catch (err) {
      console.error('[service-ipc] Error writing UI preferences:', err);
      return false;
    }
  });

  // Set initial theme source on handler registration to match OS titlebar theme
  try {
    if (fs.existsSync(UI_PREFS_PATH)) {
      const content = fs.readFileSync(UI_PREFS_PATH, 'utf-8');
      const data = JSON.parse(content);
      if (data && typeof data.theme === 'string') {
        nativeTheme.themeSource = data.theme as 'system' | 'light' | 'dark';
      }
    }
  } catch (err) {
    console.error('[service-ipc] Error setting initial native themeSource:', err);
  }

  ipcMain.handle('computer:get-theme', async () => {
    try {
      if (fs.existsSync(UI_PREFS_PATH)) {
        const content = fs.readFileSync(UI_PREFS_PATH, 'utf-8');
        const data = JSON.parse(content);
        if (data && typeof data.theme === 'string') {
          return data.theme;
        }
      }
    } catch (err) {
      console.error('[service-ipc] Error reading UI theme preference:', err);
    }
    return 'system';
  });

  ipcMain.handle('computer:set-theme', async (_event, theme: string) => {
    try {
      let data: any = {};
      if (fs.existsSync(UI_PREFS_PATH)) {
        try {
          const content = fs.readFileSync(UI_PREFS_PATH, 'utf-8');
          data = JSON.parse(content) || {};
        } catch {
          // ignore parsing error, start fresh
        }
      }
      data.theme = theme;
      fs.writeFileSync(UI_PREFS_PATH, JSON.stringify(data, null, 2), 'utf-8');
      
      // Update Electron native window titlebar theme
      nativeTheme.themeSource = theme as 'system' | 'light' | 'dark';
      
      return true;
    } catch (err) {
      console.error('[service-ipc] Error writing UI theme preference:', err);
      return false;
    }
  });
}
