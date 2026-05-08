import { buildEmailMessage } from './helpers';
import { buildRawMessage } from './raw-message';
import { validateEmailMessageSecurity } from './security';
import type {
  EmailMessage,
  GetMessagesOptions,
  GetMessagesResult,
  GmailClient,
  SendEmailParams,
} from './types';

type ClientProvider = () => Promise<{ client?: GmailClient; error?: string }>;

export async function sendGmailEmail(
  getClient: ClientProvider,
  params: SendEmailParams,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    validateEmailMessageSecurity(params);
  } catch (validationErr: any) {
    console.error('[GmailService] Send error (Security):', validationErr.message);
    return { success: false, error: validationErr.message };
  }

  const { client: gmail, error } = await getClient();
  if (!gmail) return { success: false, error };

  try {
    const rawMessage = await buildRawMessage(params);
    const encodedMessage = Buffer.from(rawMessage).toString('base64url');
    const response = await gmail.users.messages.send({ userId: 'me', requestBody: { raw: encodedMessage } });
    console.log(`[GmailService] Email sent: ${response.data.id}`);
    return { success: true, messageId: response.data.id || undefined };
  } catch (err: any) {
    console.error('[GmailService] Send error:', err.message);
    return { success: false, error: err.message };
  }
}

export async function getGmailMessages(
  getClient: ClientProvider,
  options?: GetMessagesOptions,
): Promise<GetMessagesResult> {
  const { client: gmail, error } = await getClient();
  if (!gmail) return { success: false, error };

  try {
    const maxResults = Math.max(1, Math.min(options?.maxResults || 20, 100));
    const listResponse = await gmail.users.messages.list({
      userId: 'me',
      maxResults,
      q: options?.query,
      labelIds: options?.labelIds,
      pageToken: options?.pageToken,
    });
    const messageIds = listResponse.data.messages || [];
    if (messageIds.length === 0) {
      return { success: true, messages: [], nextPageToken: listResponse.data.nextPageToken || undefined, resultSizeEstimate: listResponse.data.resultSizeEstimate || 0 };
    }
    const details = await Promise.allSettled(messageIds.map((msg: any) => msg.id).filter(Boolean).map((id: string) =>
      gmail.users.messages.get({ userId: 'me', id, format: 'metadata', metadataHeaders: ['From', 'To', 'Subject', 'Date'] }),
    ));
    const messages = details.filter((d): d is PromiseFulfilledResult<any> => d.status === 'fulfilled').map((d) => buildEmailMessage(d.value));
    return { success: true, messages, nextPageToken: listResponse.data.nextPageToken || undefined, resultSizeEstimate: listResponse.data.resultSizeEstimate || messages.length };
  } catch (err: any) {
    console.error('[GmailService] GetMessages error:', err.message);
    return { success: false, error: err.message };
  }
}

export async function getGmailMessage(
  getClient: ClientProvider,
  messageId: string,
): Promise<{ success: boolean; message?: EmailMessage; error?: string }> {
  const { client: gmail, error } = await getClient();
  if (!gmail) return { success: false, error };

  try {
    const detail = await gmail.users.messages.get({ userId: 'me', id: messageId, format: 'full' });
    return { success: true, message: buildEmailMessage(detail) };
  } catch (err: any) {
    console.error('[GmailService] GetMessage error:', err.message);
    return { success: false, error: err.message };
  }
}
