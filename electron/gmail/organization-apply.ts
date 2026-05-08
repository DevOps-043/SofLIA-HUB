import { batchModifyMessageIds } from './batch';
import { loadOrganizationPlan, saveOrganizationPlan } from './plan-storage';
import type {
  GmailClient,
  GmailLabelRecord,
  GmailOrganizationApplyResult,
  GmailOrganizationMessageChange,
} from './types';

type ClientProvider = () => Promise<{ client?: GmailClient; error?: string }>;

export async function applyGmailOrganizationPlan(
  getClient: ClientProvider,
  deps: {
    getLabels: () => Promise<{ success: boolean; labels?: GmailLabelRecord[]; error?: string }>;
    createLabel: (name: string) => Promise<{ success: boolean; label?: GmailLabelRecord; error?: string }>;
  },
  planId: string,
  options?: { removeFromInbox?: boolean },
): Promise<GmailOrganizationApplyResult> {
  const { client: gmail, error } = await getClient();
  if (!gmail) return applyFailure(planId, options?.removeFromInbox !== false, error);

  try {
    const plan = await loadOrganizationPlan(planId);
    const removeFromInbox = options?.removeFromInbox ?? plan.removeFromInbox;
    const existingLabels = await deps.getLabels();
    if (!existingLabels.success || !existingLabels.labels) throw new Error(existingLabels.error || 'No se pudieron leer las etiquetas antes de aplicar el plan.');

    const labelsByName = new Map(existingLabels.labels.map((label) => [label.name.toLowerCase(), label]));
    const messageMap = new Map(plan.messages.map((message) => [message.id, message]));
    const messageChanges: Record<string, GmailOrganizationMessageChange> = {};
    const labelsCreated: GmailLabelRecord[] = [];
    const labelsReused: GmailLabelRecord[] = [];
    const groupLabelIds: Record<string, string> = {};
    let messagesLabeled = 0;

    for (const group of plan.groups) {
      const label = await ensureGroupLabel(group.labelName, labelsByName, labelsCreated, labelsReused, deps.createLabel);
      groupLabelIds[group.groupKey] = label.id;
      await batchModifyMessageIds(gmail, group.messageIds, [label.id], removeFromInbox ? ['INBOX'] : []);
      messagesLabeled += group.messageIds.length;
      for (const messageId of group.messageIds) {
        const snapshot = messageMap.get(messageId);
        if (!snapshot) continue;
        messageChanges[messageId] = {
          addedLabelIds: snapshot.labelIds.includes(label.id) ? [] : [label.id],
          removedLabelIds: removeFromInbox && snapshot.labelIds.includes('INBOX') ? ['INBOX'] : [],
        };
      }
    }

    plan.status = 'applied';
    plan.removeFromInbox = removeFromInbox;
    plan.applyResult = { appliedAt: new Date().toISOString(), labelsCreated, labelsReused, groupLabelIds, messageChanges, removeFromInbox };
    await saveOrganizationPlan(plan);
    return { success: true, planId, groupsApplied: plan.groups.length, messagesLabeled, removeFromInbox, labelsCreated, labelsReused };
  } catch (err: any) {
    console.error('[GmailService] ApplyOrganizationPlan error:', err.message);
    return applyFailure(planId, options?.removeFromInbox !== false, err.message);
  }
}

async function ensureGroupLabel(
  labelName: string,
  labelsByName: Map<string, GmailLabelRecord>,
  labelsCreated: GmailLabelRecord[],
  labelsReused: GmailLabelRecord[],
  createLabel: (name: string) => Promise<{ success: boolean; label?: GmailLabelRecord; error?: string }>,
): Promise<GmailLabelRecord> {
  let label = labelsByName.get(labelName.toLowerCase());
  if (!label) {
    const created = await createLabel(labelName);
    if (!created.success || !created.label) throw new Error(created.error || `No se pudo crear la etiqueta ${labelName}.`);
    label = created.label;
    labelsByName.set(label.name.toLowerCase(), label);
    labelsCreated.push(label);
  } else if (!labelsReused.some((item) => item.id === label!.id)) {
    labelsReused.push(label);
  }
  return label;
}

function applyFailure(planId: string, removeFromInbox: boolean, error?: string): GmailOrganizationApplyResult {
  return { success: false, planId, groupsApplied: 0, messagesLabeled: 0, removeFromInbox, labelsCreated: [], labelsReused: [], error };
}
