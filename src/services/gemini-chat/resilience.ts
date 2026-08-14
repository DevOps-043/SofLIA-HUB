const GEMINI_CALL_TIMEOUT_MS = 45_000;
const TOOL_CALL_TIMEOUT_MS = 30_000;
const CIRCUIT_FAILURE_THRESHOLD = 3;
const CIRCUIT_COOLDOWN_MS = 60_000;
// Reintentos ante errores transitorios (429/quota/503 sobrecarga/timeout). El
// primer mensaje de una conversación dispara una ráfaga de llamadas (chat +
// título + memoria + herramientas) que puede topar el límite por minuto; un
// backoff corto lo resuelve solo, igual que un "intentalo de nuevo" manual.
const MODEL_CALL_MAX_RETRIES = 2;
const MODEL_CALL_BACKOFF_MS = [1_200, 3_500];

let consecutiveFailures = 0;
let circuitOpenUntil = 0;

function createTimeoutError(label: string, timeoutMs: number): Error {
  const error = new Error(`${label} excedio el tiempo limite de ${timeoutMs}ms`);
  error.name = 'TimeoutError';
  return error;
}

function noteSuccess(): void {
  consecutiveFailures = 0;
  circuitOpenUntil = 0;
}

function noteFailure(): void {
  consecutiveFailures += 1;
  if (consecutiveFailures >= CIRCUIT_FAILURE_THRESHOLD) {
    circuitOpenUntil = Date.now() + CIRCUIT_COOLDOWN_MS;
  }
}

export function assertGeminiCircuitClosed(): void {
  if (Date.now() < circuitOpenUntil) {
    throw new Error('Gemini esta temporalmente protegido por circuit breaker tras fallas consecutivas.');
  }
}

/** Ejecuta la operación con un timeout duro, sin tocar el circuit breaker. */
async function runWithTimeout<T>(label: string, operationFactory: () => Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const operation = operationFactory();
  operation.catch(() => {});
  try {
    return await Promise.race([
      operation,
      new Promise<T>((_resolve, reject) => {
        timeoutId = setTimeout(() => reject(createTimeoutError(label, timeoutMs)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export async function withGeminiTimeout<T>(
  label: string,
  operationFactory: () => Promise<T>,
  timeoutMs = GEMINI_CALL_TIMEOUT_MS,
): Promise<T> {
  assertGeminiCircuitClosed();
  try {
    const result = await runWithTimeout(label, operationFactory, timeoutMs);
    noteSuccess();
    return result;
  } catch (error) {
    noteFailure();
    throw error;
  }
}

/**
 * Como withGeminiTimeout pero, ante errores transitorios (429/quota/sobrecarga/
 * timeout), reintenta con backoff antes de rendirse. Los reintentos NO cuentan
 * como fallas del circuit breaker (para no bloquear un reintento inmediato del
 * usuario); solo se registra el resultado final. Respeta el AbortSignal (Stop).
 */
export async function withGeminiModelCall<T>(
  label: string,
  operationFactory: () => Promise<T>,
  options?: { signal?: AbortSignal; timeoutMs?: number },
): Promise<T> {
  assertGeminiCircuitClosed();
  const timeoutMs = options?.timeoutMs ?? GEMINI_CALL_TIMEOUT_MS;
  let attempt = 0;
  for (;;) {
    try {
      const result = await runWithTimeout(label, operationFactory, timeoutMs);
      noteSuccess();
      return result;
    } catch (error) {
      if (options?.signal?.aborted) throw error;
      if (attempt < MODEL_CALL_MAX_RETRIES && isTransientGeminiError(error)) {
        const delay = MODEL_CALL_BACKOFF_MS[attempt] ?? MODEL_CALL_BACKOFF_MS[MODEL_CALL_BACKOFF_MS.length - 1];
        attempt += 1;
        console.warn(`[GeminiChat] error transitorio en ${label} → reintento ${attempt}/${MODEL_CALL_MAX_RETRIES} en ${delay}ms`);
        await sleepWithSignal(delay, options?.signal);
        continue;
      }
      // Rate limit = el servicio esta ARRIBA pero throttled (p.ej. cuota del
      // free tier por minuto): NO es una falla del circuit breaker. Contarla
      // bloquearia al usuario 60s justo cuando bastaba esperar unos segundos.
      if (!isRateLimitError(error)) noteFailure();
      throw error;
    }
  }
}

export function withToolTimeout<T>(
  label: string,
  operationFactory: () => Promise<T>,
  timeoutMs: number = TOOL_CALL_TIMEOUT_MS,
): Promise<T> {
  return withGeminiTimeout(label, operationFactory, timeoutMs);
}

/**
 * Normaliza un error del proveedor a texto comparable.
 *
 * `@google/genai` lanza un error con `status` numerico ademas del mensaje, y
 * ese mensaje no siempre repite el codigo. Clasificar solo por texto dejaba un
 * 429 estructurado sin reintento y abriendo el circuit breaker, que es
 * exactamente lo contrario de lo que corresponde a un throttling.
 */
export function normalizeProviderError(error: unknown): string {
  const message = (error instanceof Error ? error.message : String(error || '')).toLowerCase();
  const detalle = error && typeof error === 'object' ? (error as Record<string, unknown>) : null;
  const codigos = [detalle?.status, detalle?.code, (detalle?.error as Record<string, unknown> | undefined)?.code]
    .filter((valor) => typeof valor === 'number' || typeof valor === 'string')
    .map((valor) => String(valor).toLowerCase());
  return codigos.length ? `${message} ${codigos.join(' ')}` : message;
}

/**
 * ¿El error es transitorio y vale la pena reintentar con backoff? Cubre rate
 * limit y sobrecarga del proveedor (429/quota/503/500). Los timeouts NO se
 * reintentan: es mejor fallar al siguiente modelo que esperar al mismo colgado.
 */
export function isTransientGeminiError(error: unknown): boolean {
  const message = normalizeProviderError(error);
  // Un contexto que ya no cabe tambien dice "exceeded", pero no es transitorio:
  // reintentarlo con el mismo payload gasta el backoff para volver a fallar.
  if (isContextLengthError(message)) return false;
  return (
    message.includes('quota') ||
    message.includes('rate limit') ||
    message.includes('rate-limit') ||
    message.includes('resource_exhausted') ||
    message.includes('too many requests') ||
    message.includes('exceeded') ||
    message.includes('overloaded') ||
    message.includes('unavailable') ||
    message.includes('internal error') ||
    // Códigos HTTP con límite de palabra: evita falsos positivos como el "500"
    // dentro de "45000ms" del mensaje de timeout.
    /\b(429|500|503)\b/.test(message)
  );
}

/**
 * ¿El error es SOLO rate limit (429/cuota)? A diferencia de un 500/503/red,
 * significa que el servicio esta disponible pero throttled; no debe abrir el
 * circuit breaker (que existe para servicios caidos, no para throttling).
 */
export function isRateLimitError(error: unknown): boolean {
  const message = normalizeProviderError(error);
  return (
    message.includes('quota') ||
    message.includes('rate limit') ||
    message.includes('rate-limit') ||
    message.includes('resource_exhausted') ||
    message.includes('too many requests') ||
    message.includes('free_tier') ||
    /\b429\b/.test(message)
  );
}

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
    message.includes('reduce the length')
  );
}

/** Espera `ms`, o rechaza de inmediato si se aborta la señal (botón Stop). */
export function sleepWithSignal(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'));
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export function resetGeminiResilienceState(): void {
  consecutiveFailures = 0;
  circuitOpenUntil = 0;
}
