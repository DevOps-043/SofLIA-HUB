import { assertCuNotAborted } from './execution-guard';

/** Sólo para esperas sin entrada nativa: descarta respuestas y errores tardíos. */
export function waitForCuResponse<T>(operation: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  assertCuNotAborted(signal);
  if (!signal) return operation();
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(new Error('Tarea cancelada.'));
    signal.addEventListener('abort', abort, { once: true });
    const cleanup = () => signal.removeEventListener('abort', abort);
    try {
      operation().then(
        value => { cleanup(); if (signal.aborted) abort(); else resolve(value); },
        error => { cleanup(); reject(signal.aborted ? new Error('Tarea cancelada.') : error); },
      );
    } catch (error) {
      cleanup();
      reject(signal.aborted ? new Error('Tarea cancelada.') : error);
    }
  });
}
