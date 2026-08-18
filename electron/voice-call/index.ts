/**
 * Modo llamada: conversacion hablada sostenida por WhatsApp y Telegram.
 *
 * Politica de entrega, no de razonamiento. El loop Gemini de `wa-agent/` sigue
 * siendo el unico que decide que responder y que herramientas usar, con sus
 * guardas, permisos y confirmaciones intactos; este modulo solo decide si esa
 * respuesta sale hablada y por que transporte.
 */
export { readVoiceCallConfig, VOICE_NOTE_MAX_CHARS } from './config';
export {
  closeVoiceCall,
  deliverAgentReply,
  openVoiceCall,
  type DeliverOptions,
  type VoiceCallTransport,
} from './delivery';
export { voiceCallSessions, VoiceCallSessionStore } from './session-store';
export { splitForSpeech, synthesizeVoiceNote } from './speech';
export type {
  VoiceCallChannel,
  VoiceCallCloseReason,
  VoiceCallOpenReason,
  VoiceCallSession,
  VoiceNoteAudio,
} from './types';
