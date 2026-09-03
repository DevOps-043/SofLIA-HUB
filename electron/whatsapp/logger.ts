import pino from 'pino';

/**
 * Nivel de log del transporte de WhatsApp.
 *
 * Estaba en `silent`, y con eso el rechazo de un mensaje por el servidor no
 * dejaba ninguna senal: Baileys reporta esos fallos como advertencias (por
 * ejemplo 463, falta el token de privacidad de un chat 1:1, o 479, stanza
 * rechazada por direccionamiento invalido) y el envio resuelve igual. El canal
 * parecia conectado y sano mientras nada llegaba al destinatario.
 *
 * `warn` deja pasar solo esos fallos. `WHATSAPP_LOG_LEVEL` permite subir a
 * `debug` o `trace` durante un diagnostico, o volver a `silent`.
 */
const LEVEL = String(process.env.WHATSAPP_LOG_LEVEL || 'warn').trim() || 'warn';

export const logger = pino({ level: LEVEL });
