import { describe, expect, it, vi } from 'vitest';
import { batchModifyEmailsByLabel, emptyAllGmailLabels, getEmails, modifyEmailLabels } from '../../services/gmail-service';

describe('Wrapper del buzón Gmail', () => {
  it('conserva progreso parcial y remaining desconocido sin reintentar', async () => {
    const result = { success: false, processed: 100, labelDeleted: false, partial: true, uncertain: true, recoveryRequired: true };
    const batch = vi.fn(async () => result); Object.assign(window, { gmail: { batchModifyByLabel: batch } });
    expect(await batchModifyEmailsByLabel('Work_1', { deleteLabel: true })).toBe(result);
    expect(batch).toHaveBeenCalledExactlyOnceWith('Work_1', { deleteLabel: true });
    expect(result).not.toHaveProperty('remaining');
  });
  it('no transforma un fallo de limpieza en éxito ni pierde sus conteos', async () => {
    const result = { success: false, labelsProcessed: 2, labelsDeleted: 1, totalMessagesMovedToInbox: 20, errors: ['Revisa Gmail'], remainingLabels: ['Otra'], remainingLabelsVerified: false };
    const empty = vi.fn(async () => result); Object.assign(window, { gmail: { emptyAndDeleteAllLabels: empty } });
    expect(await emptyAllGmailLabels()).toBe(result); expect(empty).toHaveBeenCalledExactlyOnceWith();
  });
  it('conserva opciones de lectura y etiquetas sin crear defaults ocultos', async () => {
    const get = vi.fn(async () => ({ success: true, messages: [] })), modify = vi.fn(async () => ({ success: true }));
    Object.assign(window, { gmail: { getMessages: get, modifyLabels: modify } });
    await getEmails({ maxResults: 10, pageToken: 'siguiente' }); await modifyEmailLabels('msg-0', ['Trabajo'], ['INBOX']);
    expect(get).toHaveBeenCalledExactlyOnceWith({ maxResults: 10, pageToken: 'siguiente' });
    expect(modify).toHaveBeenCalledExactlyOnceWith('msg-0', ['Trabajo'], ['INBOX']);
  });
});
