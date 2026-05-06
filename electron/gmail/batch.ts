/**
 * Operaciones batch contra Gmail API.
 *
 * Aisladas para que las funciones que las usan (apply, undo, emptyAndDelete)
 * no tengan que repetir el manejo de chunks ni los límites de 100 mensajes/req.
 */

import { chunkArray } from './helpers';
import type { GmailClient } from './types';

const GMAIL_BATCH_LIMIT = 100;
const MAX_DRAIN_ITERATIONS = 500;

/**
 * Aplica `addLabelIds`/`removeLabelIds` a un conjunto arbitrario de mensajes,
 * partiendo en chunks de 100 (límite de Gmail).
 */
export async function batchModifyMessageIds(
  gmail: GmailClient,
  messageIds: string[],
  addLabelIds: string[],
  removeLabelIds: string[],
): Promise<void> {
  for (const batch of chunkArray(messageIds, GMAIL_BATCH_LIMIT)) {
    await gmail.users.messages.batchModify({
      userId: 'me',
      requestBody: {
        ids: batch,
        addLabelIds,
        removeLabelIds,
      },
    });
  }
}

/**
 * Vacía completamente una etiqueta moviendo todos sus mensajes a otro lugar
 * (típicamente INBOX). Itera con paginación porque Gmail solo devuelve hasta
 * 100 mensajes por listado.
 *
 * Lanza si se alcanza el límite duro de iteraciones (~50,000 mensajes) para
 * evitar loops infinitos en caso de error de paginación.
 */
export async function drainLabelMessages(
  gmail: GmailClient,
  labelId: string,
  options?: { addLabels?: string[]; removeLabels?: string[] },
): Promise<{ processed: number; remaining: number }> {
  let totalProcessed = 0;
  let iterations = 0;

  while (iterations < MAX_DRAIN_ITERATIONS) {
    const listResponse = await gmail.users.messages.list({
      userId: 'me',
      labelIds: [labelId],
      maxResults: GMAIL_BATCH_LIMIT,
    });

    const messageIds = (listResponse.data.messages || [])
      .map((m: { id?: string }) => m.id)
      .filter(Boolean) as string[];
    if (messageIds.length === 0) break;

    await gmail.users.messages.batchModify({
      userId: 'me',
      requestBody: {
        ids: messageIds,
        addLabelIds: options?.addLabels || ['INBOX'],
        removeLabelIds: options?.removeLabels || [labelId],
      },
    });

    totalProcessed += messageIds.length;
    iterations += 1;
    console.log(
      `[GmailService] Batch modified ${messageIds.length} messages (label: ${labelId}), total: ${totalProcessed}`,
    );
  }

  if (iterations >= MAX_DRAIN_ITERATIONS) {
    throw new Error(`Se alcanzo el limite de iteraciones vaciando la etiqueta ${labelId}`);
  }

  const remainingResponse = await gmail.users.messages.list({
    userId: 'me',
    labelIds: [labelId],
    maxResults: 1,
  });

  return {
    processed: totalProcessed,
    remaining: (remainingResponse.data.messages || []).length,
  };
}
