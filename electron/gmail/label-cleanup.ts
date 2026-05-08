import { drainLabelMessages } from './batch';
import { SYSTEM_LABEL_IDS } from './constants';
import type { GmailClient } from './types';

type ClientProvider = () => Promise<{ client?: GmailClient; error?: string }>;

export type EmptyLabelsResult = {
  success: boolean;
  labelsProcessed: number;
  labelsDeleted: number;
  totalMessagesMovedToInbox: number;
  remainingLabels: string[];
  errors: string[];
};

export async function emptyAndDeleteGmailUserLabels(
  getClient: ClientProvider,
): Promise<EmptyLabelsResult> {
  const { client: gmail, error } = await getClient();
  if (!gmail) {
    return emptyLabelsFailure(error || 'Google no conectado');
  }

  try {
    const labelsResponse = await gmail.users.labels.list({ userId: 'me' });
    const userLabels = (labelsResponse.data.labels || []).filter(isUserEditableLabel);
    const result = await drainAndDeleteLabels(gmail, userLabels);
    const remainingLabels = await listRemainingUserLabels(gmail);
    return { success: true, ...result, remainingLabels };
  } catch (err: any) {
    console.error('[GmailService] EmptyAndDeleteAllLabels error:', err.message);
    return emptyLabelsFailure(err.message);
  }
}

function emptyLabelsFailure(message: string): EmptyLabelsResult {
  return {
    success: false,
    labelsProcessed: 0,
    labelsDeleted: 0,
    totalMessagesMovedToInbox: 0,
    remainingLabels: [],
    errors: [message],
  };
}

function isUserEditableLabel(label: any): boolean {
  return Boolean(label.id && !SYSTEM_LABEL_IDS.has(label.id) && label.type === 'user');
}

async function drainAndDeleteLabels(gmail: GmailClient, labels: any[]) {
  let labelsProcessed = 0;
  let labelsDeleted = 0;
  let totalMessagesMovedToInbox = 0;
  const errors: string[] = [];

  for (const label of labels) {
    if (!label.id) continue;
    try {
      const { processed, remaining } = await drainLabelMessages(gmail, label.id);
      totalMessagesMovedToInbox += processed;
      labelsProcessed += 1;
      if (remaining === 0) {
        await gmail.users.labels.delete({ userId: 'me', id: label.id });
        labelsDeleted += 1;
        console.log(`[GmailService] Emptied (${processed} msgs) and deleted label: ${label.name} (${label.id})`);
      } else {
        errors.push(`La etiqueta "${label.name}" aun tiene correos pendientes; no se elimino.`);
      }
    } catch (labelErr: any) {
      errors.push(`Error procesando "${label.name}": ${labelErr.message}`);
    }
  }

  return { labelsProcessed, labelsDeleted, totalMessagesMovedToInbox, errors };
}

async function listRemainingUserLabels(gmail: GmailClient): Promise<string[]> {
  const verifyResponse = await gmail.users.labels.list({ userId: 'me' });
  return (verifyResponse.data.labels || [])
    .filter(isUserEditableLabel)
    .map((label: any) => label.name || label.id || 'unknown');
}
