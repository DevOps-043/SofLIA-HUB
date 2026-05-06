/**
 * Barrel re-export del paquete `./gmail`.
 *
 * Preserva los imports históricos (`from './gmail-service'`). La implementación
 * real vive en submódulos cohesivos dentro de `./gmail/`. Cualquier código
 * nuevo debería importar directamente de `./gmail`.
 */

export { GmailService } from './gmail';
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
} from './gmail';
