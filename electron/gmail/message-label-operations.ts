import { drainLabelMessages } from './batch';
import type { GmailClient } from './types';

type ClientProvider = () => Promise<{ client?: GmailClient; error?: string }>;

export async function modifyGmailLabels(
  getClient: ClientProvider,
  resolveLabelIds: (labels: string[] | undefined, options: { createMissing: boolean }) => Promise<string[]>,
  messageId: string,
  addLabels?: string[],
  removeLabels?: string[],
): Promise<{ success: boolean; error?: string }> {
  const { client: gmail, error } = await getClient();
  if (!gmail) return { success: false, error };

  try {
    const addLabelIds = await resolveLabelIds(addLabels, { createMissing: true });
    const removeLabelIds = await resolveLabelIds(removeLabels, { createMissing: false });
    await gmail.users.messages.modify({ userId: 'me', id: messageId, requestBody: { addLabelIds, removeLabelIds } });
    console.log(`[GmailService] Labels modified: ${messageId}`);
    return { success: true };
  } catch (err: any) {
    console.error('[GmailService] ModifyLabels error:', err.message);
    return { success: false, error: err.message };
  }
}

export async function trashGmailMessage(
  getClient: ClientProvider,
  messageId: string,
): Promise<{ success: boolean; error?: string }> {
  const { client: gmail, error } = await getClient();
  if (!gmail) return { success: false, error };

  try {
    await gmail.users.messages.trash({ userId: 'me', id: messageId });
    console.log(`[GmailService] Message trashed: ${messageId}`);
    return { success: true };
  } catch (err: any) {
    console.error('[GmailService] Trash error:', err.message);
    return { success: false, error: err.message };
  }
}

export async function batchModifyGmailByLabel(
  getClient: ClientProvider,
  labelId: string,
  options?: { addLabels?: string[]; removeLabels?: string[]; deleteLabel?: boolean },
): Promise<{ success: boolean; processed: number; remaining: number; labelDeleted: boolean; error?: string }> {
  const { client: gmail, error } = await getClient();
  if (!gmail) return { success: false, processed: 0, remaining: 0, labelDeleted: false, error };

  try {
    const { processed, remaining } = await drainLabelMessages(gmail, labelId, options);
    let labelDeleted = false;
    if (options?.deleteLabel && remaining === 0) {
      try {
        await gmail.users.labels.delete({ userId: 'me', id: labelId });
        labelDeleted = true;
        console.log(`[GmailService] Label ${labelId} deleted after batch move`);
      } catch (delErr: any) {
        console.warn(`[GmailService] Could not delete label ${labelId}:`, delErr.message);
      }
    }
    return { success: true, processed, remaining, labelDeleted };
  } catch (err: any) {
    console.error('[GmailService] BatchModifyByLabel error:', err.message);
    return { success: false, processed: 0, remaining: 0, labelDeleted: false, error: err.message };
  }
}
