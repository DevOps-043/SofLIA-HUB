const RATE_LIMIT_MESSAGE = 'No pude completar la respuesta por capacidad temporal. Intenta de nuevo en unos segundos.';
const CONTEXT_LENGTH_MESSAGE = 'La peticion supero el tamano que admite el modelo en un turno. Abre un chat nuevo o pideme el trabajo por partes.';
const TIMEOUT_MESSAGE = 'La respuesta tardo mas de lo esperado. Intenta de nuevo en unos segundos.';
const SAFETY_MESSAGE = 'No pude completar esta solicitud de forma segura. Reformula el mensaje y vuelvo a intentarlo.';
const MODEL_CONFIG_MESSAGE = 'El nivel de razonamiento no es compatible con el modelo seleccionado. Elige otro nivel e intenta de nuevo.';
const OPENAI_CONFIG_MESSAGE = 'SofLIA Pro y Max requieren una clave de OpenAI válida en Configuración.';
const GENERIC_MESSAGE = 'No pude completar la respuesta en este momento. Intenta de nuevo.';

interface PublicAiErrorMessages {
  rateLimit?: string;
  contextLength?: string;
  timeout?: string;
  safety?: string;
  modelConfig?: string;
  openAIConfig?: string;
  generic?: string;
}

export function getPublicAiErrorMessage(error: unknown, messages: PublicAiErrorMessages = {}): string {
  const rawMessage = getRawErrorMessage(error);
  const normalized = rawMessage.toLowerCase();

  // Antes que el limite de capacidad: el mensaje del proveedor suele traer
  // "exceeded" en ambos casos, pero el consejo es el contrario. Reintentar en
  // unos segundos no arregla un contexto que ya no cabe.
  if (isContextLengthError(normalized)) return messages.contextLength || CONTEXT_LENGTH_MESSAGE;
  if (isRateLimitError(normalized)) return messages.rateLimit || RATE_LIMIT_MESSAGE;
  if (isTimeoutError(normalized)) return messages.timeout || TIMEOUT_MESSAGE;
  if (isSafetyError(normalized)) return messages.safety || SAFETY_MESSAGE;
  if (isModelConfigurationError(normalized)) return messages.modelConfig || MODEL_CONFIG_MESSAGE;
  if (isMissingOpenAIKey(normalized)) return messages.openAIConfig || OPENAI_CONFIG_MESSAGE;
  if (containsProviderDetails(normalized)) return messages.generic || GENERIC_MESSAGE;

  return messages.generic || GENERIC_MESSAGE;
}

function isModelConfigurationError(message: string): boolean {
  const referencesReasoning = (
    message.includes('thinking_level') ||
    message.includes('thinkinglevel') ||
    message.includes('reasoning.effort') ||
    message.includes('reasoning_effort')
  );
  const isRejected = (
    message.includes('invalid') ||
    message.includes('unsupported') ||
    message.includes('not supported') ||
    message.includes('not allowed')
  );
  return referencesReasoning && isRejected;
}

function isMissingOpenAIKey(message: string): boolean {
  return message.includes('openai_api_key_missing');
}

function getRawErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message || error.name;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === 'string' ? message : String(message || '');
  }
  return String(error || '');
}

function isRateLimitError(message: string): boolean {
  return (
    message.includes('429') ||
    message.includes('quota') ||
    message.includes('rate limit') ||
    message.includes('rate-limit') ||
    message.includes('resource_exhausted') ||
    message.includes('too many requests') ||
    message.includes('free_tier')
  );
}

/**
 * El contexto que ya no cabe se veia como "capacidad temporal" porque el
 * mensaje del proveedor incluye "exceeded". Ese aviso mandaba al usuario a
 * reintentar algo que iba a fallar igual: la unica salida es acortar el turno.
 */
function isContextLengthError(message: string): boolean {
  return (
    message.includes('request too large') ||
    message.includes('too large for') ||
    message.includes('must be reduced') ||
    message.includes('context length') ||
    message.includes('context_length') ||
    message.includes('context window') ||
    message.includes('maximum context') ||
    message.includes('too many tokens') ||
    message.includes('reduce the length') ||
    message.includes('string too long')
  );
}

function isTimeoutError(message: string): boolean {
  return (
    message.includes('timeout') ||
    message.includes('tiempo limite') ||
    message.includes('tardo demasiado') ||
    message.includes('circuit breaker')
  );
}

function isSafetyError(message: string): boolean {
  return (
    message.includes('safety') ||
    message.includes('blocked') ||
    message.includes('bloque') ||
    message.includes('segura')
  );
}

function containsProviderDetails(message: string): boolean {
  return (
    message.includes('google') ||
    message.includes('gemini') ||
    message.includes('generativelanguage') ||
    message.includes('googleapis') ||
    message.includes('ai.google.dev') ||
    message.includes('model:') ||
    message.includes('apikey') ||
    message.includes('api key') ||
    message.includes('billing') ||
    message.includes('https://')
  );
}
