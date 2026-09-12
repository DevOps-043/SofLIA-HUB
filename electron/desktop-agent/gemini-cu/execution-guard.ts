/** Cambio de contexto irrecuperable para esta tarea; no reintentar en otra pestaña. */
export class CuContextChangedError extends Error {
  constructor() {
    super('La página, el perfil o el permiso cambió. Inicia otra tarea desde la pestaña deseada.');
    this.name = 'CuContextChangedError';
  }
}

/** No propagar motivos de cancelación arbitrarios al modelo o a los registros. */
export function assertCuNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new Error('Tarea cancelada.');
}
