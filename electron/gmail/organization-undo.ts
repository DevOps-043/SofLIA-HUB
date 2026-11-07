import { z } from 'zod';
import { gmailPlanIdSchema } from '../../src/shared/gmail-organization';
import { gmailObjectId, type PrivateGmailPlan } from './plan-schema';
import { currentMessageLabels, GMAIL_PLAN_FAILURE, GMAIL_PLAN_RECOVERY, persistPlanFailure, type GmailPlanContext } from './plan-context';
import { planEffect } from './plan-effects';
import { SYSTEM_LABEL_IDS } from './constants';
import type { GmailOrganizationUndoResult } from './types';
import { createLogger } from '../utils/logger';

const log = createLogger('gmail-plan-revertir');
class PlanConflict extends Error {}

export async function undoGmailOrganizationPlan(context: GmailPlanContext, inputId?: string): Promise<GmailOrganizationUndoResult> {
  let plan: PrivateGmailPlan | undefined;
  let finalized = false;
  try {
    if (inputId !== undefined) gmailPlanIdSchema.parse(inputId);
    const id = inputId ?? await context.store.latest(context.assert);
    if (!id) throw new Error('No existe un plan aplicado.');
    plan = await context.store.load(id, context.assert); context.assert();
    if (plan.status === 'undone' && !plan.pending) return result(plan, true);
    if (!plan.applyResult || plan.pending || !['applied', 'partial', 'undoing', 'applying'].includes(plan.status)) return result(plan, false, GMAIL_PLAN_RECOVERY, true);
    if (!await context.approve(`Revertir plan: ${plan.id}\nMensajes con cambios confirmados: ${Object.keys(plan.applyResult.messageChanges).length}\nEtiquetas creadas: ${plan.applyResult.labelsCreated.map(label => label.name).join(', ')}\nSólo se eliminarán etiquetas creadas que sigan vacías.`)) {
      return { ...result(plan, false, 'Reversión cancelada.'), cancelled: true };
    }
    plan.status = 'undoing'; plan.undoResult ??= { restored: [], deleted: [], retained: [] };
    await context.store.save(plan, context.assert);
    for (const [messageId, change] of Object.entries(plan.applyResult.messageChanges)) {
      if (plan.undoResult.restored.includes(messageId)) continue;
      const current = await currentMessageLabels(context, messageId);
      if (JSON.stringify([...new Set(current)].sort()) !== JSON.stringify([...change.expectedLabelIds].sort())) throw new PlanConflict();
      if (change.addedLabelIds.length || change.removedLabelIds.length) {
        await planEffect(context, plan, { kind: 'restore', messageIds: [messageId] },
          client => client.users.messages.modify({ userId: 'me', id: messageId, requestBody: { addLabelIds: change.removedLabelIds, removeLabelIds: change.addedLabelIds } }, context.requestOptions()),
          () => { plan!.undoResult!.restored.push(messageId); });
      } else {
        plan.undoResult.restored.push(messageId); await context.store.save(plan, context.assert);
      }
    }
    for (const label of plan.applyResult.labelsCreated) {
      if (SYSTEM_LABEL_IDS.has(label.id)) throw new Error('Etiqueta protegida.');
      if (plan.undoResult.deleted.includes(label.id) || plan.undoResult.retained.includes(label.id)) continue;
      const page = await context.call(client => client.users.messages.list({ userId: 'me', labelIds: [label.id], maxResults: 1 }, context.requestOptions()));
      const messages = z.array(z.object({ id: gmailObjectId })).max(1).parse(page.data.messages ?? []);
      if (messages.length) {
        plan.undoResult.retained.push(label.id); await context.store.save(plan, context.assert); continue;
      }
      await planEffect(context, plan, { kind: 'delete-label', labelId: label.id },
        client => client.users.labels.delete({ userId: 'me', id: label.id }, context.requestOptions()), () => { plan!.undoResult!.deleted.push(label.id); });
    }
    plan.status = 'undone'; plan.undoneAt = new Date().toISOString();
    await context.store.save(plan, context.assert); finalized = true; context.assert();
    return result(plan, true);
  } catch (error) {
    const conflict = error instanceof PlanConflict;
    if (plan?.applyResult && !finalized) {
      try { await persistPlanFailure(context, plan); } catch { log.warn('No se pudo cerrar la reversión; se conserva el checkpoint anterior.'); }
    }
    log.warn({ partial: Boolean(plan?.undoResult), uncertain: Boolean(plan?.pending), conflict }, 'No se completó la reversión del plan.');
    const response = plan ? result(plan, false, GMAIL_PLAN_RECOVERY, true) : { success: false, planId: '', messagesRestored: 0, labelsDeleted: 0, error: GMAIL_PLAN_FAILURE };
    return { ...response, ...(conflict ? { conflict: true } : {}) };
  }
}

function result(plan: PrivateGmailPlan, success: boolean, error?: string, recoveryRequired = false): GmailOrganizationUndoResult {
  return { success, planId: plan.id, messagesRestored: plan.undoResult?.restored.length ?? 0, labelsDeleted: plan.undoResult?.deleted.length ?? 0,
    labelsRetained: plan.undoResult?.retained.length ?? 0, ...(error ? { error } : {}),
    ...(recoveryRequired ? { partial: true, recoveryRequired: true } : {}), ...(plan.pending ? { uncertain: true } : {}) };
}
