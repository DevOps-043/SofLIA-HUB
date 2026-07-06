const RATE_LIMIT_MESSAGE = 'No pude completar la respuesta por capacidad temporal. Intenta de nuevo en unos segundos.';
const TIMEOUT_MESSAGE = 'La respuesta tardo mas de lo esperado. Intenta de nuevo en unos segundos.';
const SAFETY_MESSAGE = 'No pude completar esta solicitud de forma segura. Reformula el mensaje y vuelvo a intentarlo.';
const GENERIC_MESSAGE = 'No pude completar la respuesta en este momento. Intenta de nuevo.';

interface PublicAiErrorMessages {
  rateLimit?: string;
  timeout?: string;
  safety?: string;
  generic?: string;
}

export function getPublicAiErrorMessage(error: unknown, messages: PublicAiErrorMessages = {}): string {
  const rawMessage = getRawErrorMessage(error);
  const normalized = rawMessage.toLowerCase();

  if (isRateLimitError(normalized)) return messages.rateLimit || RATE_LIMIT_MESSAGE;
  if (isTimeoutError(normalized)) return messages.timeout || TIMEOUT_MESSAGE;
  if (isSafetyError(normalized)) return messages.safety || SAFETY_MESSAGE;
  if (containsProviderDetails(normalized)) return messages.generic || GENERIC_MESSAGE;

  return messages.generic || GENERIC_MESSAGE;
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
    message.includes('exceeded') ||
    message.includes('free_tier')
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
