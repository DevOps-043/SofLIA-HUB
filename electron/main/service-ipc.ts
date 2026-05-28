import { ipcMain } from 'electron';
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
    safeResult(() => services.waService.getConversationHistory(filters)));
  ipcMain.handle('whatsapp:get-conversation-history-stats', async () =>
    safeResult(() => services.waService.getConversationHistoryStats()));
  ipcMain.handle('whatsapp:set-allowed-numbers', async (_event, numbers: string[]) => {
    const result = await safeAsync(() => services.waService.setAllowedNumbers(numbers));
    if (result.success && numbers.length > 0) {
      const status = services.waService.getStatus() as { masterNumber?: string; allowedNumbers?: string[] };
      services.dailyBriefingService.updateConfig({ ownerNumber: status.masterNumber || status.allowedNumbers?.[0] || numbers[0] });
    }
    return result;
  });
  ipcMain.handle('whatsapp:set-access-config', async (_event, config: any) => {
    const result = await safeAsync(() => services.waService.setAccessConfig(config));
    if (result.success) {
      const status = services.waService.getStatus() as { masterNumber?: string; allowedNumbers?: string[] };
      if (status.masterNumber || status.allowedNumbers?.[0]) {
        services.dailyBriefingService.updateConfig({ ownerNumber: status.masterNumber || status.allowedNumbers?.[0] || '' });
      }
    }
    return result;
  });
  ipcMain.handle('whatsapp:set-group-config', async (_event, config: any) =>
    safeAsync(() => services.waService.setGroupConfig(config)));
  ipcMain.handle('whatsapp:set-personalization', async (_event, update: any) =>
    safeAsync(() => services.waService.setPersonalization(update)));
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
