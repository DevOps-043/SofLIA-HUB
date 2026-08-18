import type {
  PreloadBridge,
  SafeIpc,
} from './types';

export function exposeUtilityApis(bridge: PreloadBridge, ipc: SafeIpc): void {
  const { safeInvoke, safeOn, safeRemoveAllListeners, safeSend } = ipc;
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
  // Voz pasiva local (runtime Python + Vosk + Piper): configuracion desde settings.
  bridge.exposeInMainWorld('voicePassive', {
    getStatus: () => safeInvoke('voice:get-status'),
    setConfig: (updates: { enabled?: boolean; wakeWords?: string[]; modelPath?: string; micDevice?: string | number | null; ttsVoice?: string; ttsSpeed?: number }) =>
      safeInvoke('voice:set-config', updates),
    start: () => safeInvoke('voice:start'),
    stop: () => safeInvoke('voice:stop'),
    installModel: (size?: 'small' | 'large') => safeInvoke('voice:install-model', size),
    installTtsVoice: (voiceId: string) => safeInvoke('voice:install-tts-voice', voiceId),
    listTtsVoices: () => safeInvoke('voice:list-tts-voices'),
    listMicDevices: () => safeInvoke('voice:list-mic-devices'),
    testMic: (device: string | number | null) => safeInvoke('voice:test-mic', device),
  });
  // Sidecar de herramientas Python: documentos (PDF/Office) y privacidad (PII).
  bridge.exposeInMainWorld('pythonTools', {
    getStatus: () => safeInvoke('pytools:status'),
    parseDocument: (filePath: string) => safeInvoke('pytools:parse-document', filePath),
    redactText: (text: string) => safeInvoke('pytools:redact-text', text),
    getPrivacyConfig: () => safeInvoke('pytools:get-privacy-config'),
    setPrivacyConfig: (updates: { redactDocuments?: boolean }) =>
      safeInvoke('pytools:set-privacy-config', updates),
  });
  // Ventana de la Orbe de Voz: dictado local (Vosk) + habla local (Piper).
  bridge.exposeInMainWorld('orb', {
    getPendingWake: () => safeInvoke('orb:get-pending-wake'),
    getPendingAnnouncement: () => safeInvoke('orb:get-pending-announcement'),
    announcementFinished: (announcementId?: string | null) =>
      safeInvoke('orb:announcement-finished', announcementId),
    show: () => safeInvoke('orb:show'),
    synthesize: (text: string) => safeInvoke('orb:synthesize', text),
    startDictation: () => safeInvoke('orb:start-dictation'),
    stopDictation: (sessionId?: string | null) => safeInvoke('orb:stop-dictation', sessionId),
    speak: (text: string) => safeInvoke('orb:speak', text),
    stopSpeaking: (speechId?: string | null) => safeInvoke('orb:stop-speaking', speechId),
    conversationEnded: (sessionId?: string | null) => safeInvoke('orb:conversation-ended', sessionId),
    hide: () => safeSend('orb:hide'),
    onWake: (cb: () => void) => safeOn('orb:wake', cb),
    onAnnounce: (cb: (payload: { id: string; title: string; text: string; createdAt: string }) => void) =>
      safeOn('orb:announce', cb),
    onDictationPartial: (cb: (payload: { sessionId: string; text: string }) => void) => safeOn('orb:dictation-partial', cb),
    onDictationFinal: (cb: (payload: { sessionId: string; text: string; reason: string }) => void) => safeOn('orb:dictation-final', cb),
    onDictationError: (cb: (payload: { sessionId: string; reason: string }) => void) => safeOn('orb:dictation-error', cb),
    onTtsChunk: (cb: (payload: { speechId: string; index: number; total: number; sampleRate: number; audioBase64: string }) => void) => safeOn('orb:tts-chunk', cb),
    onTtsEnd: (cb: (payload: { speechId: string; interrupted: boolean; error?: string }) => void) => safeOn('orb:tts-end', cb),
    removeListeners: () => [
      'orb:wake', 'orb:announce', 'orb:dictation-partial', 'orb:dictation-final',
      'orb:dictation-error', 'orb:tts-chunk', 'orb:tts-end',
    ].forEach(safeRemoveAllListeners),
  });
}
