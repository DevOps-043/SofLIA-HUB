import {
  findLatestAppliedOrganizationPlanId,
  loadOrganizationPlan,
  saveOrganizationPlan,
} from './plan-storage';
import type {
  GetMessagesOptions,
  GetMessagesResult,
  GmailOrganizationUndoResult,
} from './types';

export async function undoGmailOrganizationPlan(
  planId: string | undefined,
  deps: {
    modifyLabels: (messageId: string, addLabels?: string[], removeLabels?: string[]) => Promise<{ success: boolean; error?: string }>;
    getMessages: (options?: GetMessagesOptions) => Promise<GetMessagesResult>;
    deleteLabel: (labelId: string) => Promise<{ success: boolean; error?: string }>;
  },
): Promise<GmailOrganizationUndoResult> {
  try {
    const resolvedPlanId = planId || (await findLatestAppliedOrganizationPlanId());
    if (!resolvedPlanId) return undoFailure(planId || '', 'No encontre un plan de organización aplicado para revertir.');

    const plan = await loadOrganizationPlan(resolvedPlanId);
    if (!plan.applyResult) return undoFailure(resolvedPlanId, 'Ese plan todavia no ha sido aplicado.');

    let messagesRestored = 0;
    for (const [messageId, change] of Object.entries(plan.applyResult.messageChanges)) {
      const result = await deps.modifyLabels(messageId, change.removedLabelIds, change.addedLabelIds);
      if (!result.success) throw new Error(result.error || `No se pudo revertir el mensaje ${messageId}.`);
      messagesRestored += 1;
    }

    const labelsDeleted = await deleteEmptyCreatedLabels(plan.applyResult.labelsCreated, deps);
    plan.status = 'undone';
    plan.undoneAt = new Date().toISOString();
    await saveOrganizationPlan(plan);
    return { success: true, planId: resolvedPlanId, messagesRestored, labelsDeleted };
  } catch (err: any) {
    console.error('[GmailService] UndoOrganizationPlan error:', err.message);
    return undoFailure(planId || '', err.message);
  }
}

async function deleteEmptyCreatedLabels(
  labels: Array<{ id: string; name: string }>,
  deps: {
    getMessages: (options?: GetMessagesOptions) => Promise<GetMessagesResult>;
    deleteLabel: (labelId: string) => Promise<{ success: boolean; error?: string }>;
  },
): Promise<number> {
  let labelsDeleted = 0;
  for (const label of labels) {
    const labelMessages = await deps.getMessages({ labelIds: [label.id], maxResults: 1 });
    if (labelMessages.success && (labelMessages.messages?.length || 0) === 0) {
      const deleteResult = await deps.deleteLabel(label.id);
      if (deleteResult.success) labelsDeleted += 1;
    }
  }
  return labelsDeleted;
}

function undoFailure(planId: string, error: string): GmailOrganizationUndoResult {
  return { success: false, planId, messagesRestored: 0, labelsDeleted: 0, error };
}
