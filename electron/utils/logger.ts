/**
 * Logger estructurado para el proceso main.
 *
 * Reemplaza el uso disperso de console.log/error con logging JSON parseable,
 * niveles correctos y soporte para correlation IDs. Cumple la seccion 10 de
 * docs/standards/engineering-practices.md (logs estructurados, niveles,
 * correlation IDs y trazabilidad).
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

import pino, { type Logger as PinoLogger } from 'pino';
import { buildBaseOptions } from './logger-options';

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
