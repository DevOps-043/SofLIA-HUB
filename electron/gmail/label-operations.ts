import { z } from 'zod';
import { gmailObjectIdSchema, gmailLabelNameSchema } from '../../src/shared/gmail-mailbox';
import { SYSTEM_LABEL_IDS } from './constants';
import type { GmailExecutionContext } from './execution-context';
import type { GmailOperationProgress } from './operation-progress';
import type { PreparedGmailLabels } from './label-resolution';

const labelSchema = z.object({ id: gmailObjectIdSchema, name: gmailLabelNameSchema, type: z.enum(['user', 'system']).optional() });
export type AccountGmailLabel = z.infer<typeof labelSchema>;
export async function fetchGmailLabels(context: GmailExecutionContext): Promise<AccountGmailLabel[]> {
  const response = await context.call(client => client.users.labels.list({ userId: 'me' }, context.requestOptions()));
  const labels = z.array(labelSchema).max(10000).parse(response.data.labels ?? []);
  if (new Set(labels.map(label => label.id)).size !== labels.length) throw new Error('Listado de etiquetas duplicado.');
  return labels;
}
export function editableGmailLabel(labels: AccountGmailLabel[], id: string): AccountGmailLabel {
  const label = labels.find(value => value.id === id);
  if (!label || SYSTEM_LABEL_IDS.has(id) || label.type !== 'user') throw new Error('Etiqueta no editable.');
  return label;
}
export async function createGmailLabel(context: GmailExecutionContext, progress: GmailOperationProgress, name: string) {
  const response = await progress.write(context,
    client => client.users.labels.create({ userId: 'me', requestBody: { name, labelListVisibility: 'labelShow', messageListVisibility: 'show' } }, context.requestOptions()),
    response => {
      const label = labelSchema.parse(response.data);
      if (SYSTEM_LABEL_IDS.has(label.id) || label.name !== name) throw new Error('Respuesta de etiqueta incompatible.');
      progress.labelsCreated.push({ id: label.id, name: label.name });
    });
  return { id: String(response.data.id), name };
}
export async function materializeGmailLabels(context: GmailExecutionContext, progress: GmailOperationProgress, prepared: PreparedGmailLabels) {
  const created = new Map<string, string>();
  for (const name of prepared.create) created.set(name, (await createGmailLabel(context, progress, name)).id);
  return { addLabelIds: prepared.add.map(ref => ref.id ?? created.get(ref.name)!), removeLabelIds: prepared.remove };
}
export const describeGmailLabels = (prepared: PreparedGmailLabels) =>
  `Añadir: ${prepared.add.map(ref => ref.name).join(', ') || 'ninguna'}\nQuitar: ${prepared.remove.join(', ') || 'ninguna'}\nCrear: ${prepared.create.join(', ') || 'ninguna'}`;
