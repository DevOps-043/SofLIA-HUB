import { AppError, InfrastructureError } from './errors';

export type Result<T, E = AppError> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });

export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

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
