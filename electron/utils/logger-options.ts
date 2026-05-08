import pino, { type LoggerOptions } from 'pino';
import { getCorrelationId } from './correlation';

const REDACT_PATHS = [
  '*.password',
  '*.apiKey',
  '*.api_key',
  '*.token',
  '*.accessToken',
  '*.refreshToken',
  '*.access_token',
  '*.refresh_token',
  '*.secret',
  '*.authorization',
  '*.cookie',
  'req.headers.authorization',
  'req.headers.cookie',
];

export function buildBaseOptions(): LoggerOptions {
  const level = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

  return {
    level,
    base: {
      pid: process.pid,
      service: 'soflia-hub',
      process: 'main',
    },
    redact: {
      paths: REDACT_PATHS,
      censor: '[REDACTED]',
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => ({ level: label }),
      bindings: (bindings) => bindings,
      log: (object) => {
        const correlationId = getCorrelationId();
        return correlationId ? { ...object, correlationId } : object;
      },
    },
    serializers: {
      err: pino.stdSerializers.err,
      error: pino.stdSerializers.err,
    },
  };
}
