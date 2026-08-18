/**
 * Tipos del modo llamada: la conversacion hablada sostenida por WhatsApp y
 * Telegram.
 *
 * El modo llamada NO es un segundo agente. Es una politica de entrega: decide si
 * la respuesta del loop Gemini existente sale hablada o escrita. Todo el
 * razonamiento, el catalogo de herramientas, las guardas y las confirmaciones
 * siguen viviendo en `wa-agent/` sin cambio alguno.
 */

/** Canales capaces de transportar notas de voz. */
export type VoiceCallChannel = 'whatsapp' | 'telegram';

/** Motivo por el que se abrio la sesion, util para el aviso inicial y la traza. */
export type VoiceCallOpenReason =
  /** El usuario escribio `/llamar`. */
  | 'command'
  /** El usuario hablo por nota de voz sin comando previo. */
  | 'voice-message'
  /** Se detecto una llamada entrante de WhatsApp y se reconducio. */
  | 'incoming-call'
  /** El agente pidio hablar mediante `send_voice_note`. */
  | 'agent';

/** Motivo de cierre, para distinguir un `/colgar` de un vencimiento. */
export type VoiceCallCloseReason = 'command' | 'idle-timeout' | 'channel-disconnected';

/** Sesion viva de modo llamada para un chat concreto. */
export interface VoiceCallSession {
  channel: VoiceCallChannel;
  /** JID en WhatsApp, `chat_id` en Telegram. */
  chatId: string;
  openedAt: number;
  lastActivityAt: number;
  openReason: VoiceCallOpenReason;
  /** Turnos hablados resueltos, solo para traza y diagnostico. */
  spokenTurns: number;
  /**
   * La caida a texto se avisa una sola vez por sesion: repetir el mismo aviso en
   * cada turno convierte un fallo del proveedor en ruido que tapa la respuesta.
   */
  degradedNoticeSent: boolean;
}

/** Nota de voz ya sintetizada y lista para el transporte. */
export interface VoiceNoteAudio {
  /** OGG con codec Opus. */
  buffer: Buffer;
  mimetype: 'audio/ogg; codecs=opus';
  /** Duracion estimada en segundos a partir del bitrate constante. */
  seconds: number;
  /** Texto realmente hablado, ya normalizado para locucion. */
  spokenText: string;
  /**
   * Resto no hablado por exceder el limite. Se entrega como texto en el mismo
   * turno para no perder contenido.
   */
  remainderText: string;
  voiceId: string;
}
