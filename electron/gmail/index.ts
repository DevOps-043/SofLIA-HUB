/**
 * API pública del paquete Gmail.
 *
 * Solo expone la clase GmailService y los tipos que consumen los callers.
 * La implementación interna (helpers, plan-storage, batch, constants) queda
 * encapsulada.
 */

export { GmailService } from './service';

export type {
  EmailMessage,
  GetMessagesOptions,
  GetMessagesResult,
  GmailOrganizationApplyResult,
  GmailOrganizationPreviewGroup,
  GmailOrganizationPreviewOptions,
  GmailOrganizationPreviewResult,
  GmailOrganizationUndoResult,
  SendEmailParams,
} from './types';
