import { ipcMain } from 'electron';
import type { TelegramService } from './telegram-service';
import { handleIPC } from './utils/ipc-helpers';

export function registerTelegramHandlers(telegramService: TelegramService): void {
  ipcMain.handle('telegram:get-status', () =>
    handleIPC(async () => telegramService.getStatus()));

  ipcMain.handle('telegram:update-config', (_event, updates: any) =>
    handleIPC(async () => telegramService.updateConfig(updates || {})));

  ipcMain.handle('telegram:test-connection', () =>
    handleIPC(async () => telegramService.testConnection()));

  ipcMain.handle('telegram:send-message', (_event, chatId: string, text: string) =>
    handleIPC(async () => telegramService.sendMessage(String(chatId || '').trim(), String(text || ''))));

  ipcMain.handle('telegram:list-recent-chats', () =>
    handleIPC(async () => telegramService.listRecentChats()));

  console.log('[TelegramHandlers] Registered successfully');
}
