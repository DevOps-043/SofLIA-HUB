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
  setGroupConfig: (config: any) => ipcRenderer.invoke('whatsapp:set-group-config', config),
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

// --------- Monitoring API ---------
contextBridge.exposeInMainWorld('monitoring', {
  start: (userId: string, sessionId: string) =>
    ipcRenderer.invoke('monitoring:start', userId, sessionId),
  stop: () =>
    ipcRenderer.invoke('monitoring:stop'),
  getStatus: () =>
    ipcRenderer.invoke('monitoring:get-status'),
  setConfig: (config: any) =>
    ipcRenderer.invoke('monitoring:set-config', config),
  cleanupScreenshots: () =>
    ipcRenderer.invoke('monitoring:cleanup-screenshots'),
  generateSummary: (activities: any[], sessionInfo: any) =>
    ipcRenderer.invoke('monitoring:generate-summary', activities, sessionInfo),
  sendSummaryWhatsApp: (phoneNumber: string, summaryText: string) =>
    ipcRenderer.invoke('monitoring:send-summary-whatsapp', phoneNumber, summaryText),
  onSnapshot: (cb: (snapshot: any) => void) => {
    ipcRenderer.on('monitoring:snapshot', (_event, snapshot) => cb(snapshot))
  },
  onSessionStarted: (cb: (data: any) => void) => {
    ipcRenderer.on('monitoring:session-started', (_event, data) => cb(data))
  },
  onSessionEnded: (cb: (data: any) => void) => {
    ipcRenderer.on('monitoring:session-ended', (_event, data) => cb(data))
  },
  onFlush: (cb: (data: any) => void) => {
    ipcRenderer.on('monitoring:flush', (_event, data) => cb(data))
  },
  onError: (cb: (err: any) => void) => {
    ipcRenderer.on('monitoring:error', (_event, err) => cb(err))
  },
  onSummaryGenerated: (cb: (data: any) => void) => {
    ipcRenderer.on('monitoring:summary-generated', (_event, data) => cb(data))
  },
  removeListeners: () => {
    ipcRenderer.removeAllListeners('monitoring:snapshot')
    ipcRenderer.removeAllListeners('monitoring:session-started')
    ipcRenderer.removeAllListeners('monitoring:session-ended')
    ipcRenderer.removeAllListeners('monitoring:flush')
    ipcRenderer.removeAllListeners('monitoring:error')
    ipcRenderer.removeAllListeners('monitoring:summary-generated')
  },
})

// --------- Calendar API ---------
contextBridge.exposeInMainWorld('calendar', {
  connectGoogle: () => ipcRenderer.invoke('calendar:connect-google'),
  connectMicrosoft: () => ipcRenderer.invoke('calendar:connect-microsoft'),
  disconnect: (provider: string) => ipcRenderer.invoke('calendar:disconnect', provider),
  getEvents: () => ipcRenderer.invoke('calendar:get-events'),
  getConnections: () => ipcRenderer.invoke('calendar:get-connections'),
  startAuto: () => ipcRenderer.invoke('calendar:start-auto'),
  stopAuto: () => ipcRenderer.invoke('calendar:stop-auto'),
  getStatus: () => ipcRenderer.invoke('calendar:get-status'),
  createEvent: (event: any) => ipcRenderer.invoke('calendar:create-event', event),
  updateEvent: (eventId: string, updates: any) => ipcRenderer.invoke('calendar:update-event', eventId, updates),
  deleteEvent: (eventId: string, calendarId?: string) => ipcRenderer.invoke('calendar:delete-event', eventId, calendarId),
  onWorkStart: (cb: (data: any) => void) => {
    ipcRenderer.on('calendar:work-start', (_event, data) => cb(data))
  },
  onWorkEnd: (cb: (data: any) => void) => {
    ipcRenderer.on('calendar:work-end', (_event, data) => cb(data))
  },
  onConnected: (cb: (data: any) => void) => {
    ipcRenderer.on('calendar:connected', (_event, data) => cb(data))
  },
  onPoll: (cb: (data: any) => void) => {
    ipcRenderer.on('calendar:poll', (_event, data) => cb(data))
  },
  removeListeners: () => {
    ipcRenderer.removeAllListeners('calendar:work-start')
    ipcRenderer.removeAllListeners('calendar:work-end')
    ipcRenderer.removeAllListeners('calendar:connected')
    ipcRenderer.removeAllListeners('calendar:disconnected')
    ipcRenderer.removeAllListeners('calendar:poll')
    ipcRenderer.removeAllListeners('calendar:token-refreshed')
  },
})

// --------- Gmail API ---------
contextBridge.exposeInMainWorld('gmail', {
  send: (params: any) => ipcRenderer.invoke('gmail:send', params),
  getMessages: (options?: any) => ipcRenderer.invoke('gmail:get-messages', options),
  getMessage: (messageId: string) => ipcRenderer.invoke('gmail:get-message', messageId),
  modifyLabels: (messageId: string, addLabels?: string[], removeLabels?: string[]) =>
    ipcRenderer.invoke('gmail:modify-labels', messageId, addLabels, removeLabels),
  trash: (messageId: string) => ipcRenderer.invoke('gmail:trash', messageId),
  getLabels: () => ipcRenderer.invoke('gmail:get-labels'),
})

// --------- Google Drive API ---------
contextBridge.exposeInMainWorld('drive', {
  listFiles: (options?: any) => ipcRenderer.invoke('drive:list-files', options),
  search: (query: string) => ipcRenderer.invoke('drive:search', query),
  upload: (localPath: string, options?: any) => ipcRenderer.invoke('drive:upload', localPath, options),
  download: (fileId: string, destPath: string) => ipcRenderer.invoke('drive:download', fileId, destPath),
  createFolder: (name: string, parentId?: string) => ipcRenderer.invoke('drive:create-folder', name, parentId),
  deleteFile: (fileId: string) => ipcRenderer.invoke('drive:delete', fileId),
  getMetadata: (fileId: string) => ipcRenderer.invoke('drive:get-metadata', fileId),
})

// --------- Proactive Notifications API ---------
contextBridge.exposeInMainWorld('proactive', {
  getConfig: () => ipcRenderer.invoke('proactive:get-config'),
  updateConfig: (updates: any) => ipcRenderer.invoke('proactive:update-config', updates),
  triggerNow: (phoneNumber?: string) => ipcRenderer.invoke('proactive:trigger-now', phoneNumber),
  getStatus: () => ipcRenderer.invoke('proactive:get-status'),
})
