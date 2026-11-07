import { buildEmailMessage } from './helpers';
import { createLogger } from '../utils/logger';
import type { GmailRequestOptions } from './client-types';
import { z } from 'zod';
import { gmailObjectIdSchema } from '../../src/shared/gmail-mailbox';
import type {
  EmailMessage,
  GetMessagesOptions,
  GetMessagesResult,
  GmailClient,
} from './types';

type ClientProvider = () => Promise<{ client?: GmailClient; error?: string }>;
const log = createLogger('gmail-mensajes');

export async function getGmailMessages(
  getClient: ClientProvider,
  options?: GetMessagesOptions,
  requireCompleteDetails = false,
  requestOptions?: GmailRequestOptions,
): Promise<GetMessagesResult> {
  const { client: gmail, error } = await getClient();
  if (!gmail) return { success: false, error };

  try {
    const maxResults = Math.max(1, Math.min(options?.maxResults || 20, 100));
    const listParams = {
      userId: 'me',
      maxResults,
      q: options?.query,
      labelIds: options?.labelIds,
      pageToken: options?.pageToken,
    };
    const listResponse = requestOptions ? await gmail.users.messages.list(listParams, requestOptions) : await gmail.users.messages.list(listParams);
    const messageIds = z.array(z.object({ id: gmailObjectIdSchema })).max(maxResults).parse(listResponse.data.messages ?? []);
    if (new Set(messageIds.map(message => message.id)).size !== messageIds.length) throw new Error('Listado de mensajes duplicado.');
    if (messageIds.length === 0) {
      return { success: true, messages: [], nextPageToken: listResponse.data.nextPageToken || undefined, resultSizeEstimate: listResponse.data.resultSizeEstimate || 0 };
    }
    const details = await Promise.allSettled(messageIds.map(msg => msg.id).map(async id => {
      const params = { userId: 'me', id, format: 'metadata', metadataHeaders: ['From', 'To', 'Subject', 'Date'] };
      const detail = requestOptions ? await gmail.users.messages.get(params, requestOptions) : await gmail.users.messages.get(params);
      if (detail.data.id !== id) throw new Error('Detalle de mensaje incompatible.');
      return detail;
    }));
    if (requireCompleteDetails && details.some(detail => detail.status === 'rejected')) throw new Error('Vista previa incompleta.');
    const messages = details.filter((d): d is PromiseFulfilledResult<any> => d.status === 'fulfilled').map((d) => buildEmailMessage(d.value));
    return { success: true, messages, nextPageToken: listResponse.data.nextPageToken || undefined, resultSizeEstimate: listResponse.data.resultSizeEstimate || messages.length };
  } catch {
    log.warn('No se pudo consultar la lista de mensajes.');
    return { success: false, error: 'No se pudieron consultar los mensajes de Gmail.' };
  }
}

export async function getGmailMessage(
  getClient: ClientProvider,
  messageId: string,
  requestOptions?: GmailRequestOptions,
): Promise<{ success: boolean; message?: EmailMessage; error?: string }> {
  const { client: gmail, error } = await getClient();
  if (!gmail) return { success: false, error };

  try {
    const params = { userId: 'me', id: messageId, format: 'full' };
    const detail = requestOptions ? await gmail.users.messages.get(params, requestOptions) : await gmail.users.messages.get(params);
    if (detail.data.id !== messageId) throw new Error('Mensaje incompatible.');
    return { success: true, message: buildEmailMessage(detail) };
  } catch {
    log.warn('No se pudo consultar el mensaje.');
    return { success: false, error: 'No se pudo consultar el mensaje Gmail.' };
  }
}
