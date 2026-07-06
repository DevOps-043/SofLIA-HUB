/**
 * Fallo cuya causa es logica y estable dentro del mismo estado de pantalla:
 * el elemento/app no existe, el texto no coincide, la ventana no expone su
 * arbol. Reintentar la MISMA accion no cambiara el resultado, solo gasta
 * tiempo (cada reintento es una llamada a PowerShell/vision). El runner debe
 * fallar de inmediato y dejar que el modelo elija otra estrategia.
 */
export class DeterministicActionError extends Error {
  readonly deterministic = true;

  constructor(message: string) {
    super(message);
    this.name = 'DeterministicActionError';
  }
}

export function isDeterministicActionError(error: unknown): error is DeterministicActionError {
  return error instanceof DeterministicActionError
    || (typeof error === 'object' && error !== null && (error as { deterministic?: unknown }).deterministic === true);
}
