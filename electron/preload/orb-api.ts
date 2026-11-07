import type { OrbBridge } from '../../src/shared/orb';
import type { PreloadBridge, SafeIpc } from './types';

export function exposeOrbApi(bridge: PreloadBridge, ipc: SafeIpc): void {
  const { safeInvoke, safeOn, safeSend, safeRemoveAllListeners } = ipc;
  const api: OrbBridge = {
    browserCommand: (action: string) => safeInvoke('orb:browser-command', action),
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
  };
  bridge.exposeInMainWorld('orb', api);
}
