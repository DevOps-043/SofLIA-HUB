/** Cancelación local: no revierte una llamada que ya salió al proveedor o al SO. */
export class BackendTaskCancelledError extends Error {
  constructor() { super('Tarea cancelada por el usuario.'); this.name = 'BackendTaskCancelledError'; }
}

export function assertBackendTaskActive(signal?: AbortSignal): void {
  if (signal?.aborted) throw new BackendTaskCancelledError();
}

/** Retener la plaza mientras la llamada viva termina; no competir con un timeout. */
export async function runBackendTaskStage<T>(signal: AbortSignal | undefined, work: () => Promise<T>): Promise<T> {
  assertBackendTaskActive(signal);
  const result = await work();
  assertBackendTaskActive(signal);
  return result;
}

export function linkBackendTaskCancellation(controller: AbortController, signal?: AbortSignal): () => void {
  const cancel = () => controller.abort();
  signal?.addEventListener('abort', cancel, { once: true });
  if (signal?.aborted) cancel();
  return () => signal?.removeEventListener('abort', cancel);
}
