import { ipcMain, app, nativeTheme } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import type { MainRuntimeState } from './runtime-state';

export function registerMainServiceIpcHandlers(input: {
  services: any;
  state: MainRuntimeState;
  initWhatsAppAgent: (apiKey: string) => void;
}): void {
  const { services, state, initWhatsAppAgent } = input;
  ipcMain.handle('whatsapp:connect', async () => safeAsync(() => services.waService.connect()));
  ipcMain.handle('whatsapp:disconnect', async () => safeAsync(() => services.waService.disconnect()));
  ipcMain.handle('whatsapp:get-status', async () => services.waService.getStatus());
  ipcMain.handle('whatsapp:get-conversation-history', async (_event, filters?: any) =>
    safeResult(async () => {
      await requireOrgAdmin(services, filters?.actor, 'whatsapp:get-conversation-history');
      return services.waService.getConversationHistory(stripActor(filters));
    }));
  ipcMain.handle('whatsapp:get-conversation-history-stats', async (_event, actor?: any) =>
    safeResult(async () => {
      await requireOrgAdmin(services, actor, 'whatsapp:get-conversation-history-stats');
      return services.waService.getConversationHistoryStats();
    }));
  ipcMain.handle('whatsapp:set-allowed-numbers', async (_event, numbers: string[], actor?: any) => {
    const admin = await safeAdminCheck(services, actor, 'whatsapp:set-allowed-numbers');
    if (!admin.success) return admin;
    const result = await safeAsync(() => services.waService.setAllowedNumbers(numbers));
    if (result.success && numbers.length > 0) {
      const status = services.waService.getStatus() as { masterNumber?: string; allowedNumbers?: string[] };
      services.dailyBriefingService.updateConfig({ ownerNumber: status.masterNumber || status.allowedNumbers?.[0] || numbers[0] });
    }
    return result;
  });
  ipcMain.handle('whatsapp:set-access-config', async (_event, config: any) => {
    const admin = await safeAdminCheck(services, config?.actor, 'whatsapp:set-access-config');
    if (!admin.success) return admin;
    const result = await safeAsync(() => services.waService.setAccessConfig(stripActor(config)));
    if (result.success) {
      const status = services.waService.getStatus() as { masterNumber?: string; allowedNumbers?: string[] };
      if (status.masterNumber || status.allowedNumbers?.[0]) {
        services.dailyBriefingService.updateConfig({ ownerNumber: status.masterNumber || status.allowedNumbers?.[0] || '' });
      }
    }
    return result;
  });
  ipcMain.handle('whatsapp:set-group-config', async (_event, config: any) =>
    safeAsync(async () => {
      await requireOrgAdmin(services, config?.actor, 'whatsapp:set-group-config');
      await services.waService.setGroupConfig(stripActor(config));
    }));
  ipcMain.handle('whatsapp:set-personalization', async (_event, update: any) =>
    safeAsync(async () => {
      if (requiresOrgAdminForPersonalization(update)) {
        await requireOrgAdmin(services, update?.actor, 'whatsapp:set-personalization');
      }
      await services.waService.setPersonalization(stripActor(update));
    }));
  ipcMain.handle('whatsapp:set-api-key', async (_event, apiKey: string) => {
    initWhatsAppAgent(apiKey);
    await services.waService.saveApiKey(apiKey);
    return { success: true };
  });

  ipcMain.handle('proactive:get-config', async () => services.proactiveService.getConfig());
  ipcMain.handle('proactive:update-config', async (_event, updates: any) => {
    const result = await safeSync(() => services.proactiveService.updateConfig(updates));
    if (result.success && updates.notifyPhone) services.dailyBriefingService.updateConfig({ ownerNumber: updates.notifyPhone });
    return result;
  });
  ipcMain.handle('proactive:trigger-now', async (_event, phoneNumber?: string) => services.proactiveService.triggerNow(phoneNumber));
  ipcMain.handle('proactive:get-status', async () => ({
    running: services.proactiveService.isRunning(),
    config: services.proactiveService.getConfig(),
  }));
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

async function safeAsync(action: () => Promise<void>): Promise<{ success: boolean; error?: string }> {
  try {
    await action();
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function safeSync(action: () => void): Promise<{ success: boolean; error?: string }> {
  try {
    action();
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function safeResult<T>(action: () => Promise<T>): Promise<{ success: boolean; data?: T; error?: string }> {
  try {
    return { success: true, data: await action() };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function safeAdminCheck(services: any, actor: any, action: string): Promise<{ success: boolean; error?: string }> {
  try {
    await requireOrgAdmin(services, actor, action);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function requireOrgAdmin(services: any, actor: any, action: string): Promise<void> {
  if (!services.communicationHubService) return;
  const status = await services.communicationHubService.getOrgStatus(actor || undefined);
  if (!status?.success) throw new Error(status?.error || `La accion ${action} requiere rol owner o admin.`);
}

function stripActor<T>(value: T): T {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const { actor: _actor, ...rest } = value as Record<string, unknown>;
  return rest as T;
}

function requiresOrgAdminForPersonalization(update: any): boolean {
  if (!update || typeof update !== 'object') return false;
  return Boolean(
    Object.prototype.hasOwnProperty.call(update, 'whitelistEnabled') ||
    update.contactPersonalizations ||
    update.groupPersonalizations,
  );
}
