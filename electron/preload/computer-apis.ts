import type {
  PreloadBridge,
  SafeIpc,
} from './types';

export function exposeComputerApis(bridge: PreloadBridge, ipc: SafeIpc): void {
  const { safeInvoke } = ipc;
  bridge.exposeInMainWorld('computerUse', {
    listDirectory: (dirPath: string, showHidden?: boolean) => safeInvoke('computer:list-directory', dirPath, showHidden),
    readFile: (filePath: string) => safeInvoke('computer:read-file', filePath),
    writeFile: (filePath: string, content: string) => safeInvoke('computer:write-file', filePath, content),
    createWordDocument: (options: any) => safeInvoke('computer:create-word-document', options),
    createDirectory: (dirPath: string) => safeInvoke('computer:create-directory', dirPath),
    moveItem: (source: string, dest: string) => safeInvoke('computer:move-item', source, dest),
    copyItem: (source: string, dest: string) => safeInvoke('computer:copy-item', source, dest),
    deleteItem: (itemPath: string) => safeInvoke('computer:delete-item', itemPath),
    getFileInfo: (filePath: string) => safeInvoke('computer:get-file-info', filePath),
    searchFiles: (dirPath: string, pattern: string) => safeInvoke('computer:search-files', dirPath, pattern),
    executeCommand: (command: string) => safeInvoke('computer:execute-command', command),
    openApplication: (target: string) => safeInvoke('computer:open-application', target),
    openUrl: (url: string) => safeInvoke('computer:open-url', url),
    runBackgroundCommand: (options: any) => safeInvoke('computer:run-background-command', options),
    listProcessSessions: () => safeInvoke('computer:list-process-sessions'),
    pollProcessSession: (sessionId: string) => safeInvoke('computer:poll-process-session', sessionId),
    killProcessSession: (sessionId: string) => safeInvoke('computer:kill-process-session', sessionId),
    getSystemInfo: () => safeInvoke('computer:get-system-info'),
    clipboardRead: () => safeInvoke('computer:clipboard-read'),
    clipboardWrite: (text: string) => safeInvoke('computer:clipboard-write', text),
    takeScreenshot: () => safeInvoke('computer:take-screenshot'),
    confirmAction: (message: string) => safeInvoke('computer:confirm-action', message),
    organizeFiles: (options: any) => safeInvoke('computer:organize-files', options),
    batchMoveFiles: (options: any) => safeInvoke('computer:batch-move-files', options),
    listDirectorySummary: (options: any) => safeInvoke('computer:list-directory-summary', options),
    undoLastFileOperation: (options?: any) => safeInvoke('computer:undo-last-file-operation', options),
    getEmailConfig: () => safeInvoke('computer:get-email-config'),
    configureEmail: (email: string, password: string) => safeInvoke('computer:configure-email', email, password),
    sendEmail: (to: string, subject: string, body: string, attachmentPaths?: string[], isHtml?: boolean) =>
      safeInvoke('computer:send-email', to, subject, body, attachmentPaths, isHtml),
    getSidebarPosition: () => safeInvoke('computer:get-sidebar-position'),
    setSidebarPosition: (position: string) => safeInvoke('computer:set-sidebar-position', position),
    getTheme: () => safeInvoke('computer:get-theme'),
    setTheme: (theme: string) => safeInvoke('computer:set-theme', theme),
  });
}
