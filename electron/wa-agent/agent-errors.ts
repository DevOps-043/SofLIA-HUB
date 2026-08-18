export type WhatsAppAgentErrorCategory =
  | 'missing-api-key'
  | 'invalid-api-key'
  | 'quota'
  | 'model-unavailable'
  | 'network'
  | 'safety'
  | 'unknown';

export function classifyWhatsAppAgentError(error: unknown): WhatsAppAgentErrorCategory {
  const normalized = getClassifiableMessage(error);

  if (!normalized.trim()) return 'unknown';
  if (normalized.includes('api key de gemini no configurada') || normalized.includes('api key no configurada')) {
    return 'missing-api-key';
  }
  if (
    normalized.includes('api key not valid')
    || normalized.includes('invalid api key')
    || normalized.includes('api_key_invalid')
    || normalized.includes('permission denied')
    || normalized.includes('unauthenticated')
    || normalized.includes('authentication')
  ) {
    return 'invalid-api-key';
  }
  if (
    normalized.includes('quota')
    || normalized.includes('rate limit')
    || normalized.includes('resource exhausted')
    || normalized.includes('429')
  ) {
    return 'quota';
  }
  if (isModelAvailabilityError(error)) return 'model-unavailable';
  if (
    normalized.includes('fetch failed')
    || normalized.includes('network')
    || normalized.includes('etimedout')
    || normalized.includes('econnreset')
    || normalized.includes('enotfound')
    || normalized.includes('timeout')
  ) {
    return 'network';
  }
  if (
    normalized.includes('blocked')
    || normalized.includes('safety')
    || normalized.includes('prohibited')
    || normalized.includes('promptfeedback')
  ) {
    return 'safety';
  }
  return 'unknown';
}

const MODEL_UNAVAILABLE_MARKERS = [
  'not found',
  'not supported',
  'not available',
  'unsupported',
  'permission denied',
  '404',
];

/**
 * La palabra "model" suelta NO basta para culpar al modelo.
 *
 * La API la usa en contextos ajenos a su disponibilidad — sobre todo en las
 * listas de roles validos ("... CONTEXT, USER_CONTEXT, MODEL, USER"), que
 * aparecen justo en errores de rol invalido junto a "not supported". Con el
 * predicado laxo, un fallo de protocolo se reportaba como "Gemini no esta
 * disponible para esta key" con el modelo perfectamente vivo.
 *
 * Un modelo realmente ausente o sin acceso siempre se nombra como RECURSO
 * (`models/<id>`), que es como lo reporta la API.
 */
export function isModelAvailabilityError(error: unknown): boolean {
  const normalized = getClassifiableMessage(error);
  if (!/models\/[a-z0-9._:-]+/.test(normalized)) return false;
  return MODEL_UNAVAILABLE_MARKERS.some((marker) => normalized.includes(marker));
}

export function getWhatsAppAgentUserErrorMessage(error: unknown): string {
  switch (classifyWhatsAppAgentError(error)) {
    case 'missing-api-key':
      return 'No tengo una API key de Gemini configurada para WhatsApp. Actualizala en Pulse Hub y vuelve a intentar.';
    case 'invalid-api-key':
      return 'Gemini rechazo la API key configurada. Revisa que la key nueva este guardada en Pulse Hub y que tenga acceso a Generative Language API.';
    case 'quota':
      return 'Gemini rechazo la solicitud por cuota o limite temporal. Intenta de nuevo en unos minutos o revisa la cuota de la key.';
    case 'model-unavailable':
      return `Gemini 3.6 Flash no esta disponible para esta key. No cambie a otro modelo; revisa el acceso de la API y vuelve a intentar.\n\nDetalle: ${describeTechnicalDetail(error)}`;
    case 'network':
      return 'No pude conectarme con Gemini en este momento. La conversacion sigue intacta; intenta de nuevo cuando haya conexion.';
    case 'safety':
      return 'Gemini bloqueo esta respuesta por reglas de seguridad. Reformula la solicitud con mas contexto y menos ambiguedad.';
    default:
      return `Ocurrio un error tecnico procesando tu mensaje. La conversacion sigue guardada; intenta de nuevo.\n\nDetalle: ${describeTechnicalDetail(error)}`;
  }
}

/**
 * Resumen corto y sin secretos del error para el bucket `unknown`.
 *
 * En un build empaquetado no hay consola donde leer el stack, y este bucket es
 * justamente el de las causas que no supimos clasificar: sin este detalle el
 * usuario reporta "falla" y no queda rastro de por que.
 */
function describeTechnicalDetail(error: unknown): string {
  const firstLine = getErrorMessage(error).split('\n')[0].trim();
  if (!firstLine) return 'sin mensaje de error';
  // La parte accionable de un error de Gemini va al final, despues de la URL
  // del endpoint: cortar corto deja el mensaje sin la causa.
  return redactSecrets(firstLine).slice(0, 400);
}

function redactSecrets(text: string): string {
  return text
    .replace(/([?&](?:key|api_?key|access_?token|token)=)[^\s&]+/gi, '$1[REDACTADO]')
    .replace(/AIza[0-9A-Za-z_-]{10,}/g, '[REDACTADO]')
    .replace(/\b(sk|rk)-[0-9A-Za-z_-]{10,}/g, '[REDACTADO]')
    .replace(/\beyJ[0-9A-Za-z_-]{10,}\.[0-9A-Za-z_-]+\.[0-9A-Za-z_-]+/g, '[REDACTADO]');
}

export function shouldResetConversationAfterAgentError(error: unknown): boolean {
  return classifyWhatsAppAgentError(error) === 'unknown' && isLikelyConversationStateError(error);
}

/**
 * Mensaje del error en minusculas y SIN URLs.
 *
 * Todo error del SDK de Gemini arrastra el endpoint
 * (`.../models/gemini-3.6-flash:generateContent`), asi que clasificar sobre el
 * texto crudo hacia que `includes('model')` fuera siempre cierto: cualquier
 * fallo cuyo cuerpo mencionara "not found", "404" o "not supported" —por
 * ejemplo una herramienta inexistente— se le atribuia al modelo y devolvia
 * "Gemini no esta disponible para esta key" con el modelo perfectamente vivo.
 * La URL nunca aporta informacion de clasificacion.
 */
function getClassifiableMessage(error: unknown): string {
  return getErrorMessage(error).replace(/https?:\/\/\S+/gi, ' ').toLowerCase();
}

function isLikelyConversationStateError(error: unknown): boolean {
  const normalized = getClassifiableMessage(error);
  return (
    normalized.includes('history')
    || normalized.includes('contents')
    || normalized.includes('parts')
    || normalized.includes('role')
  ) && (
    normalized.includes('invalid')
    || normalized.includes('400')
    || normalized.includes('bad request')
  );
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}
