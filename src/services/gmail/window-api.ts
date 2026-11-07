import type {
  GmailOrganizationApplyResult,
  GmailOrganizationPreviewResult,
  GmailOrganizationUndoResult,
  SendEmailParams,
} from './types';
import type { GmailSendResult } from '../../shared/gmail-delivery';
import type { GmailOrganizationPreviewOptions } from '../../shared/gmail-organization';
import type { GmailListOptions, GmailMessagesResult, GmailMessageResult, GmailLabelsResult, GmailOperationResult,
  GmailCreateLabelResult, GmailBatchOptions, GmailBatchResult, GmailEmptyLabelsResult } from '../../shared/gmail-mailbox';

declare global {
  interface Window {
    gmail: {
      send: (params: SendEmailParams) => Promise<GmailSendResult>;
      getMessages: (options?: GmailListOptions) => Promise<GmailMessagesResult>;
      getMessage: (messageId: string) => Promise<GmailMessageResult>;
      modifyLabels: (messageId: string, addLabels?: string[], removeLabels?: string[]) => Promise<GmailOperationResult>;
      trash: (messageId: string) => Promise<GmailOperationResult>;
      getLabels: () => Promise<GmailLabelsResult>;
      createLabel: (name: string) => Promise<GmailCreateLabelResult>;
      deleteLabel: (labelId: string) => Promise<GmailOperationResult>;
      previewOrganization: (options?: GmailOrganizationPreviewOptions) => Promise<GmailOrganizationPreviewResult>;
      applyOrganizationPlan: (planId: string, options?: { removeFromInbox?: boolean }) => Promise<GmailOrganizationApplyResult>;
      undoOrganizationPlan: (planId?: string) => Promise<GmailOrganizationUndoResult>;
      batchModifyByLabel: (labelId: string, options?: GmailBatchOptions) => Promise<GmailBatchResult>;
      emptyAndDeleteAllLabels: () => Promise<GmailEmptyLabelsResult>;
    };
  }
}

export {};
