import type { GmailClient, GmailLabelRecord } from './types';

type ClientProvider = () => Promise<{ client?: GmailClient; error?: string }>;

export async function listGmailLabels(
  getClient: ClientProvider,
): Promise<{ success: boolean; labels?: GmailLabelRecord[]; error?: string }> {
  const { client: gmail, error } = await getClient();
  if (!gmail) return { success: false, error };

  try {
    const response = await gmail.users.labels.list({ userId: 'me' });
    const labels = (response.data.labels || []).map((label: any) => ({
      id: label.id || '',
      name: label.name || '',
    }));
    return { success: true, labels };
  } catch (err: any) {
    console.error('[GmailService] GetLabels error:', err.message);
    return { success: false, error: err.message };
  }
}

export async function createGmailLabel(
  getClient: ClientProvider,
  getLabels: () => Promise<{ success: boolean; labels?: GmailLabelRecord[]; error?: string }>,
  name: string,
): Promise<{ success: boolean; label?: GmailLabelRecord; error?: string }> {
  const { client: gmail, error } = await getClient();
  if (!gmail) return { success: false, error };

  try {
    const response = await gmail.users.labels.create({
      userId: 'me',
      requestBody: { name, labelListVisibility: 'labelShow', messageListVisibility: 'show' },
    });
    console.log(`[GmailService] Label created: ${response.data.id} (${name})`);
    return { success: true, label: { id: response.data.id || '', name: response.data.name || '' } };
  } catch (err: any) {
    if (err.message?.includes('already exists') || err.code === 409) {
      const existing = await getLabels();
      const found = existing.labels?.find((label) => label.name.toLowerCase() === name.toLowerCase());
      if (found) return { success: true, label: found };
    }
    console.error('[GmailService] CreateLabel error:', err.message);
    return { success: false, error: err.message };
  }
}

export async function deleteGmailLabel(
  getClient: ClientProvider,
  labelId: string,
): Promise<{ success: boolean; error?: string }> {
  const { client: gmail, error } = await getClient();
  if (!gmail) return { success: false, error };

  try {
    await gmail.users.labels.delete({ userId: 'me', id: labelId });
    console.log(`[GmailService] Label deleted: ${labelId}`);
    return { success: true };
  } catch (err: any) {
    console.error('[GmailService] DeleteLabel error:', err.message);
    return { success: false, error: err.message };
  }
}
