export interface SupabaseFetchOptions {
  timeoutMs?: number;
  readRetryCount?: number;
  retryBaseDelayMs?: number;
  stripIncomingSignal?: boolean;
  serviceName?: string;
}

const DEFAULT_TIMEOUT_MS = 25_000;
const DEFAULT_READ_RETRY_COUNT = 2;
const DEFAULT_RETRY_BASE_DELAY_MS = 250;
const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRequestMethod(input: RequestInfo | URL, init?: RequestInit): string {
  if (init?.method) return init.method.toUpperCase();
  if (typeof Request !== 'undefined' && input instanceof Request) {
    return input.method.toUpperCase();
  }
  return 'GET';
}

function isSafeReadMethod(method: string): boolean {
  return method === 'GET' || method === 'HEAD';
}

function createAbortError(message: string): Error {
  const error = new Error(message);
  error.name = 'AbortError';
  return error;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function getBackoffMs(attempt: number, baseDelayMs: number): number {
  const jitter = Math.floor(Math.random() * baseDelayMs);
  return baseDelayMs * 2 ** attempt + jitter;
}

async function fetchOnce(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  options: Required<Pick<SupabaseFetchOptions, 'timeoutMs' | 'stripIncomingSignal'>>,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort(createAbortError(`Supabase request timed out after ${options.timeoutMs}ms`));
  }, options.timeoutMs);

  const incomingSignal = init?.signal;
  const abortFromIncoming = () => {
    controller.abort(createAbortError('Supabase request aborted by caller'));
  };

  if (!options.stripIncomingSignal && incomingSignal) {
    if (incomingSignal.aborted) {
      clearTimeout(timeout);
      throw createAbortError('Supabase request aborted before it started');
    }
    incomingSignal.addEventListener('abort', abortFromIncoming, { once: true });
  }

  try {
    const { signal: _signal, ...restInit } = init || {};
    return await globalThis.fetch(input, {
      ...restInit,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
    if (!options.stripIncomingSignal && incomingSignal) {
      incomingSignal.removeEventListener('abort', abortFromIncoming);
    }
  }
}

export function createSupabaseFetch(options: SupabaseFetchOptions = {}): typeof globalThis.fetch {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const readRetryCount = options.readRetryCount ?? DEFAULT_READ_RETRY_COUNT;
  const retryBaseDelayMs = options.retryBaseDelayMs ?? DEFAULT_RETRY_BASE_DELAY_MS;
  const stripIncomingSignal = options.stripIncomingSignal ?? true;

  return async (input, init) => {
    const method = getRequestMethod(input, init);
    const maxAttempts = isSafeReadMethod(method) ? readRetryCount + 1 : 1;

    let lastError: unknown = null;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        const response = await fetchOnce(input, init, { timeoutMs, stripIncomingSignal });
        if (!RETRYABLE_STATUSES.has(response.status) || attempt >= maxAttempts - 1) {
          return response;
        }
        lastError = new Error(`Supabase ${method} responded with ${response.status}`);
      } catch (error) {
        lastError = error;
        if (isAbortError(error) || attempt >= maxAttempts - 1) {
          throw error;
        }
      }

      await sleep(getBackoffMs(attempt, retryBaseDelayMs));
    }

    throw lastError instanceof Error ? lastError : new Error('Supabase request failed');
  };
}
