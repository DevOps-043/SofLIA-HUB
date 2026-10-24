export type { GmailEmailMessage as EmailMessage, GmailListOptions, GmailMessagesResult,
  GmailMessageResult, GmailLabelsResult, GmailOperationResult, GmailCreateLabelResult,
  GmailBatchOptions, GmailBatchResult, GmailEmptyLabelsResult } from '../../shared/gmail-mailbox';

export type { SendEmailParams, GmailSendResult } from '../../shared/gmail-delivery';

export interface GmailLabel {
  id: string;
  name: string;
}

export type {
  GmailOrganizationPreviewGroup, GmailOrganizationPreviewResult, GmailOrganizationApplyResult,
  GmailOrganizationUndoResult, GmailOrganizationPreviewOptions,
} from '../../shared/gmail-organization';
