import { ipcMain } from 'electron';
import type { CommunicationHubService } from './communication-hub/service';
import { handleIPC } from './utils/ipc-helpers';

export function registerCommunicationHubHandlers(service: CommunicationHubService): void {
  ipcMain.handle('channels:get-capabilities', (_event, actor?: any) =>
    handleIPC(async () => service.getCapabilities(actor || undefined)));

  ipcMain.handle('channels:get-personal-status', (_event, actor?: any) =>
    handleIPC(async () => service.getPersonalStatus(actor || undefined)));

  ipcMain.handle('channels:update-personal-preferences', (_event, actor: any, updates: any) =>
    handleIPC(async () => service.updatePersonalPreferences(actor || undefined, updates || {})));

  ipcMain.handle('channels:get-org-status', (_event, actor?: any) =>
    handleIPC(async () => service.getOrgStatus(actor || undefined)));

  ipcMain.handle('channels:update-org-connection', (_event, actor: any, update: any) =>
    handleIPC(async () => service.updateOrgConnection(actor || undefined, update || {})));

  ipcMain.handle('channels:update-policy', (_event, actor: any, updates: any) =>
    handleIPC(async () => service.updatePolicy(actor || undefined, updates || {})));

  ipcMain.handle('channels:list-identities', (_event, actor?: any) =>
    handleIPC(async () => service.listIdentities(actor || undefined)));

  ipcMain.handle('channels:list-history', (_event, actor?: any) =>
    handleIPC(async () => service.listHistory(actor || undefined)));

  ipcMain.handle('channels:send-message', (_event, request: any) =>
    handleIPC(async () => service.sendMessage(request || {})));

  ipcMain.handle('channels:schedule-message', (_event, request: any) =>
    handleIPC(async () => service.scheduleMessage(request || {})));

  console.log('[CommunicationHubHandlers] Registered successfully');
}
