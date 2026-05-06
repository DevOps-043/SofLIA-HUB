/**
 * Result<T, E> — manejo explícito de errores sin excepciones.
 *
 * Reemplaza el patrón `try/catch + return null + console.error` que está disperso
 * por el código y elimina la categoría de "errores silenciosos" (§3 del
 * prompt_maestro.md: "Manejar errores de forma explícita y consistente").
 *
 * Uso:
 *   import { ok, err, type Result } from './utils/result';
 *
 *   async function loadUser(id: string): Promise<Result<User, AppError>> {
 *     try {
 *       const user = await db.findUser(id);
 *       if (!user) return err(new NotFoundError('user', id));
 *       return ok(user);
 *     } catch (cause) {
 *       return err(new InfrastructureError('db', { cause }));
 *     }
 *   }
 *
 *   const result = await loadUser('u1');
 *   if (!result.ok) {
 *     log.warn({ err: result.error }, 'no se pudo cargar usuario');
 *     return;
 *   }
 *   useUser(result.value);
 */

export type Result<T, E = AppError> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });

export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

/**
 * Envuelve una promesa para convertir cualquier excepción en un Result.
 * Útil para encapsular llamadas a librerías externas que no usan Result.
 */
export async function fromPromise<T>(
  promise: Promise<T>,
  mapError: (cause: unknown) => AppError = (cause) => new InfrastructureError('unknown', { cause }),
): Promise<Result<T, AppError>> {
  try {
    return ok(await promise);
  } catch (cause) {
    return err(mapError(cause));
  }
}

/**
 * Categorías de error de la aplicación.
 * - `validation`:    input inválido del usuario o de un sistema externo
 * - `not_found`:     recurso solicitado no existe
 * - `unauthorized`:  falta autenticación
 * - `forbidden`:     autenticado pero sin permisos
 * - `conflict`:      estado inconsistente (versión, duplicado)
 * - `infrastructure`: fallo de IO, red, BD o servicio externo
 * - `internal`:      bug o estado inesperado
 */
export type ErrorKind =
  | 'validation'
  | 'not_found'
  | 'unauthorized'
  | 'forbidden'
  | 'conflict'
  | 'infrastructure'
  | 'internal';

export interface AppErrorDetails {
  cause?: unknown;
  context?: Record<string, unknown>;
}

/**
 * Error base de la aplicación. Lleva categoría tipada para que el caller
 * pueda decidir cómo tratarlo (reintentar, mostrar al usuario, escalar, etc.)
 * sin parsear strings.
 */
export class AppError extends Error {
  public readonly kind: ErrorKind;
  public readonly cause?: unknown;
  public readonly context?: Record<string, unknown>;

  constructor(kind: ErrorKind, message: string, details: AppErrorDetails = {}) {
    super(message);
    this.name = this.constructor.name;
    this.kind = kind;
    this.cause = details.cause;
    this.context = details.context;
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      kind: this.kind,
      message: this.message,
      context: this.context,
      cause: this.cause instanceof Error
        ? { name: this.cause.name, message: this.cause.message }
        : this.cause,
    };
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: AppErrorDetails) {
    super('validation', message, details);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string | number, details?: AppErrorDetails) {
    super('not_found', id !== undefined ? `${resource} no encontrado: ${id}` : `${resource} no encontrado`, {
      ...details,
      context: { ...details?.context, resource, id },
    });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'No autenticado', details?: AppErrorDetails) {
    super('unauthorized', message, details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Acceso denegado', details?: AppErrorDetails) {
    super('forbidden', message, details);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: AppErrorDetails) {
    super('conflict', message, details);
  }
}

export class InfrastructureError extends AppError {
  constructor(component: string, details?: AppErrorDetails) {
    super('infrastructure', `Fallo en ${component}`, {
      ...details,
      context: { ...details?.context, component },
    });
  }
}

export class InternalError extends AppError {
  constructor(message: string, details?: AppErrorDetails) {
    super('internal', message, details);
  }
}

/**
 * Convierte cualquier valor en un AppError. Útil en boundaries donde
 * recibimos `unknown` de un catch y queremos preservar la información.
 */
export function toAppError(value: unknown, fallbackMessage = 'Error desconocido'): AppError {
  if (value instanceof AppError) return value;
  if (value instanceof Error) return new InternalError(value.message, { cause: value });
  if (typeof value === 'string') return new InternalError(value);
  return new InternalError(fallbackMessage, { cause: value });
}
