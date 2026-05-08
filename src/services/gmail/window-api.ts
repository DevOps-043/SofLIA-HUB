import type {
  EmailMessage,
  GmailLabel,
  GmailOrganizationApplyResult,
  GmailOrganizationPreviewResult,
  GmailOrganizationUndoResult,
  SendEmailParams,
} from './types';

declare global {
  interface Window {
    gmail: {
      send: (params: SendEmailParams) => Promise<{ success: boolean; messageId?: string; error?: string }>;
      getMessages: (options?: { maxResults?: number; query?: string; labelIds?: string[]; pageToken?: string }) => Promise<{ success: boolean; messages?: EmailMessage[]; nextPageToken?: string; resultSizeEstimate?: number; error?: string }>;
      getMessage: (messageId: string) => Promise<{ success: boolean; message?: EmailMessage; error?: string }>;
      modifyLabels: (messageId: string, addLabels?: string[], removeLabels?: string[]) => Promise<{ success: boolean; error?: string }>;
      trash: (messageId: string) => Promise<{ success: boolean; error?: string }>;
      getLabels: () => Promise<{ success: boolean; labels?: GmailLabel[]; error?: string }>;
      createLabel: (name: string) => Promise<{ success: boolean; label?: GmailLabel; error?: string }>;
      deleteLabel: (labelId: string) => Promise<{ success: boolean; error?: string }>;
      previewOrganization: (options?: { query?: string; maxMessages?: number; minGroupSize?: number; removeFromInbox?: boolean; pageLimit?: number }) => Promise<GmailOrganizationPreviewResult>;
      applyOrganizationPlan: (planId: string, options?: { removeFromInbox?: boolean }) => Promise<GmailOrganizationApplyResult>;
      undoOrganizationPlan: (planId?: string) => Promise<GmailOrganizationUndoResult>;
      batchModifyByLabel: (labelId: string, options?: { addLabels?: string[]; removeLabels?: string[]; deleteLabel?: boolean }) => Promise<{ success: boolean; processed?: number; remaining?: number; labelDeleted?: boolean; error?: string }>;
      emptyAndDeleteAllLabels: () => Promise<{ success: boolean; labelsProcessed?: number; labelsDeleted?: number; totalMessagesMovedToInbox?: number; remainingLabels?: string[]; errors?: string[] }>;
    };
  }
}

export {};
