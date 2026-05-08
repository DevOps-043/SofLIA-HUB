import { ipcMain } from 'electron';
import { handleSecurityAlertResponse } from './command-approval';
import type { PendingCommand, SendTextMessage } from './types';

interface RemoteHubIPCOptions {
  pendingApprovals: Map<string, PendingCommand>;
  sendMessage: SendTextMessage;
}

export function setupRemoteHubIPC(options: RemoteHubIPCOptions): void {
  const { pendingApprovals, sendMessage } = options;

  ipcMain.on('security-alert-response', async (_event, data: { commandId: string; approved: boolean }) => {
    await handleSecurityAlertResponse({
      commandId: data.commandId,
      approved: data.approved,
      pendingApprovals,
      sendMessage,
    });
  });
}
