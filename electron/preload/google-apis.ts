import type {
  PreloadBridge,
  SafeIpc,
} from './types';

export function exposeGoogleApis(bridge: PreloadBridge, ipc: SafeIpc): void {
  const { safeInvoke } = ipc;
  bridge.exposeInMainWorld('gmail', {
    send: (params: any) => safeInvoke('gmail:send', params),
    getMessages: (options?: any) => safeInvoke('gmail:get-messages', options),
    getMessage: (messageId: string) => safeInvoke('gmail:get-message', messageId),
    modifyLabels: (messageId: string, addLabels?: string[], removeLabels?: string[]) =>
      safeInvoke('gmail:modify-labels', messageId, addLabels, removeLabels),
    trash: (messageId: string) => safeInvoke('gmail:trash', messageId),
    getLabels: () => safeInvoke('gmail:get-labels'),
    createLabel: (name: string) => safeInvoke('gmail:create-label', name),
    deleteLabel: (labelId: string) => safeInvoke('gmail:delete-label', labelId),
    previewOrganization: (options?: any) => safeInvoke('gmail:preview-organization', options),
    applyOrganizationPlan: (planId: string, options?: any) =>
      safeInvoke('gmail:apply-organization-plan', planId, options),
    undoOrganizationPlan: (planId?: string) => safeInvoke('gmail:undo-organization-plan', planId),
    batchModifyByLabel: (labelId: string, options?: any) =>
      safeInvoke('gmail:batch-modify-by-label', labelId, options),
    emptyAndDeleteAllLabels: () => safeInvoke('gmail:empty-and-delete-all-labels'),
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
