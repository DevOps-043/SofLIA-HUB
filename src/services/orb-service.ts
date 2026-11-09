import type { BrowserVoiceAction } from '../shared/browser-voice';
import type { OrbBridge, OrbAnnouncement, OrbDictationFinal, OrbDictationPartial, OrbDictationError, OrbTtsChunk, OrbTtsEnd } from '../shared/orb';
export type { OrbAnnouncement, OrbDictationFinal, OrbDictationPartial, OrbDictationError, OrbTtsChunk, OrbTtsEnd, OrbSynthesisResult } from '../shared/orb';
declare global {
  interface Window {
    orb?: OrbBridge;
  }
}

function api(): OrbBridge {
  const bridge = window.orb;
  if (!bridge) throw new Error('La API de la orbe no está disponible en este entorno.');
  return bridge;
}

export const orbService = {
  browserCommand: (action: BrowserVoiceAction) => api().browserCommand(action),
  isAvailable(): boolean {
    return typeof window.orb !== 'undefined';
  },
  getPendingWake: () => api().getPendingWake(),
  getPendingAnnouncement: () => api().getPendingAnnouncement(),
  announcementFinished: (announcementId?: string | null) => api().announcementFinished(announcementId),
  show: () => api().show(),
  synthesize: (text: string) => api().synthesize(text),
  startDictation: () => api().startDictation(),
  stopDictation: (sessionId?: string | null) => api().stopDictation(sessionId),
  speak: (text: string) => api().speak(text),
  stopSpeaking: (speechId?: string | null) => api().stopSpeaking(speechId),
  conversationEnded: (sessionId?: string | null) => api().conversationEnded(sessionId),
  hide: () => api().hide(),
  onWake: (cb: () => void) => api().onWake(cb),
  onAnnounce: (cb: (payload: OrbAnnouncement) => void) => api().onAnnounce(cb),
  onDictationPartial: (cb: (payload: OrbDictationPartial) => void) => api().onDictationPartial(cb),
  onDictationFinal: (cb: (payload: OrbDictationFinal) => void) => api().onDictationFinal(cb),
  onDictationError: (cb: (payload: OrbDictationError) => void) => api().onDictationError(cb),
  onTtsChunk: (cb: (payload: OrbTtsChunk) => void) => api().onTtsChunk(cb),
  onTtsEnd: (cb: (payload: OrbTtsEnd) => void) => api().onTtsEnd(cb),
  removeListeners: () => api().removeListeners(),
};

