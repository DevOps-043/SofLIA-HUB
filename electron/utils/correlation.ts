/**
 * Correlation IDs para trazabilidad end-to-end.
 *
 * Permite asociar un identificador único a una operación lógica (mensaje de chat,
 * ejecución de tool, request IPC) y recuperarlo desde cualquier punto de la cadena
 * de llamadas asíncronas — sin pasarlo manualmente por cada función.
 *
 * Cumple §10 del prompt_maestro.md (observabilidad: correlation IDs / trace IDs).
 *
 * Uso:
 *   import { withCorrelation, getCorrelationId } from './utils/correlation';
 *
 *   // En el punto de entrada (IPC handler, evento):
 *   await withCorrelation(async () => {
 *     log.info('mensaje recibido');         // incluye correlationId
 *     await processMessage();                // hereda correlationId
 *   });
 *
 *   // En cualquier función dentro del scope:
 *   const id = getCorrelationId();           // recupera el id activo
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

interface CorrelationContext {
  correlationId: string;
  parentId?: string;
  startedAt: number;
}

const storage = new AsyncLocalStorage<CorrelationContext>();

/**
 * Ejecuta `fn` dentro de un scope con correlation ID propio.
 * Si ya existe un correlationId activo, se preserva como `parentId`.
 *
 * @param fn       Función a ejecutar dentro del scope.
 * @param options  Permite forzar un correlationId específico (p.ej. recibido vía IPC).
 */
export function withCorrelation<T>(
  fn: () => Promise<T> | T,
  options: { correlationId?: string } = {},
): Promise<T> | T {
  const parent = storage.getStore();
  const context: CorrelationContext = {
    correlationId: options.correlationId || randomUUID(),
    parentId: parent?.correlationId,
    startedAt: Date.now(),
  };
  return storage.run(context, fn);
}

/**
 * Devuelve el correlationId activo, o `undefined` si no hay scope.
 * El logger lo inyecta automáticamente; raramente necesitarás llamarla a mano.
 */
export function getCorrelationId(): string | undefined {
  return storage.getStore()?.correlationId;
}

/**
 * Devuelve el contexto completo (correlationId + parentId + startedAt)
 * para casos que necesiten trazar la duración de una operación.
 */
export function getCorrelationContext(): CorrelationContext | undefined {
  return storage.getStore();
}
