export type WhatsAppAgentErrorCategory =
  | 'missing-api-key'
  | 'invalid-api-key'
  | 'quota'
  | 'model-unavailable'
  | 'network'
  | 'safety'
  | 'unknown';

export function classifyWhatsAppAgentError(error: unknown): WhatsAppAgentErrorCategory {
  const message = getErrorMessage(error);
  const normalized = message.toLowerCase();

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

export function isModelAvailabilityError(error: unknown): boolean {
  const normalized = getErrorMessage(error).toLowerCase();
  return (
    normalized.includes('model')
    && (
      normalized.includes('not found')
      || normalized.includes('not supported')
      || normalized.includes('not available')
      || normalized.includes('unsupported')
      || normalized.includes('permission denied')
      || normalized.includes('404')
    )
  ) || (
    normalized.includes('models/')
    && (
      normalized.includes('404')
      || normalized.includes('not found')
      || normalized.includes('is not found')
      || normalized.includes('not supported')
    )
  );
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
      return 'Gemini 3.6 Flash no esta disponible para esta key. No cambie a otro modelo; revisa el acceso de la API y vuelve a intentar.';
    case 'network':
      return 'No pude conectarme con Gemini en este momento. La conversacion sigue intacta; intenta de nuevo cuando haya conexion.';
    case 'safety':
      return 'Gemini bloqueo esta respuesta por reglas de seguridad. Reformula la solicitud con mas contexto y menos ambiguedad.';
    default:
      return 'Ocurrio un error tecnico procesando tu mensaje. La conversacion sigue guardada; intenta de nuevo.';
  }
}

export function shouldResetConversationAfterAgentError(error: unknown): boolean {
  return classifyWhatsAppAgentError(error) === 'unknown' && isLikelyConversationStateError(error);
}

function isLikelyConversationStateError(error: unknown): boolean {
  const normalized = getErrorMessage(error).toLowerCase();
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
