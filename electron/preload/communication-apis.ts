import type {
  PreloadBridge,
  SafeIpc,
} from './types';

export function exposeWhatsAppApi(bridge: PreloadBridge, ipc: SafeIpc): void {
  const { safeInvoke, safeOn, safeRemoveAllListeners } = ipc;
  bridge.exposeInMainWorld('whatsApp', {
    connect: () => safeInvoke('whatsapp:connect'),
    disconnect: () => safeInvoke('whatsapp:disconnect'),
    getStatus: () => safeInvoke('whatsapp:get-status'),
    getConversationHistory: (filters?: any) => safeInvoke('whatsapp:get-conversation-history', filters),
    getConversationHistoryStats: () => safeInvoke('whatsapp:get-conversation-history-stats'),
    setAllowedNumbers: (numbers: string[]) => safeInvoke('whatsapp:set-allowed-numbers', numbers),
    setAccessConfig: (config: any) => safeInvoke('whatsapp:set-access-config', config),
    setGroupConfig: (config: any) => safeInvoke('whatsapp:set-group-config', config),
    setPersonalization: (update: any) => safeInvoke('whatsapp:set-personalization', update),
    setApiKey: (apiKey: string) => safeInvoke('whatsapp:set-api-key', apiKey),
    onQR: (cb: (qr: string) => void) => safeOn('whatsapp:qr', cb),
    onStatusChange: (cb: (status: any) => void) => safeOn('whatsapp:status', cb),
    removeListeners: () => {
      safeRemoveAllListeners('whatsapp:qr');
      safeRemoveAllListeners('whatsapp:status');
    },
  });
}

export function exposeMonitoringApi(bridge: PreloadBridge, ipc: SafeIpc): void {
  const { safeInvoke, safeOn, safeRemoveAllListeners } = ipc;
  bridge.exposeInMainWorld('monitoring', {
    start: (userId: string, sessionId: string) => safeInvoke('monitoring:start', userId, sessionId),
    stop: () => safeInvoke('monitoring:stop'),
    getStatus: () => safeInvoke('monitoring:get-status'),
    setConfig: (config: any) => safeInvoke('monitoring:set-config', config),
    cleanupScreenshots: () => safeInvoke('monitoring:cleanup-screenshots'),
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
    removeListeners: () => [
      'monitoring:snapshot',
      'monitoring:session-started',
      'monitoring:session-ended',
      'monitoring:flush',
      'monitoring:error',
      'monitoring:summary-generated',
    ].forEach(safeRemoveAllListeners),
  });
}
