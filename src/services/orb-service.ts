// Wrapper del renderer para la ventana de la Orbe de Voz (canales orb:*).
// El dictado corre en el sidecar local; la voz conversacional se sintetiza en
// Electron main con ElevenLabs para mantener la credencial fuera del renderer.

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

interface OrbBridge {
  show: () => Promise<{ success: boolean; visible?: boolean; error?: string }>;
  getPendingWake: () => Promise<{ success: boolean; wake?: boolean }>;
  synthesize: (text: string) => Promise<OrbSynthesisResult>;
  startDictation: () => Promise<{ success: boolean; sessionId?: string; error?: string }>;
  stopDictation: (sessionId?: string | null) => Promise<{ success: boolean }>;
  speak: (text: string) => Promise<{ success: boolean; speechId?: string; error?: string }>;
  stopSpeaking: (speechId?: string | null) => Promise<{ success: boolean }>;
  conversationEnded: (sessionId?: string | null) => Promise<{ success: boolean }>;
  hide: () => void;
  onWake: (cb: () => void) => void;
  onDictationPartial: (cb: (payload: OrbDictationPartial) => void) => void;
  onDictationFinal: (cb: (payload: OrbDictationFinal) => void) => void;
  onDictationError: (cb: (payload: OrbDictationError) => void) => void;
  onTtsChunk: (cb: (payload: OrbTtsChunk) => void) => void;
  onTtsEnd: (cb: (payload: OrbTtsEnd) => void) => void;
  removeListeners: () => void;
}

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
  isAvailable(): boolean {
    return typeof window.orb !== 'undefined';
  },
  getPendingWake: () => api().getPendingWake(),
  show: () => api().show(),
  synthesize: (text: string) => api().synthesize(text),
  startDictation: () => api().startDictation(),
  stopDictation: (sessionId?: string | null) => api().stopDictation(sessionId),
  speak: (text: string) => api().speak(text),
  stopSpeaking: (speechId?: string | null) => api().stopSpeaking(speechId),
  conversationEnded: (sessionId?: string | null) => api().conversationEnded(sessionId),
  hide: () => api().hide(),
  onWake: (cb: () => void) => api().onWake(cb),
  onDictationPartial: (cb: (payload: OrbDictationPartial) => void) => api().onDictationPartial(cb),
  onDictationFinal: (cb: (payload: OrbDictationFinal) => void) => api().onDictationFinal(cb),
  onDictationError: (cb: (payload: OrbDictationError) => void) => api().onDictationError(cb),
  onTtsChunk: (cb: (payload: OrbTtsChunk) => void) => api().onTtsChunk(cb),
  onTtsEnd: (cb: (payload: OrbTtsEnd) => void) => api().onTtsEnd(cb),
  removeListeners: () => api().removeListeners(),
};
