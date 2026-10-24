import type { BrowserVoiceAction, BrowserVoiceResult } from './browser-voice';
export interface OrbDictationFinal {
  sessionId: string;
  text: string;
  reason: string;
}

export interface OrbDictationPartial {
  sessionId: string;
  text: string;
}

export interface OrbDictationError {
  sessionId: string;
  reason: string;
}

export interface OrbTtsChunk {
  speechId: string;
  index: number;
  total: number;
  sampleRate: number;
  audioBase64: string;
}

export interface OrbTtsEnd {
  speechId: string;
  interrupted: boolean;
  error?: string;
}

export interface OrbSynthesisResult {
  success: boolean;
  /** MP3 en base64 devuelto por ElevenLabs a través de Electron main. */
  audioBase64?: string;
  mimeType?: 'audio/mpeg';
  voiceId?: string;
  modelId?: string;
  error?: string;
}

/**
 * Anuncio proactivo: SofLIA se dirige al usuario sin que él haya iniciado la
 * conversación, porque una Skill pasiva con el canal Computadora activo produjo
 * un resultado.
 */
export interface OrbAnnouncement {
  id: string;
  title: string;
  text: string;
  createdAt: string;
}

export interface OrbBridge {
  browserCommand: (action: BrowserVoiceAction) => Promise<BrowserVoiceResult>;
  show: () => Promise<{ success: boolean; visible?: boolean; error?: string }>;
  getPendingWake: () => Promise<{ success: boolean; wake?: boolean }>;
  getPendingAnnouncement: () => Promise<{ success: boolean; announcement?: OrbAnnouncement | null }>;
  announcementFinished: (announcementId?: string | null) => Promise<{ success: boolean }>;
  synthesize: (text: string) => Promise<OrbSynthesisResult>;
  startDictation: () => Promise<{ success: boolean; sessionId?: string; error?: string }>;
  stopDictation: (sessionId?: string | null) => Promise<{ success: boolean }>;
  speak: (text: string) => Promise<{ success: boolean; speechId?: string; error?: string }>;
  stopSpeaking: (speechId?: string | null) => Promise<{ success: boolean }>;
  conversationEnded: (sessionId?: string | null) => Promise<{ success: boolean }>;
  hide: () => void;
  onWake: (cb: () => void) => void;
  onAnnounce: (cb: (payload: OrbAnnouncement) => void) => void;
  onDictationPartial: (cb: (payload: OrbDictationPartial) => void) => void;
  onDictationFinal: (cb: (payload: OrbDictationFinal) => void) => void;
  onDictationError: (cb: (payload: OrbDictationError) => void) => void;
  onTtsChunk: (cb: (payload: OrbTtsChunk) => void) => void;
  onTtsEnd: (cb: (payload: OrbTtsEnd) => void) => void;
  removeListeners: () => void;
}


