import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import type { GmailService } from './gmail-service';
import { nativeConfirmation, trustedAppCaller } from './ipc/caller-authorization';
import { gmailSendSchema } from '../src/shared/gmail-delivery';
import { GMAIL_SEND_FAILED } from './gmail/delivery';
import { registerGmailMailboxHandlers, registerGmailPlanHandlers } from './gmail';
import { createLogger } from './utils/logger';

export function registerGmailHandlers(gmailService: GmailService, getMainWindow: () => BrowserWindow | null,
  getOrbWindow: () => BrowserWindow | null = () => null): void {
  const windows = () => [getMainWindow(), getOrbWindow()];
  const confirm = nativeConfirmation('Confirmar envío de correo');
  ipcMain.handle('gmail:send', async (event: IpcMainInvokeEvent, ...args: unknown[]) => {
    const caller = trustedAppCaller(event, windows);
    try {
      caller.assert();
      if (args.length !== 1 || !caller.parent || !caller.userId) throw new Error('invalid_send');
      const params = gmailSendSchema.parse(args[0]);
      return await gmailService.sendEmail(params, {
        userId: caller.userId, assertCurrent: caller.assert, signal: caller.signal,
        approve: (detail, assert) => confirm(caller.parent!, detail, assert, caller.signal),
      });
    } catch { return { success: false, error: GMAIL_SEND_FAILED }; }
    finally { caller.dispose(); }
  });
  registerGmailMailboxHandlers(gmailService, windows);
  registerGmailPlanHandlers(gmailService, windows);
  createLogger('gmail-ipc').info('Canales Gmail registrados.');
}
