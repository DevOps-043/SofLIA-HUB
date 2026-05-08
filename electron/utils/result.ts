export {
  err,
  fromPromise,
  ok,
  type Result,
} from './result/core';
export {
  AppError,
  ConflictError,
  ForbiddenError,
  InfrastructureError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
  toAppError,
  type AppErrorDetails,
  type ErrorKind,
} from './result/errors';
