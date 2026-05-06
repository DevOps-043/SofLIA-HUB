/**
 * Logger estructurado para el proceso main.
 *
 * Reemplaza el uso disperso de console.log/error con logging JSON parseable,
 * niveles correctos y soporte para correlation IDs. Cumple §10 del prompt_maestro.md
 * (observabilidad: logs estructurados, niveles, correlation IDs, trazabilidad).
 *
 * Uso:
 *   import { createLogger } from './utils/logger';
 *   const log = createLogger('chat-service');
 *   log.info({ conversationId }, 'mensajes cargados');
 *   log.error({ err, conversationId }, 'fallo al cargar mensajes');
 *
 * Para correlación entre operaciones, ver `correlation.ts`:
 *   import { withCorrelation } from './utils/correlation';
 *   await withCorrelation(async () => { log.info('inicio'); ... });
 */

import pino, { type Logger as PinoLogger, type LoggerOptions } from 'pino';
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

function buildBaseOptions(): LoggerOptions {
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

let rootLogger: PinoLogger | null = null;

function getRootLogger(): PinoLogger {
  if (!rootLogger) {
    rootLogger = pino(buildBaseOptions());
  }
  return rootLogger;
}

export interface Logger {
  trace: (...args: Parameters<PinoLogger['trace']>) => void;
  debug: (...args: Parameters<PinoLogger['debug']>) => void;
  info: (...args: Parameters<PinoLogger['info']>) => void;
  warn: (...args: Parameters<PinoLogger['warn']>) => void;
  error: (...args: Parameters<PinoLogger['error']>) => void;
  fatal: (...args: Parameters<PinoLogger['fatal']>) => void;
  child: (bindings: Record<string, unknown>) => Logger;
}

function wrap(logger: PinoLogger): Logger {
  return {
    trace: (...args) => logger.trace(...args),
    debug: (...args) => logger.debug(...args),
    info: (...args) => logger.info(...args),
    warn: (...args) => logger.warn(...args),
    error: (...args) => logger.error(...args),
    fatal: (...args) => logger.fatal(...args),
    child: (bindings) => wrap(logger.child(bindings)),
  };
}

/**
 * Crea un logger asociado a un módulo/servicio.
 * El nombre aparece en el campo `module` de cada entrada para facilitar filtrado.
 */
export function createLogger(module: string): Logger {
  return wrap(getRootLogger().child({ module }));
}

/**
 * Logger raíz para casos puntuales sin contexto de módulo.
 * Preferir createLogger(moduleName) en código de producción.
 */
export const logger: Logger = wrap(getRootLogger());
