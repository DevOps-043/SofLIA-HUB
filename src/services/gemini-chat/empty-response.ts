/**
 * Gemini puede terminar un turno sin texto por razones muy distintas: el prompt
 * o la respuesta se bloquearon por seguridad, el presupuesto de tokens se
 * consumio razonando antes de escribir, o la salida se corto por recitacion.
 *
 * Todas colapsaban en el mismo "No obtuve una respuesta. Intenta de nuevo.",
 * que no dice al usuario que hacer y no deja rastro para diagnosticar: el
 * `finishReason` venia en la respuesta y se descartaba. Esto lo traduce a un
 * mensaje accionable y deja el motivo en consola.
 */

const SAFETY_FINISH_REASONS = new Set([
  'SAFETY',
  'PROHIBITED_CONTENT',
  'BLOCKLIST',
  'SPII',
  'IMAGE_SAFETY',
]);

const SAFETY_MESSAGE = 'No pude responder a esto por las politicas de seguridad del modelo. Reformula la solicitud e intento de nuevo.';
const MAX_TOKENS_MESSAGE = 'Me quede sin presupuesto de tokens antes de escribir la respuesta. Baja el nivel de razonamiento o acorta el mensaje e intento de nuevo.';
const RECITATION_MESSAGE = 'La respuesta se detuvo porque reproducia contenido protegido. Pidemelo con otras palabras o pideme un resumen.';
const MALFORMED_CALL_MESSAGE = 'El modelo devolvio una llamada de herramienta invalida. Intenta de nuevo.';

/**
 * Devuelve `text` si trae contenido. Si viene vacio, traduce el motivo de cierre
 * a un mensaje accionable; si el motivo no es reconocible devuelve cadena vacia
 * para conservar el mensaje generico de la capa superior.
 *
 * Nunca sustituye cuando el turno produjo imagenes: ahi el texto vacio es
 * legitimo y quien llama lo reemplaza por su propia leyenda.
 */
export function resolveEmptyGeminiText(
  text: string,
  response: unknown,
  generatedImages: string[] = [],
): string {
  if (text.trim()) return text;
  if (generatedImages.length > 0) return text;

  const finishReason = readFinishReason(response);
  const blockReason = readBlockReason(response);
  console.warn('[GeminiChat] respuesta sin texto', { finishReason, blockReason });

  if (blockReason || SAFETY_FINISH_REASONS.has(finishReason)) return SAFETY_MESSAGE;
  if (finishReason === 'MAX_TOKENS') return MAX_TOKENS_MESSAGE;
  if (finishReason === 'RECITATION') return RECITATION_MESSAGE;
  if (finishReason === 'MALFORMED_FUNCTION_CALL') return MALFORMED_CALL_MESSAGE;
  return text;
}

function readFinishReason(response: unknown): string {
  const candidates = (response as { candidates?: Array<{ finishReason?: unknown }> } | null)?.candidates;
  return String(candidates?.[0]?.finishReason ?? '').toUpperCase();
}

function readBlockReason(response: unknown): string {
  const feedback = (response as { promptFeedback?: { blockReason?: unknown } } | null)?.promptFeedback;
  return String(feedback?.blockReason ?? '').toUpperCase();
}
