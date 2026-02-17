import { ipcRenderer, contextBridge } from 'electron'

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('ipcRenderer', {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args
    return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args))
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, ...omit] = args
    return ipcRenderer.off(channel, ...omit)
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args
    return ipcRenderer.send(channel, ...omit)
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args
    return ipcRenderer.invoke(channel, ...omit)
  },
})

// --------- Screen Capture API ---------
contextBridge.exposeInMainWorld('screenCapture', {
  captureScreen: (sourceId?: string): Promise<string | null> => {
    return ipcRenderer.invoke('capture-screen', sourceId)
  },
  getScreenSources: (): Promise<Array<{ id: string; name: string; thumbnail: string; isScreen: boolean }>> => {
    return ipcRenderer.invoke('get-screen-sources')
  },
})

// --------- Computer Use API ---------
contextBridge.exposeInMainWorld('computerUse', {
  listDirectory: (dirPath: string, showHidden?: boolean) =>
    ipcRenderer.invoke('computer:list-directory', dirPath, showHidden),
  readFile: (filePath: string) =>
    ipcRenderer.invoke('computer:read-file', filePath),
  writeFile: (filePath: string, content: string) =>
    ipcRenderer.invoke('computer:write-file', filePath, content),
  createDirectory: (dirPath: string) =>
    ipcRenderer.invoke('computer:create-directory', dirPath),
  moveItem: (source: string, dest: string) =>
    ipcRenderer.invoke('computer:move-item', source, dest),
  copyItem: (source: string, dest: string) =>
    ipcRenderer.invoke('computer:copy-item', source, dest),
  deleteItem: (itemPath: string) =>
    ipcRenderer.invoke('computer:delete-item', itemPath),
  getFileInfo: (filePath: string) =>
    ipcRenderer.invoke('computer:get-file-info', filePath),
  searchFiles: (dirPath: string, pattern: string) =>
    ipcRenderer.invoke('computer:search-files', dirPath, pattern),
  executeCommand: (command: string) =>
    ipcRenderer.invoke('computer:execute-command', command),
  openApplication: (target: string) =>
    ipcRenderer.invoke('computer:open-application', target),
  openUrl: (url: string) =>
    ipcRenderer.invoke('computer:open-url', url),
  getSystemInfo: () =>
    ipcRenderer.invoke('computer:get-system-info'),
  clipboardRead: () =>
    ipcRenderer.invoke('computer:clipboard-read'),
  clipboardWrite: (text: string) =>
    ipcRenderer.invoke('computer:clipboard-write', text),
  takeScreenshot: () =>
    ipcRenderer.invoke('computer:take-screenshot'),
  confirmAction: (message: string) =>
    ipcRenderer.invoke('computer:confirm-action', message),
  // Email tools
  getEmailConfig: () =>
    ipcRenderer.invoke('computer:get-email-config'),
  configureEmail: (email: string, password: string) =>
    ipcRenderer.invoke('computer:configure-email', email, password),
  sendEmail: (to: string, subject: string, body: string, attachmentPaths?: string[], isHtml?: boolean) =>
    ipcRenderer.invoke('computer:send-email', to, subject, body, attachmentPaths, isHtml),
})

// --------- WhatsApp API ---------
contextBridge.exposeInMainWorld('whatsApp', {
  connect: () => ipcRenderer.invoke('whatsapp:connect'),
  disconnect: () => ipcRenderer.invoke('whatsapp:disconnect'),
  getStatus: () => ipcRenderer.invoke('whatsapp:get-status'),
  setAllowedNumbers: (numbers: string[]) => ipcRenderer.invoke('whatsapp:set-allowed-numbers', numbers),
  setApiKey: (apiKey: string) => ipcRenderer.invoke('whatsapp:set-api-key', apiKey),
  onQR: (cb: (qr: string) => void) => {
    ipcRenderer.on('whatsapp:qr', (_event, qr) => cb(qr))
  },
  onStatusChange: (cb: (status: any) => void) => {
    ipcRenderer.on('whatsapp:status', (_event, status) => cb(status))
  },
  removeListeners: () => {
    ipcRenderer.removeAllListeners('whatsapp:qr')
    ipcRenderer.removeAllListeners('whatsapp:status')
  },
})
