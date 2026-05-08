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

export function toAppError(value: unknown, fallbackMessage = 'Error desconocido'): AppError {
  if (value instanceof AppError) return value;
  if (value instanceof Error) return new InternalError(value.message, { cause: value });
  if (typeof value === 'string') return new InternalError(value);
  return new InternalError(fallbackMessage, { cause: value });
}
