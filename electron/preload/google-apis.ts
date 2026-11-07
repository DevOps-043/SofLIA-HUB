import type {
  PreloadBridge,
  SafeIpc,
} from './types';
import type { SendEmailParams, GmailSendResult } from '../../src/shared/gmail-delivery';
import type { GmailOrganizationPreviewOptions, GmailOrganizationPreviewResult, GmailOrganizationApplyResult, GmailOrganizationUndoResult } from '../../src/shared/gmail-organization';
import type { GmailListOptions, GmailMessagesResult, GmailMessageResult, GmailLabelsResult, GmailOperationResult,
  GmailCreateLabelResult, GmailBatchOptions, GmailBatchResult, GmailEmptyLabelsResult } from '../../src/shared/gmail-mailbox';

export function exposeGoogleApis(bridge: PreloadBridge, ipc: SafeIpc): void {
  const { safeInvoke } = ipc;
  bridge.exposeInMainWorld('gmail', {
    send: (params: SendEmailParams): Promise<GmailSendResult> => safeInvoke('gmail:send', params),
    getMessages: (options?: GmailListOptions): Promise<GmailMessagesResult> => safeInvoke('gmail:get-messages', options),
    getMessage: (messageId: string): Promise<GmailMessageResult> => safeInvoke('gmail:get-message', messageId),
    modifyLabels: (messageId: string, addLabels?: string[], removeLabels?: string[]): Promise<GmailOperationResult> =>
      safeInvoke('gmail:modify-labels', messageId, addLabels, removeLabels),
    trash: (messageId: string): Promise<GmailOperationResult> => safeInvoke('gmail:trash', messageId),
    getLabels: (): Promise<GmailLabelsResult> => safeInvoke('gmail:get-labels'),
    createLabel: (name: string): Promise<GmailCreateLabelResult> => safeInvoke('gmail:create-label', name),
    deleteLabel: (labelId: string): Promise<GmailOperationResult> => safeInvoke('gmail:delete-label', labelId),
    previewOrganization: (options?: GmailOrganizationPreviewOptions): Promise<GmailOrganizationPreviewResult> => safeInvoke('gmail:preview-organization', options),
    applyOrganizationPlan: (planId: string, options?: { removeFromInbox?: boolean }): Promise<GmailOrganizationApplyResult> =>
      safeInvoke('gmail:apply-organization-plan', planId, options),
    undoOrganizationPlan: (planId?: string): Promise<GmailOrganizationUndoResult> => safeInvoke('gmail:undo-organization-plan', planId),
    batchModifyByLabel: (labelId: string, options?: GmailBatchOptions): Promise<GmailBatchResult> =>
      safeInvoke('gmail:batch-modify-by-label', labelId, options),
    emptyAndDeleteAllLabels: (): Promise<GmailEmptyLabelsResult> => safeInvoke('gmail:empty-and-delete-all-labels'),
  });
  bridge.exposeInMainWorld('drive', {
    listFiles: (options?: any) => safeInvoke('drive:list-files', options),
    search: (query: string) => safeInvoke('drive:search', query),
    upload: (localPath: string, options?: any) => safeInvoke('drive:upload', localPath, options),
    download: (fileId: string, destPath: string, format?: 'text' | 'pdf') =>
      safeInvoke('drive:download', fileId, destPath, format),
    createFolder: (name: string, parentId?: string) => safeInvoke('drive:create-folder', name, parentId),
    deleteFile: (fileId: string) => safeInvoke('drive:delete', fileId),
    getMetadata: (fileId: string) => safeInvoke('drive:get-metadata', fileId),
  });
  bridge.exposeInMainWorld('gchat', {
    listSpaces: () => safeInvoke('gchat:list-spaces'),
    getMessages: (spaceName: string, maxResults?: number) => safeInvoke('gchat:get-messages', spaceName, maxResults),
    sendMessage: (spaceName: string, text: string, threadName?: string) =>
      safeInvoke('gchat:send-message', spaceName, text, threadName),
    addReaction: (messageName: string, emoji: string) => safeInvoke('gchat:add-reaction', messageName, emoji),
    getMembers: (spaceName: string) => safeInvoke('gchat:get-members', spaceName),
  });
}
