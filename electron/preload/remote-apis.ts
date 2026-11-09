import type { TelegramApi } from '../../src/shared/legacy-communication';
import type {
  PreloadBridge,
  SafeIpc,
} from './types';
import type { RemoteNodeApi } from '../../src/shared/remote-node';

export function exposeRemoteApis(bridge: PreloadBridge, ipc: SafeIpc): void {
  const { safeInvoke } = ipc;
  bridge.exposeInMainWorld('backgroundHost', {
    getStatus: () => safeInvoke('background-host:get-status'),
    updateConfig: (updates: { enabled?: boolean }) => safeInvoke('background-host:update-config', updates),
    repair: () => safeInvoke('background-host:repair'),
  });
  const remoteNode: RemoteNodeApi = {
    getHostStatus: () => safeInvoke('remote-node:get-host-status'),
    updateHostConfig: updates => safeInvoke('remote-node:update-host-config', updates),
    listNodes: () => safeInvoke('remote-node:list-nodes'),
    registerNode: node => safeInvoke('remote-node:register-node', node),
    removeNode: (nodeId: string) => safeInvoke('remote-node:remove-node', nodeId),
    testNode: (nodeId: string) => safeInvoke('remote-node:test-node', nodeId),
    openApplication: (nodeId, args) => safeInvoke('remote-node:open-application', nodeId, args),
    runBackgroundCommand: (nodeId, args) => safeInvoke('remote-node:run-background-command', nodeId, args),
    executeTask: (nodeId, args) => safeInvoke('remote-node:execute-task', nodeId, args),
    takeScreenshot: (nodeId, args) => safeInvoke('remote-node:take-screenshot', nodeId, args),
    listProcessSessions: (nodeId: string) => safeInvoke('remote-node:list-process-sessions', nodeId),
    pollProcessSession: (nodeId: string, sessionId: string) =>
      safeInvoke('remote-node:poll-process-session', nodeId, sessionId),
    killProcessSession: (nodeId: string, sessionId: string) =>
      safeInvoke('remote-node:kill-process-session', nodeId, sessionId),
  };
  bridge.exposeInMainWorld('remoteNode', remoteNode);
  const telegram: TelegramApi = {
    getStatus: () => safeInvoke('telegram:get-status'),
    updateConfig: (updates) => safeInvoke('telegram:update-config', updates),
    testConnection: () => safeInvoke('telegram:test-connection'),
    sendMessage: (chatId: string, text: string) => safeInvoke('telegram:send-message', chatId, text),
    listRecentChats: () => safeInvoke('telegram:list-recent-chats'),
  };
  bridge.exposeInMainWorld('telegram', telegram);
}
