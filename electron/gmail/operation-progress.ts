import type { GmailOperationResult } from '../../src/shared/gmail-mailbox';
import { createLogger } from '../utils/logger';
import type { GmailExecutionContext } from './execution-context';
import type { GmailClient } from './types';
import { randomUUID } from 'node:crypto';

export const GMAIL_OPERATION_FAILED = 'No se pudo completar la operación Gmail. Revisa la cuenta, los datos y la confirmación.';
export const GMAIL_OPERATION_RECOVERY = 'La operación no se completó. Revisa los cambios en Gmail antes de repetirla.';
const log = createLogger('gmail-operacion');
export class GmailOperationConflict extends Error {}
export class GmailOperationCancelled extends Error {}
export class GmailOperationLimitError extends Error {
  constructor(kind: 'messages' | 'labels') {
    super(kind === 'messages' ? 'La selección supera la cuota de mensajes. Usa una selección más pequeña antes de continuar.'
      : 'La limpieza supera la cuota de cien etiquetas. Reduce las etiquetas de la operación antes de continuar.');
  }
}

/** Avance de la llamada; no es un diario durable ni permite replay tras un crash. */
export class GmailOperationProgress {
  readonly operationId = randomUUID();
  confirmed = 0;
  uncertain = false;
  readonly labelsCreated: Array<{ id: string; name: string }> = [];
  async write<T>(context: GmailExecutionContext, effect: (client: GmailClient) => Promise<T>, acknowledge: (value: T) => void = () => {}): Promise<T> {
    return context.call(async client => {
      this.uncertain = true;
      const result = await effect(client);
      context.assert(); acknowledge(result);
      this.confirmed++; this.uncertain = false;
      return result;
    });
  }
  result(): Pick<GmailOperationResult, 'effectsConfirmed' | 'labelsCreated' | 'operationId'> {
    return { operationId: this.operationId, effectsConfirmed: this.confirmed, ...(this.labelsCreated.length ? { labelsCreated: this.labelsCreated } : {}) };
  }
  failure(error: unknown): GmailOperationResult {
    const partial = this.confirmed > 0, conflict = error instanceof GmailOperationConflict;
    log.warn({ operationId: this.operationId, effectsConfirmed: this.confirmed, partial, uncertain: this.uncertain, conflict }, 'Operación Gmail incompleta.');
    return { success: false, ...this.result(), error: partial || this.uncertain ? GMAIL_OPERATION_RECOVERY
      : error instanceof GmailOperationLimitError ? error.message : GMAIL_OPERATION_FAILED,
      ...(partial ? { partial: true } : {}), ...(this.uncertain ? { uncertain: true } : {}),
      ...(partial || this.uncertain ? { recoveryRequired: true } : {}),
      ...(error instanceof GmailOperationCancelled ? { cancelled: true } : {}), ...(conflict ? { conflict: true } : {}) };
  }
}
export async function approveGmailOperation(context: GmailExecutionContext, detail: string): Promise<void> {
  if (!await context.approve(detail)) throw new GmailOperationCancelled();
  context.assert();
}
