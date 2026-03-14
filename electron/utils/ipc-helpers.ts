/**
 * Helpers para IPC handlers — Main Process
 * Envuelve lógica en try-catch con formato de respuesta consistente.
 */

export type IPCResult<T = Record<string, unknown>> = {
  success: boolean;
  error?: string;
} & Partial<T>;

/**
 * Envuelve una función asíncrona en el patrón estándar de IPC:
 * `{ success: true, ...data }` en éxito, `{ success: false, error }` en fallo.
 */
export async function handleIPC<T extends Record<string, unknown>>(
  fn: () => Promise<T>,
): Promise<IPCResult<T>> {
  try {
    const data = await fn();
    return { success: true, ...data } as IPCResult<T>;
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) } as IPCResult<T>;
  }
}

/**
 * Versión simplificada que retorna `{ success: true }` sin datos adicionales.
 */
export async function handleIPCVoid(fn: () => Promise<void>): Promise<IPCResult> {
  try {
    await fn();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
}
