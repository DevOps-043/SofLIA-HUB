import { gmailBatchOptionsSchema, gmailModifyLabelsSchema, gmailObjectIdSchema, type GmailBatchOptions, type GmailBatchResult } from '../../src/shared/gmail-mailbox';
import { applyGmailMessageBatches, isGmailLabelEmpty, selectGmailLabelMessages } from './batch';
import { editableGmailLabel, fetchGmailLabels, materializeGmailLabels, describeGmailLabels } from './label-operations';
import { prepareGmailLabels } from './label-resolution';
import { approveGmailOperation, GmailOperationConflict, type GmailOperationProgress } from './operation-progress';
import type { GmailExecutionContext } from './execution-context';

export async function modifyGmailLabels(context: GmailExecutionContext, progress: GmailOperationProgress,
  messageId: string, addLabels?: string[], removeLabels?: string[]) {
  const input = gmailModifyLabelsSchema.parse({ messageId, addLabels, removeLabels });
  const prepared = prepareGmailLabels(await fetchGmailLabels(context), input.addLabels, input.removeLabels);
  await approveGmailOperation(context, `Modificar mensaje: ${input.messageId}\n${describeGmailLabels(prepared)}`);
  const changes = await materializeGmailLabels(context, progress, prepared);
  await progress.write(context, client => client.users.messages.modify({ userId: 'me', id: input.messageId, requestBody: changes }, context.requestOptions()));
  return { success: true, ...progress.result() };
}
export async function trashGmailMessage(context: GmailExecutionContext, progress: GmailOperationProgress, input: string) {
  const id = gmailObjectIdSchema.parse(input);
  await approveGmailOperation(context, `Mover a la papelera el mensaje: ${id}\nSe podrá recuperar desde la papelera de Gmail.`);
  await progress.write(context, client => client.users.messages.trash({ userId: 'me', id }, context.requestOptions()));
  return { success: true, ...progress.result() };
}
export async function batchModifyGmailByLabel(context: GmailExecutionContext, progress: GmailOperationProgress,
  inputId: string, options?: GmailBatchOptions): Promise<GmailBatchResult> {
  let processed = 0, labelDeleted = false;
  let remaining: number | undefined, sourceEmpty: boolean | undefined;
  try {
    const id = gmailObjectIdSchema.parse(inputId), parsed = gmailBatchOptionsSchema.parse(options === undefined ? {} : options);
    const labels = await fetchGmailLabels(context), label = labels.find(value => value.id === id);
    if (!label) throw new Error('La etiqueta de origen no existe.');
    if (parsed.deleteLabel) editableGmailLabel(labels, id);
    const prepared = prepareGmailLabels(labels, parsed.addLabels ?? ['INBOX'], parsed.removeLabels ?? [id]);
    if (!prepared.add.length && !prepared.remove.length && !parsed.deleteLabel) throw new Error('Operación vacía.');
    const ids = await selectGmailLabelMessages(context, id);
    if (parsed.deleteLabel && ids.length && !prepared.remove.includes(id)) throw new Error('El borrado requiere retirar la etiqueta de origen.');
    await approveGmailOperation(context, `Procesar etiqueta: ${label.name} (${id})\nMensajes seleccionados: ${ids.length}\n${describeGmailLabels(prepared)}\nEliminar etiqueta si queda vacía: ${parsed.deleteLabel ? 'sí' : 'no'}\nLos mensajes nuevos quedan fuera de esta selección.`);
    const changes = await materializeGmailLabels(context, progress, prepared);
    await applyGmailMessageBatches(context, progress, ids, changes, count => { processed += count; });
    sourceEmpty = await isGmailLabelEmpty(context, id);
    if (sourceEmpty) remaining = 0;
    if (parsed.deleteLabel) {
      if (!sourceEmpty) throw new GmailOperationConflict();
      await progress.write(context, client => client.users.labels.delete({ userId: 'me', id }, context.requestOptions()), () => { labelDeleted = true; });
    }
    return { success: true, processed, remaining, sourceEmpty, labelDeleted, ...progress.result() };
  } catch (error) { return { ...progress.failure(error), processed, remaining, sourceEmpty, labelDeleted }; }
}
