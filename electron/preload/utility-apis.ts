import { exposePythonToolsApi } from './python-tools-api';
import { exposeOrbApi } from './orb-api';
import { exposeLocalVoiceApi } from './local-voice-api';
import type {
  PreloadBridge,
  SafeIpc,
} from './types';

export function exposeUtilityApis(bridge: PreloadBridge, ipc: SafeIpc): void {
  const { safeInvoke, safeOn, safeRemoveAllListeners } = ipc;
  bridge.exposeInMainWorld('memory', {
    getStats: (sessionKey?: string) => safeInvoke('memory:get-stats', sessionKey),
    compact: (daysToKeep?: number) => safeInvoke('memory:compact', daysToKeep),
    getFacts: (phoneNumber: string) => safeInvoke('memory:get-facts', phoneNumber),
    deleteFact: (factId: number) => safeInvoke('memory:delete-fact', factId),
    search: (sessionKey: string, phoneNumber: string, query: string) =>
      safeInvoke('memory:search', sessionKey, phoneNumber, query),
    // Memoria unificada del usuario (chat de la app comparte motor con WhatsApp).
    listSkills: (ownerKey: string) => safeInvoke('memory:list-skills', ownerKey),
    deleteSkill: (skillId: number) => safeInvoke('memory:delete-skill', skillId),
    getContext: (ownerKey: string, sessionKey: string, currentMessage: string) =>
      safeInvoke('memory:context', ownerKey, sessionKey, currentMessage),
    recordTurn: (ownerKey: string, sessionKey: string, userText: string, assistantText: string) =>
      safeInvoke('memory:record-turn', ownerKey, sessionKey, userText, assistantText),
    setCurrentUser: (userId: string | null) => safeInvoke('memory:set-current-user', userId),
    // Skills ejecutables (recetas reutilizables con HITL vía Workspace Automation).
    saveExecutableSkill: (ownerKey: string, title: string, summary: string, templateId: string | null, triggerContext?: string) =>
      safeInvoke('memory:save-executable-skill', ownerKey, title, summary, templateId, triggerContext),
    listExecutableSkills: (ownerKey: string) => safeInvoke('memory:list-executable-skills', ownerKey),
    matchExecutableSkill: (ownerKey: string, request: string) => safeInvoke('memory:match-executable-skill', ownerKey, request),
    runExecutableSkill: (ownerKey: string, skillId: number, request: string) =>
      safeInvoke('memory:run-executable-skill', ownerKey, skillId, request),
  });
  bridge.exposeInMainWorld('updater', {
    checkForUpdates: () => safeInvoke('updater:check-for-updates'),
    downloadUpdate: () => safeInvoke('updater:download-update'),
    installUpdate: () => safeInvoke('updater:install-update'),
    getStatus: () => safeInvoke('updater:get-status'),
    onUpdateAvailable: (cb: (info: any) => void) => safeOn('updater:update-available', cb),
    onDownloadProgress: (cb: (progress: any) => void) => safeOn('updater:download-progress', cb),
    onUpdateDownloaded: (cb: (info: any) => void) => safeOn('updater:update-downloaded', cb),
    onError: (cb: (err: any) => void) => safeOn('updater:error', cb),
    removeListeners: () => [
      'updater:update-available',
      'updater:download-progress',
      'updater:update-downloaded',
      'updater:error',
    ].forEach(safeRemoveAllListeners),
  });
  exposeLocalVoiceApi(bridge, ipc);
  exposePythonToolsApi(bridge, ipc);
  exposeOrbApi(bridge, ipc);
}


