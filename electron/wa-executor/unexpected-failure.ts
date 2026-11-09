import { randomUUID } from 'node:crypto';
import { createLogger } from '../utils/logger';
import { safeToolName } from '../whatsapp/tool-observation';
import type { FunctionResponse } from './types';

const log = createLogger('whatsapp-herramientas');
export function unexpectedToolFailure(name: string, phase: 'guard' | 'execution'): FunctionResponse {
  const correlationId = randomUUID();
  const errorCode = phase === 'guard' ? 'TOOL_GUARD_FAILED' : 'TOOL_EXECUTION_FAILED';
  log.warn({ correlationId, errorCode, tool: safeToolName(name) }, 'No se pudo completar una herramienta WhatsApp.');
  return { functionResponse: { name, response: { success: false, errorCode, correlationId,
    ...(phase === 'execution' ? { uncertain: true, recoveryRequired: true } : {}),
    error: phase === 'guard' ? 'No se pudo verificar la autorización de la herramienta. No se ejecutó.'
      : 'No se pudo completar la herramienta. Revisa su estado antes de repetirla.' } } };
}
