const GEMINI_CALL_TIMEOUT_MS = 45_000;
const TOOL_CALL_TIMEOUT_MS = 30_000;
const CIRCUIT_FAILURE_THRESHOLD = 3;
const CIRCUIT_COOLDOWN_MS = 60_000;

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

export async function withGeminiTimeout<T>(
  label: string,
  operationFactory: () => Promise<T>,
  timeoutMs = GEMINI_CALL_TIMEOUT_MS,
): Promise<T> {
  assertGeminiCircuitClosed();

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const operation = operationFactory();
  operation.catch(() => {});

  try {
    const result = await Promise.race([
      operation,
      new Promise<T>((_resolve, reject) => {
        timeoutId = setTimeout(() => reject(createTimeoutError(label, timeoutMs)), timeoutMs);
      }),
    ]);
    noteSuccess();
    return result;
  } catch (error) {
    noteFailure();
    throw error;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export function withToolTimeout<T>(
  label: string,
  operationFactory: () => Promise<T>,
  timeoutMs: number = TOOL_CALL_TIMEOUT_MS,
): Promise<T> {
  return withGeminiTimeout(label, operationFactory, timeoutMs);
}

export function resetGeminiResilienceState(): void {
  consecutiveFailures = 0;
  circuitOpenUntil = 0;
}
