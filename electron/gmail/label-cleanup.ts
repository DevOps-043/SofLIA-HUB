import type { GmailEmptyLabelsResult } from '../../src/shared/gmail-mailbox';
import { applyGmailMessageBatches, isGmailLabelEmpty, selectGmailLabelMessages, GMAIL_SELECTION_LIMIT } from './batch';
import { SYSTEM_LABEL_IDS } from './constants';
import { fetchGmailLabels } from './label-operations';
import { approveGmailOperation, GmailOperationConflict, GmailOperationLimitError, type GmailOperationProgress } from './operation-progress';
import type { GmailExecutionContext } from './execution-context';

export type EmptyLabelsResult = GmailEmptyLabelsResult;
export const GMAIL_CLEANUP_LABEL_LIMIT = 100;
export async function emptyAndDeleteGmailUserLabels(context: GmailExecutionContext, progress: GmailOperationProgress): Promise<EmptyLabelsResult> {
  let labelsProcessed = 0, labelsDeleted = 0, totalMessagesMovedToInbox = 0;
  let remainingLabels: string[] = [], remainingLabelsVerified = false;
  try {
    const available = await fetchGmailLabels(context);
    if (available.some(label => !label.type)) throw new Error('Listado sin clasificación de etiquetas.');
    const labels = available.filter(label => label.type === 'user' && !SYSTEM_LABEL_IDS.has(label.id));
    remainingLabels = labels.map(label => label.name);
    const remainingById = new Map(labels.map(label => [label.id, label.name]));
    if (labels.length > GMAIL_CLEANUP_LABEL_LIMIT) throw new GmailOperationLimitError('labels');
    const selected: Array<{ id: string; name: string; messages: string[] }> = [];
    let memberships = 0;
    for (const label of labels) {
      const messages = await selectGmailLabelMessages(context, label.id, GMAIL_SELECTION_LIMIT - memberships);
      memberships += messages.length; selected.push({ id: label.id, name: label.name, messages });
    }
    await approveGmailOperation(context, `Vaciar y eliminar ${labels.length} etiquetas de usuario.\nMembresías de mensajes seleccionadas: ${memberships}\nLos correos se mueven a Recibidos y se conservan.\n${selected.map(label => `${label.name} (${label.id}): ${label.messages.length}`).join('\n')}\nLos mensajes nuevos quedan fuera; una etiqueta que no esté vacía se conservará.`);
    for (const label of selected) {
      await applyGmailMessageBatches(context, progress, label.messages, { addLabelIds: ['INBOX'], removeLabelIds: [label.id] }, count => { totalMessagesMovedToInbox += count; });
      labelsProcessed++;
      if (!await isGmailLabelEmpty(context, label.id)) throw new GmailOperationConflict();
      await progress.write(context, client => client.users.labels.delete({ userId: 'me', id: label.id }, context.requestOptions()), () => {
        labelsDeleted++; remainingById.delete(label.id); remainingLabels = [...remainingById.values()];
      });
    }
    const verified = await fetchGmailLabels(context);
    if (verified.some(label => !label.type)) throw new Error('Verificación incompleta de etiquetas.');
    remainingLabels = verified.filter(label => label.type === 'user' && !SYSTEM_LABEL_IDS.has(label.id)).map(label => label.name);
    remainingLabelsVerified = true;
    if (remainingLabels.length) throw new GmailOperationConflict();
    return { success: true, labelsProcessed, labelsDeleted, totalMessagesMovedToInbox, remainingLabels, remainingLabelsVerified, errors: [], ...progress.result() };
  } catch (error) {
    const failure = progress.failure(error);
    return { ...failure, labelsProcessed, labelsDeleted, totalMessagesMovedToInbox, remainingLabels, remainingLabelsVerified, errors: [failure.error!] };
  }
}
