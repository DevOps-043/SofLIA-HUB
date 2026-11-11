import type { WhatsAppApi } from '../../src/shared/legacy-communication';
import type { CommunicationHubApi } from '../../src/shared/communication-hub-ipc';
import type {
  PreloadBridge,
  SafeIpc,
} from './types';

export function exposeWhatsAppApi(bridge: PreloadBridge, ipc: SafeIpc): void {
  const { safeInvoke, safeOn, safeRemoveAllListeners } = ipc;
  const api: WhatsAppApi = {
    connect: () => safeInvoke('whatsapp:connect'),
    disconnect: () => safeInvoke('whatsapp:disconnect'),
    getStatus: () => safeInvoke('whatsapp:get-status'),
    getConversationHistory: (filters) => safeInvoke('whatsapp:get-conversation-history', filters ? { ...filters, since: filters.since instanceof Date ? filters.since.getTime() : filters.since, until: filters.until instanceof Date ? filters.until.getTime() : filters.until } : undefined),
    getConversationHistoryStats: (actor) => safeInvoke('whatsapp:get-conversation-history-stats', actor),
    setAllowedNumbers: (numbers, actor) => safeInvoke('whatsapp:set-allowed-numbers', numbers, actor),
    setAccessConfig: (config) => safeInvoke('whatsapp:set-access-config', config),
    setGroupConfig: (config) => safeInvoke('whatsapp:set-group-config', config),
    setPersonalization: (update) => safeInvoke('whatsapp:set-personalization', update),
    setApiKey: (apiKey: string) => safeInvoke('whatsapp:set-api-key', apiKey),
    onQR: (cb: (qr: string) => void) => safeOn('whatsapp:qr', cb),
    onStatusChange: (cb) => safeOn('whatsapp:status', cb),
    removeListeners: () => {
      safeRemoveAllListeners('whatsapp:qr');
      safeRemoveAllListeners('whatsapp:status');
    },
  };
  bridge.exposeInMainWorld('whatsApp', api);
}

export function exposeCommunicationHubApi(bridge: PreloadBridge, ipc: SafeIpc): void {
  const { safeInvoke } = ipc;
  const api: CommunicationHubApi = {
    getCapabilities: (actor) => safeInvoke('channels:get-capabilities', actor),
    getPersonalStatus: (actor) => safeInvoke('channels:get-personal-status', actor),
    updatePersonalPreferences: (actor, updates) =>
      safeInvoke('channels:update-personal-preferences', actor, updates),
    getOrgStatus: (actor) => safeInvoke('channels:get-org-status', actor),
    updateOrgConnection: (actor, update) =>
      safeInvoke('channels:update-org-connection', actor, update),
    updatePolicy: (actor, updates) => safeInvoke('channels:update-policy', actor, updates),
    listIdentities: (actor) => safeInvoke('channels:list-identities', actor),
    listHistory: (actor) => safeInvoke('channels:list-history', actor),
    sendMessage: (request) => safeInvoke('channels:send-message', request),
    scheduleMessage: (request) => safeInvoke('channels:schedule-message', request),
  };
  bridge.exposeInMainWorld('communicationHub', api);
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
