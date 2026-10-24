import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import { nativeConfirmation, trustedAppCaller } from '../ipc/caller-authorization';
import { gmailApplyOptionsSchema, gmailPlanIdSchema, gmailPreviewOptionsSchema } from '../../src/shared/gmail-organization';
import { GMAIL_PLAN_FAILURE } from './plan-context';
import type { GmailService } from './service';
import type { GmailPlanAuthorization } from './plan-context';

export function registerGmailPlanHandlers(service: GmailService, windows: () => (BrowserWindow | null)[]): void {
  const confirm = nativeConfirmation('Confirmar organización de Gmail');
  type Channel = 'gmail:preview-organization' | 'gmail:apply-organization-plan' | 'gmail:undo-organization-plan';
  const failure = (channel: Channel) => channel === 'gmail:preview-organization' ? { success: false, error: GMAIL_PLAN_FAILURE }
    : channel === 'gmail:apply-organization-plan'
      ? { success: false, planId: '', groupsApplied: 0, messagesLabeled: 0, removeFromInbox: true, labelsCreated: [], labelsReused: [], error: GMAIL_PLAN_FAILURE }
      : { success: false, planId: '', messagesRestored: 0, labelsDeleted: 0, error: GMAIL_PLAN_FAILURE };
  const handle = (channel: Channel, operation: (args: unknown[], authorization: GmailPlanAuthorization, start: () => void) => Promise<unknown>) => {
    ipcMain.handle(channel, async (event: IpcMainInvokeEvent, ...args: unknown[]) => {
      const caller = trustedAppCaller(event, windows);
      let invoked = false;
      try {
        caller.assert();
        if (!caller.parent || !caller.userId) throw new Error('context_invalid');
        const authorization: GmailPlanAuthorization = {
          userId: caller.userId, assertCurrent: caller.assert,
          signal: caller.signal,
          approve: (detail, assert) => confirm(caller.parent!, detail, assert, caller.signal),
        };
        const result = await operation(args, authorization, () => { invoked = true; });
        caller.assert(); return result;
      } catch {
        return { ...failure(channel), ...(invoked && channel !== 'gmail:preview-organization' ? { uncertain: true, recoveryRequired: true } : {}) };
      } finally { caller.dispose(); }
    });
  };
  handle('gmail:preview-organization', async (args, auth, start) => {
    if (args.length > 1) throw new Error('invalid_arguments');
    const options = gmailPreviewOptionsSchema.parse(args[0] === undefined ? {} : args[0]); start();
    return service.previewOrganizationPlan(options, auth);
  });
  handle('gmail:apply-organization-plan', async (args, auth, start) => {
    if (args.length < 1 || args.length > 2) throw new Error('invalid_arguments');
    const id = gmailPlanIdSchema.parse(args[0]); const options = gmailApplyOptionsSchema.parse(args[1] === undefined ? {} : args[1]); start();
    return service.applyOrganizationPlan(id, options, auth);
  });
  handle('gmail:undo-organization-plan', async (args, auth, start) => {
    if (args.length > 1) throw new Error('invalid_arguments');
    const id = args[0] === undefined ? undefined : gmailPlanIdSchema.parse(args[0]); start();
    return service.undoOrganizationPlan(id, auth);
  });
}
