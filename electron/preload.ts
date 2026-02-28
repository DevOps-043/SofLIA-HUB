import { ipcRenderer, contextBridge } from 'electron'

// --------- Security Enhancements ---------
// 1. Verificación de Aislamiento de Contexto
if (!process.contextIsolated) {
  console.error('ALERTA DE SEGURIDAD: contextIsolation debe estar habilitado en webPreferences.')
  throw new Error('contextIsolation no está habilitado.')
}

// 2. Inyección de Content Security Policy (CSP)
const injectCSP = () => {
  const meta = document.createElement('meta')
  meta.httpEquiv = 'Content-Security-Policy'
  // Política CSP estricta: bloquea unsafe-eval para mitigar XSS en componentes de IA o mensajes externos.
  meta.content = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https: http:; font-src 'self' data: https: http:; connect-src 'self' https: http: ws: wss:; object-src 'none'; base-uri 'self'; form-action 'self';"
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      document.head.appendChild(meta)
    })
  } else {
    document.head.appendChild(meta)
  }
}

injectCSP()

// 3. Strict IPC Channel Filtering (Capability-Based Security)
const ALLOWED_IPC_CHANNELS = [
  'capture-screen',
  'get-screen-sources',
  'computer:list-directory',
  'computer:read-file',
  'computer:write-file',
  'computer:create-directory',
  'computer:move-item',
  'computer:copy-item',
  'computer:delete-item',
  'computer:get-file-info',
  'computer:search-files',
  'computer:execute-command',
  'computer:open-application',
  'computer:open-url',
  'computer:get-system-info',
  'computer:clipboard-read',
  'computer:clipboard-write',
  'computer:take-screenshot',
  'computer:confirm-action',
  'computer:get-email-config',
  'computer:configure-email',
  'computer:send-email',
  'whatsapp:connect',
  'whatsapp:disconnect',
  'whatsapp:get-status',
  'whatsapp:set-allowed-numbers',
  'whatsapp:set-group-config',
  'whatsapp:set-api-key',
  'whatsapp:qr',
  'whatsapp:status',
  'monitoring:start',
  'monitoring:stop',
  'monitoring:get-status',
  'monitoring:set-config',
  'monitoring:cleanup-screenshots',
  'monitoring:generate-summary',
  'monitoring:send-summary-whatsapp',
  'monitoring:snapshot',
  'monitoring:session-started',
  'monitoring:session-ended',
  'monitoring:flush',
  'monitoring:error',
  'monitoring:summary-generated',
  'calendar:connect-google',
  'calendar:connect-microsoft',
  'calendar:disconnect',
  'calendar:get-events',
  'calendar:get-connections',
  'calendar:start-auto',
  'calendar:stop-auto',
  'calendar:get-status',
  'calendar:create-event',
  'calendar:update-event',
  'calendar:delete-event',
  'calendar:work-start',
  'calendar:work-end',
  'calendar:connected',
  'calendar:disconnected',
  'calendar:poll',
  'calendar:token-refreshed',
  'gmail:send',
  'gmail:get-messages',
  'gmail:get-message',
  'gmail:modify-labels',
  'gmail:trash',
  'gmail:get-labels',
  'drive:list-files',
  'drive:search',
  'drive:upload',
  'drive:download',
  'drive:create-folder',
  'drive:delete',
  'drive:get-metadata',
  'gchat:list-spaces',
  'gchat:get-messages',
  'gchat:send-message',
  'gchat:add-reaction',
  'gchat:get-members',
  'autodev:get-config',
  'autodev:update-config',
  'autodev:log-feedback',
  'autodev:run-now',
  'autodev:abort',
  'autodev:get-status',
  'autodev:get-history',
  'autodev:run-started',
  'autodev:run-completed',
  'autodev:status-changed',
  'autodev:micro-fix-status',
  'autodev:trigger-micro-fix',
  // Desktop Agent channels
  'desktop-agent:execute-task',
  'desktop-agent:execute-parallel',
  'desktop-agent:get-active-tasks',
  'desktop-agent:abort-task',
  'desktop-agent:abort',
  'desktop-agent:get-status',
  'desktop-agent:get-config',
  'desktop-agent:set-config',
  'desktop-agent:start-observation',
  'desktop-agent:stop-observation',
  'desktop-agent:click',
  'desktop-agent:double-click',
  'desktop-agent:right-click',
  'desktop-agent:drag',
  'desktop-agent:type',
  'desktop-agent:key',
  'desktop-agent:scroll',
  'desktop-agent:focus-window',
  'desktop-agent:list-windows',
  'desktop-agent:take-screenshot',
  // File management batch operations
  'computer:organize-files',
  'computer:batch-move-files',
  'computer:list-directory-summary',
  'proactive:get-config',
  'proactive:update-config',
  'proactive:trigger-now',
  'proactive:get-status',
  'memory:get-stats',
  'memory:compact',
  'memory:get-facts',
  'memory:delete-fact',
  'memory:search',
  'flow-send-to-chat',
  'close-flow',
  'flow-message-received',
  'flow-window-shown'
]

// 4. Payload Sanitization
const sanitizePayload = (payload: any): any => {
  if (payload === null || payload === undefined) return payload
  if (typeof payload === 'function') {
    throw new Error('Security Violation: Callbacks and functions are not allowed in IPC.')
  }
  if (Array.isArray(payload)) {
    return payload.map(sanitizePayload)
  }
  if (typeof payload === 'object') {
    // Basic sanitization via strict destructuring to strip prototypes and malicious getters
    const safeObj: Record<string, any> = { ...payload }
    for (const key in safeObj) {
      if (Object.prototype.hasOwnProperty.call(safeObj, key)) {
        safeObj[key] = sanitizePayload(safeObj[key])
      }
    }
    return safeObj
  }
  // Primitive types are naturally safe
  return payload
}

const validateChannel = (channel: string) => {
  if (!ALLOWED_IPC_CHANNELS.includes(channel)) {
    console.error(`ALERTA DE SEGURIDAD: Intento de uso de canal IPC no autorizado: ${channel}`)
    throw new Error(`Unauthorized IPC channel: ${channel}`)
  }
}

const safeInvoke = (channel: string, ...args: any[]) => {
  validateChannel(channel)
  return ipcRenderer.invoke(channel, ...args.map(sanitizePayload))
}

const safeSend = (channel: string, ...args: any[]) => {
  validateChannel(channel)
  return ipcRenderer.send(channel, ...args.map(sanitizePayload))
}

const safeOn = (channel: string, cb: (...args: any[]) => void) => {
  validateChannel(channel)
  ipcRenderer.on(channel, (_event, ...args) => cb(...args.map(sanitizePayload)))
}

const safeRemoveAllListeners = (channel: string) => {
  validateChannel(channel)
  ipcRenderer.removeAllListeners(channel)
}

// --------- Expose generic API to the Renderer process (Strictly Validated) ---------
contextBridge.exposeInMainWorld('ipcRenderer', {
  on(channel: string, listener: (...args: any[]) => void) {
    validateChannel(channel)
    return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args.map(sanitizePayload)))
  },
  off(channel: string, listener: (...args: any[]) => void) {
    validateChannel(channel)
    return ipcRenderer.off(channel, listener)
  },
  send: safeSend,
  invoke: safeInvoke,
  removeAllListeners: safeRemoveAllListeners
})

// --------- Screen Capture API ---------
contextBridge.exposeInMainWorld('screenCapture', {
  captureScreen: (sourceId?: string): Promise<string | null> => {
    return safeInvoke('capture-screen', sourceId)
  },
  getScreenSources: (): Promise<Array<{ id: string; name: string; thumbnail: string; isScreen: boolean }>> => {
    return safeInvoke('get-screen-sources')
  },
})

// --------- Computer Use API ---------
contextBridge.exposeInMainWorld('computerUse', {
  listDirectory: (dirPath: string, showHidden?: boolean) =>
    safeInvoke('computer:list-directory', dirPath, showHidden),
  readFile: (filePath: string) =>
    safeInvoke('computer:read-file', filePath),
  writeFile: (filePath: string, content: string) =>
    safeInvoke('computer:write-file', filePath, content),
  createDirectory: (dirPath: string) =>
    safeInvoke('computer:create-directory', dirPath),
  moveItem: (source: string, dest: string) =>
    safeInvoke('computer:move-item', source, dest),
  copyItem: (source: string, dest: string) =>
    safeInvoke('computer:copy-item', source, dest),
  deleteItem: (itemPath: string) =>
    safeInvoke('computer:delete-item', itemPath),
  getFileInfo: (filePath: string) =>
    safeInvoke('computer:get-file-info', filePath),
  searchFiles: (dirPath: string, pattern: string) =>
    safeInvoke('computer:search-files', dirPath, pattern),
  executeCommand: (command: string) =>
    safeInvoke('computer:execute-command', command),
  openApplication: (target: string) =>
    safeInvoke('computer:open-application', target),
  openUrl: (url: string) =>
    safeInvoke('computer:open-url', url),
  getSystemInfo: () =>
    safeInvoke('computer:get-system-info'),
  clipboardRead: () =>
    safeInvoke('computer:clipboard-read'),
  clipboardWrite: (text: string) =>
    safeInvoke('computer:clipboard-write', text),
  takeScreenshot: () =>
    safeInvoke('computer:take-screenshot'),
  confirmAction: (message: string) =>
    safeInvoke('computer:confirm-action', message),
  // Email tools
  getEmailConfig: () =>
    safeInvoke('computer:get-email-config'),
  configureEmail: (email: string, password: string) =>
    safeInvoke('computer:configure-email', email, password),
  sendEmail: (to: string, subject: string, body: string, attachmentPaths?: string[], isHtml?: boolean) =>
    safeInvoke('computer:send-email', to, subject, body, attachmentPaths, isHtml),
})

// --------- WhatsApp API ---------
contextBridge.exposeInMainWorld('whatsApp', {
  connect: () => safeInvoke('whatsapp:connect'),
  disconnect: () => safeInvoke('whatsapp:disconnect'),
  getStatus: () => safeInvoke('whatsapp:get-status'),
  setAllowedNumbers: (numbers: string[]) => safeInvoke('whatsapp:set-allowed-numbers', numbers),
  setGroupConfig: (config: any) => safeInvoke('whatsapp:set-group-config', config),
  setApiKey: (apiKey: string) => safeInvoke('whatsapp:set-api-key', apiKey),
  onQR: (cb: (qr: string) => void) => safeOn('whatsapp:qr', cb),
  onStatusChange: (cb: (status: any) => void) => safeOn('whatsapp:status', cb),
  removeListeners: () => {
    safeRemoveAllListeners('whatsapp:qr')
    safeRemoveAllListeners('whatsapp:status')
  },
})

// --------- Monitoring API ---------
contextBridge.exposeInMainWorld('monitoring', {
  start: (userId: string, sessionId: string) =>
    safeInvoke('monitoring:start', userId, sessionId),
  stop: () =>
    safeInvoke('monitoring:stop'),
  getStatus: () =>
    safeInvoke('monitoring:get-status'),
  setConfig: (config: any) =>
    safeInvoke('monitoring:set-config', config),
  cleanupScreenshots: () =>
    safeInvoke('monitoring:cleanup-screenshots'),
  generateSummary: (activities: any[], sessionInfo: any) =>
    safeInvoke('monitoring:generate-summary', activities, sessionInfo),
  sendSummaryWhatsApp: (phoneNumber: string, summaryText: string) =>
    safeInvoke('monitoring:send-summary-whatsapp', phoneNumber, summaryText),
  onSnapshot: (cb: (snapshot: any) => void) => safeOn('monitoring:snapshot', cb),
  onSessionStarted: (cb: (data: any) => void) => safeOn('monitoring:session-started', cb),
  onSessionEnded: (cb: (data: any) => void) => safeOn('monitoring:session-ended', cb),
  onFlush: (cb: (data: any) => void) => safeOn('monitoring:flush', cb),
  onError: (cb: (err: any) => void) => safeOn('monitoring:error', cb),
  onSummaryGenerated: (cb: (data: any) => void) => safeOn('monitoring:summary-generated', cb),
  removeListeners: () => {
    safeRemoveAllListeners('monitoring:snapshot')
    safeRemoveAllListeners('monitoring:session-started')
    safeRemoveAllListeners('monitoring:session-ended')
    safeRemoveAllListeners('monitoring:flush')
    safeRemoveAllListeners('monitoring:error')
    safeRemoveAllListeners('monitoring:summary-generated')
  },
})

// --------- Calendar API ---------
contextBridge.exposeInMainWorld('calendar', {
  connectGoogle: () => safeInvoke('calendar:connect-google'),
  connectMicrosoft: () => safeInvoke('calendar:connect-microsoft'),
  disconnect: (provider: string) => safeInvoke('calendar:disconnect', provider),
  getEvents: () => safeInvoke('calendar:get-events'),
  getConnections: () => safeInvoke('calendar:get-connections'),
  startAuto: () => safeInvoke('calendar:start-auto'),
  stopAuto: () => safeInvoke('calendar:stop-auto'),
  getStatus: () => safeInvoke('calendar:get-status'),
  createEvent: (event: any) => safeInvoke('calendar:create-event', event),
  updateEvent: (eventId: string, updates: any) => safeInvoke('calendar:update-event', eventId, updates),
  deleteEvent: (eventId: string, calendarId?: string) => safeInvoke('calendar:delete-event', eventId, calendarId),
  onWorkStart: (cb: (data: any) => void) => safeOn('calendar:work-start', cb),
  onWorkEnd: (cb: (data: any) => void) => safeOn('calendar:work-end', cb),
  onConnected: (cb: (data: any) => void) => safeOn('calendar:connected', cb),
  onDisconnected: (cb: (data: any) => void) => safeOn('calendar:disconnected', cb),
  onPoll: (cb: (data: any) => void) => safeOn('calendar:poll', cb),
  removeListeners: () => {
    safeRemoveAllListeners('calendar:work-start')
    safeRemoveAllListeners('calendar:work-end')
    safeRemoveAllListeners('calendar:connected')
    safeRemoveAllListeners('calendar:disconnected')
    safeRemoveAllListeners('calendar:poll')
    safeRemoveAllListeners('calendar:token-refreshed')
  },
})

// --------- Gmail API ---------
contextBridge.exposeInMainWorld('gmail', {
  send: (params: any) => safeInvoke('gmail:send', params),
  getMessages: (options?: any) => safeInvoke('gmail:get-messages', options),
  getMessage: (messageId: string) => safeInvoke('gmail:get-message', messageId),
  modifyLabels: (messageId: string, addLabels?: string[], removeLabels?: string[]) =>
    safeInvoke('gmail:modify-labels', messageId, addLabels, removeLabels),
  trash: (messageId: string) => safeInvoke('gmail:trash', messageId),
  getLabels: () => safeInvoke('gmail:get-labels'),
})

// --------- Google Drive API ---------
contextBridge.exposeInMainWorld('drive', {
  listFiles: (options?: any) => safeInvoke('drive:list-files', options),
  search: (query: string) => safeInvoke('drive:search', query),
  upload: (localPath: string, options?: any) => safeInvoke('drive:upload', localPath, options),
  download: (fileId: string, destPath: string) => safeInvoke('drive:download', fileId, destPath),
  createFolder: (name: string, parentId?: string) => safeInvoke('drive:create-folder', name, parentId),
  deleteFile: (fileId: string) => safeInvoke('drive:delete', fileId),
  getMetadata: (fileId: string) => safeInvoke('drive:get-metadata', fileId),
})

// --------- Google Chat API ---------
contextBridge.exposeInMainWorld('gchat', {
  listSpaces: () => safeInvoke('gchat:list-spaces'),
  getMessages: (spaceName: string, maxResults?: number) => safeInvoke('gchat:get-messages', spaceName, maxResults),
  sendMessage: (spaceName: string, text: string, threadName?: string) => safeInvoke('gchat:send-message', spaceName, text, threadName),
  addReaction: (messageName: string, emoji: string) => safeInvoke('gchat:add-reaction', messageName, emoji),
  getMembers: (spaceName: string) => safeInvoke('gchat:get-members', spaceName),
})

// --------- AutoDev API ---------
contextBridge.exposeInMainWorld('autodev', {
  getConfig: () => safeInvoke('autodev:get-config'),
  updateConfig: (updates: any) => safeInvoke('autodev:update-config', updates),
  logFeedback: (suggestion: string) => safeInvoke('autodev:log-feedback', suggestion),
  runNow: () => safeInvoke('autodev:run-now'),
  abort: () => safeInvoke('autodev:abort'),
  getStatus: () => safeInvoke('autodev:get-status'),
  getHistory: () => safeInvoke('autodev:get-history'),
  getMicroFixStatus: () => safeInvoke('autodev:micro-fix-status'),
  triggerMicroFix: (trigger: any) => safeInvoke('autodev:trigger-micro-fix', trigger),
  onRunStarted: (cb: (run: any) => void) => safeOn('autodev:run-started', cb),
  onRunCompleted: (cb: (run: any) => void) => safeOn('autodev:run-completed', cb),
  onStatusChanged: (cb: (data: any) => void) => safeOn('autodev:status-changed', cb),
  removeListeners: () => {
    safeRemoveAllListeners('autodev:run-started')
    safeRemoveAllListeners('autodev:run-completed')
    safeRemoveAllListeners('autodev:status-changed')
  },
})

// --------- Desktop Agent API ---------
contextBridge.exposeInMainWorld('desktopAgent', {
  executeTask: (task: string, options?: any) => safeInvoke('desktop-agent:execute-task', task, options),
  executeParallel: (tasks: Array<{ task: string; maxSteps?: number }>) => safeInvoke('desktop-agent:execute-parallel', tasks),
  getActiveTasks: () => safeInvoke('desktop-agent:get-active-tasks'),
  abortTask: (taskId: string) => safeInvoke('desktop-agent:abort-task', taskId),
  abort: () => safeInvoke('desktop-agent:abort'),
  getStatus: () => safeInvoke('desktop-agent:get-status'),
  getConfig: () => safeInvoke('desktop-agent:get-config'),
  setConfig: (updates: any) => safeInvoke('desktop-agent:set-config', updates),
  startObservation: (objective: string, rules?: string) => safeInvoke('desktop-agent:start-observation', objective, rules),
  stopObservation: () => safeInvoke('desktop-agent:stop-observation'),
  click: (x: number, y: number) => safeInvoke('desktop-agent:click', x, y),
  doubleClick: (x: number, y: number) => safeInvoke('desktop-agent:double-click', x, y),
  rightClick: (x: number, y: number) => safeInvoke('desktop-agent:right-click', x, y),
  drag: (x1: number, y1: number, x2: number, y2: number) => safeInvoke('desktop-agent:drag', x1, y1, x2, y2),
  type: (text: string) => safeInvoke('desktop-agent:type', text),
  key: (key: string) => safeInvoke('desktop-agent:key', key),
  scroll: (direction: string, amount?: number) => safeInvoke('desktop-agent:scroll', direction, amount),
  focusWindow: (title: string) => safeInvoke('desktop-agent:focus-window', title),
  listWindows: () => safeInvoke('desktop-agent:list-windows'),
  takeScreenshot: (fullRes?: boolean) => safeInvoke('desktop-agent:take-screenshot', fullRes),
})

// --------- Proactive Notifications API ---------
contextBridge.exposeInMainWorld('proactive', {
  getConfig: () => safeInvoke('proactive:get-config'),
  updateConfig: (updates: any) => safeInvoke('proactive:update-config', updates),
  triggerNow: (phoneNumber?: string) => safeInvoke('proactive:trigger-now', phoneNumber),
  getStatus: () => safeInvoke('proactive:get-status'),
})

// --------- Memory API ---------
contextBridge.exposeInMainWorld('memory', {
  getStats: (sessionKey?: string) => safeInvoke('memory:get-stats', sessionKey),
  compact: (daysToKeep?: number) => safeInvoke('memory:compact', daysToKeep),
  getFacts: (phoneNumber: string) => safeInvoke('memory:get-facts', phoneNumber),
  deleteFact: (factId: number) => safeInvoke('memory:delete-fact', factId),
  search: (sessionKey: string, phoneNumber: string, query: string) => safeInvoke('memory:search', sessionKey, phoneNumber, query),
})

// --------- Flow API ---------
contextBridge.exposeInMainWorld('flow', {
  sendToChat: (text: string) => safeSend('flow-send-to-chat', text),
  close: () => safeSend('close-flow'),
  onMessageReceived: (cb: (text: string) => void) => safeOn('flow-message-received', cb),
  onWindowShown: (cb: () => void) => safeOn('flow-window-shown', cb),
  removeListeners: () => {
    safeRemoveAllListeners('flow-message-received')
    safeRemoveAllListeners('flow-window-shown')
  }
})
