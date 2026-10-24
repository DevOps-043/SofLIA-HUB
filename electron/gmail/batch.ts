import { z } from 'zod';
import { gmailObjectIdSchema } from '../../src/shared/gmail-mailbox';
import type { GmailExecutionContext } from './execution-context';
import { GmailOperationLimitError, type GmailOperationProgress } from './operation-progress';

export const GMAIL_BATCH_LIMIT = 100;
export const GMAIL_SELECTION_LIMIT = 50_000;
const pageSchema = z.object({ messages: z.array(z.object({ id: gmailObjectIdSchema })).max(GMAIL_BATCH_LIMIT).optional(),
  nextPageToken: z.string().min(1).max(4096).optional(),
});
/** Snapshot completo antes de mutar: no vuelve a pedir la primera página alterada. */
export async function selectGmailLabelMessages(context: GmailExecutionContext, labelId: string, capacity = GMAIL_SELECTION_LIMIT): Promise<string[]> {
  const ids = new Set<string>(), tokens = new Set<string>();
  let pageToken: string | undefined;
  let pages = 0;
  do {
    if (++pages > GMAIL_SELECTION_LIMIT / GMAIL_BATCH_LIMIT + 1) throw new Error('Paginación excesiva.');
    const response = await context.call(client => client.users.messages.list({ userId: 'me', labelIds: [labelId], maxResults: GMAIL_BATCH_LIMIT, pageToken }, context.requestOptions()));
    const page = pageSchema.parse(response.data);
    for (const message of page.messages ?? []) {
      if (ids.has(message.id)) throw new Error('Mensaje repetido en la selección.');
      if (ids.size >= capacity) throw new GmailOperationLimitError('messages');
      ids.add(message.id);
    }
    pageToken = page.nextPageToken;
    if (pageToken && tokens.has(pageToken)) throw new Error('Paginación repetida.');
    if (pageToken) tokens.add(pageToken);
  } while (pageToken);
  return [...ids];
}
export async function applyGmailMessageBatches(context: GmailExecutionContext, progress: GmailOperationProgress,
  ids: string[], changes: { addLabelIds: string[]; removeLabelIds: string[] }, acknowledge: (count: number) => void): Promise<void> {
  for (let offset = 0; offset < ids.length; offset += GMAIL_BATCH_LIMIT) {
    const chunk = ids.slice(offset, offset + GMAIL_BATCH_LIMIT);
    await progress.write(context, client => client.users.messages.batchModify({ userId: 'me', requestBody: { ids: chunk, ...changes } }, context.requestOptions()),
      () => acknowledge(chunk.length));
  }
}
/** Devuelve sólo vacío/no vacío: un resultado de una página no es un conteo total. */
export async function isGmailLabelEmpty(context: GmailExecutionContext, id: string): Promise<boolean> {
  const response = await context.call(client => client.users.messages.list({ userId: 'me', labelIds: [id], maxResults: 1 }, context.requestOptions()));
  const messages = z.array(z.object({ id: gmailObjectIdSchema })).max(1).parse(response.data.messages ?? []);
  return messages.length === 0 && !response.data.nextPageToken;
}
