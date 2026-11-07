import { openaiFailure, type NativeOpenAIFailure, type NativeOpenAIReason } from '../../src/shared/openai-runtime';
import { NativeOpenAIKeyMissingError } from './credentials';

/** Sólo metadata numérica acotada: nunca message/body/headers del error SDK. */
export function publicOpenAIError(error: unknown): NativeOpenAIFailure {
  if (error instanceof NativeOpenAIKeyMissingError) return openaiFailure('KEY_MISSING');
  const record = error !== null && typeof error === 'object' ? error : {};
  const status = 'status' in record && typeof record.status === 'number' ? record.status : undefined;
  let retryAfterMs: number | undefined;
  if ('headers' in record && record.headers instanceof Headers) {
    const value = record.headers.get('retry-after');
    if (value && /^\d+(\.\d+)?$/.test(value)) retryAfterMs = Number(value) * 1000;
  }
  const code = 'code' in record && typeof record.code === 'string' ? record.code : '';
  const reason: NativeOpenAIReason | undefined = code === 'context_length_exceeded' ? 'context_length' : code === 'invalid_api_key' ? 'invalid_key' : code === 'content_policy_violation' ? 'safety' : code === 'unsupported_reasoning_effort' ? 'model_config' : error instanceof Error && /Timeout/.test(error.name) ? 'timeout' : undefined;
  return { ...openaiFailure('PROVIDER_FAILED', status, retryAfterMs), ...(reason ? { reason } : {}) };
}
