import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import { nativeConfirmation, trustedAppCaller } from '../ipc/caller-authorization';
import { gmailBatchOptionsSchema, gmailLabelNameSchema, gmailListOptionsSchema, gmailModifyLabelsSchema, gmailObjectIdSchema } from '../../src/shared/gmail-mailbox';
import { GMAIL_OPERATION_FAILED } from './operation-progress';
import type { GmailOperationAuthorization } from './execution-context';
import type { GmailService } from './service';

export function registerGmailMailboxHandlers(service: GmailService, windows: () => (BrowserWindow | null)[]): void {
  const confirm = nativeConfirmation('Confirmar cambio en Gmail');
  const exact = (args: unknown[], count: number) => { if (args.length !== count) throw new Error('Argumentos inválidos.'); };
  const failure = (channel: string) => ({ success: false, error: GMAIL_OPERATION_FAILED,
    ...(channel === 'gmail:batch-modify-by-label' ? { processed: 0, labelDeleted: false } : {}),
    ...(channel === 'gmail:empty-and-delete-all-labels' ? { labelsProcessed: 0, labelsDeleted: 0, totalMessagesMovedToInbox: 0,
      remainingLabels: [], remainingLabelsVerified: false, errors: [GMAIL_OPERATION_FAILED] } : {}) });
  const register = <T>(channel: string, mutation: boolean, parse: (args: unknown[]) => T,
    operation: (input: T, auth: GmailOperationAuthorization) => Promise<unknown>) => {
    ipcMain.handle(channel, async (event: IpcMainInvokeEvent, ...args: unknown[]) => {
      const caller = trustedAppCaller(event, windows);
      let invoked = false, result: unknown;
      try {
        caller.assert();
        if (!caller.parent || !caller.userId) throw new Error('Contexto inválido.');
        const input = parse(args);
        const auth: GmailOperationAuthorization = { userId: caller.userId, assertCurrent: caller.assert, signal: caller.signal,
          approve: (detail, assert) => confirm(caller.parent!, detail, assert, caller.signal) };
        invoked = true; result = await operation(input, auth); caller.assert(); return result;
      } catch {
        // Tras cambiar actor no devolver contenido, nombres ni IDs de su buzón anterior.
        const known: Record<string, number | boolean> = {};
        if (mutation && result && typeof result === 'object') {
          for (const key of ['processed', 'labelsProcessed', 'labelsDeleted', 'totalMessagesMovedToInbox', 'effectsConfirmed', 'labelDeleted']) {
            const value = (result as Record<string, unknown>)[key];
            if ((typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) || typeof value === 'boolean') known[key] = value;
          }
        }
        return { ...failure(channel), ...known, ...(invoked && mutation ? { uncertain: true, recoveryRequired: true,
          ...(typeof known.effectsConfirmed === 'number' && known.effectsConfirmed > 0 ? { partial: true } : {}) } : {}) };
      } finally { caller.dispose(); }
    });
  };
  register('gmail:get-messages', false, args => {
    if (args.length > 1) throw new Error('Argumentos inválidos.');
    return gmailListOptionsSchema.parse(args[0] === undefined ? {} : args[0]);
  }, (input, auth) => service.getMessages(input, auth));
  register('gmail:get-message', false, args => { exact(args, 1); return gmailObjectIdSchema.parse(args[0]); }, (id, auth) => service.getMessage(id, auth));
  register('gmail:get-labels', false, args => { exact(args, 0); }, (_input, auth) => service.getLabels(auth));
  register('gmail:modify-labels', true, args => {
    if (args.length < 1 || args.length > 3) throw new Error('Argumentos inválidos.');
    return gmailModifyLabelsSchema.parse({ messageId: args[0], addLabels: args[1], removeLabels: args[2] });
  }, (input, auth) => service.modifyLabels(input.messageId, input.addLabels, input.removeLabels, auth));
  register('gmail:trash', true, args => { exact(args, 1); return gmailObjectIdSchema.parse(args[0]); }, (id, auth) => service.trashMessage(id, auth));
  register('gmail:create-label', true, args => { exact(args, 1); return gmailLabelNameSchema.parse(args[0]); }, (name, auth) => service.createLabel(name, auth));
  register('gmail:delete-label', true, args => { exact(args, 1); return gmailObjectIdSchema.parse(args[0]); }, (id, auth) => service.deleteLabel(id, auth));
  register('gmail:batch-modify-by-label', true, args => {
    if (args.length < 1 || args.length > 2) throw new Error('Argumentos inválidos.');
    return { id: gmailObjectIdSchema.parse(args[0]), options: gmailBatchOptionsSchema.parse(args[1] === undefined ? {} : args[1]) };
  }, (input, auth) => service.batchModifyByLabel(input.id, input.options, auth));
  register('gmail:empty-and-delete-all-labels', true, args => { exact(args, 0); }, (_input, auth) => service.emptyAndDeleteAllLabels(auth));
}
