import { gmailApplyOptionsSchema, gmailPlanIdSchema } from '../../src/shared/gmail-organization';
import { SYSTEM_LABEL_IDS } from './constants';
import type { PrivateGmailPlan } from './plan-schema';
import { currentBatchLabels, currentGmailLabels, parsePlanLabel, GMAIL_PLAN_FAILURE, GMAIL_PLAN_RECOVERY, persistPlanFailure, type GmailPlanContext } from './plan-context';
import { planEffect } from './plan-effects';
import type { GmailOrganizationApplyResult, GmailLabelRecord } from './types';
import { createLogger } from '../utils/logger';
import { GMAIL_BATCH_LIMIT } from './batch';

const log = createLogger('gmail-plan-aplicar');

export async function applyGmailOrganizationPlan(context: GmailPlanContext, planId: string,
  options?: { removeFromInbox?: boolean }): Promise<GmailOrganizationApplyResult> {
  let plan: PrivateGmailPlan | undefined;
  let finalized = false;
  try {
    gmailPlanIdSchema.parse(planId);
    const parsed = gmailApplyOptionsSchema.parse(options === undefined ? {} : options);
    plan = await context.store.load(planId, context.assert);
    context.assert();
    const remove = parsed.removeFromInbox ?? plan.removeFromInbox;
    if (plan.status === 'applied' && !plan.pending) {
      if (remove !== plan.applyResult!.removeFromInbox) return result(plan, false, 'El plan ya fue aplicado con otras opciones. Crea una vista previa nueva.');
      return result(plan, true);
    }
    if (plan.status !== 'preview' || plan.pending) return result(plan, false, GMAIL_PLAN_RECOVERY, true);
    if (!await context.approve(`Aplicar plan: ${plan.id}\nMensajes: ${plan.groups.reduce((sum, group) => sum + group.count, 0)}\nQuitar de Recibidos: ${remove ? 'sí' : 'no'}\nEtiquetas:\n${plan.groups.map(group => `${group.labelName}: ${group.count}`).join('\n')}`)) {
      return { ...result(plan, false, 'Aplicación cancelada.'), cancelled: true };
    }
    plan.status = 'applying'; plan.removeFromInbox = remove;
    plan.applyResult = { appliedAt: new Date().toISOString(), labelsCreated: [], labelsReused: [], messageChanges: {},
      removeFromInbox: remove, messagesLabeled: 0, completedGroups: [] };
    await context.store.save(plan, context.assert);
    const labels = (await currentGmailLabels(context)).filter(label => !SYSTEM_LABEL_IDS.has(label.id));
    const byName = new Map(labels.map(label => [label.name.toLowerCase(), label]));
    for (const group of plan.groups) {
      const label = await groupLabel(context, plan, group.labelName, byName);
      for (let offset = 0; offset < group.messageIds.length; offset += GMAIL_BATCH_LIMIT) {
        const batch = group.messageIds.slice(offset, offset + GMAIL_BATCH_LIMIT);
        const changes: NonNullable<PrivateGmailPlan['applyResult']>['messageChanges'] = {};
        const snapshots = await currentBatchLabels(context, batch);
        for (const id of batch) {
          const before = snapshots.get(id)!;
          changes[id] = { addedLabelIds: before.includes(label.id) ? [] : [label.id],
            removedLabelIds: remove && before.includes('INBOX') ? ['INBOX'] : [],
            expectedLabelIds: [...new Set([...before.filter(value => !remove || value !== 'INBOX'), label.id])].sort() };
        }
        await planEffect(context, plan, { kind: 'modify', messageIds: batch, labelId: label.id, changes },
          client => client.users.messages.batchModify({ userId: 'me', requestBody: { ids: batch, addLabelIds: [label.id], removeLabelIds: remove ? ['INBOX'] : [] } }, context.requestOptions()),
          () => { Object.assign(plan!.applyResult!.messageChanges, changes); plan!.applyResult!.messagesLabeled += batch.length; });
      }
      plan.applyResult.completedGroups.push(group.groupKey);
      await context.store.save(plan, context.assert);
    }
    plan.status = 'applied'; plan.applyResult.appliedAt = new Date().toISOString();
    await context.store.save(plan, context.assert); finalized = true; context.assert();
    return result(plan, true);
  } catch {
    if (plan?.applyResult && !finalized && plan.status !== 'undone') {
      try { await persistPlanFailure(context, plan); } catch { log.warn('No se pudo cerrar el registro del plan; se conserva el checkpoint anterior.'); }
    }
    log.warn({ partial: Boolean(plan?.applyResult), uncertain: Boolean(plan?.pending) }, 'No se completó la aplicación del plan.');
    return plan ? result(plan, false, plan.applyResult ? GMAIL_PLAN_RECOVERY : GMAIL_PLAN_FAILURE, Boolean(plan.applyResult))
      : { success: false, planId: '', groupsApplied: 0, messagesLabeled: 0, removeFromInbox: true, labelsCreated: [], labelsReused: [], error: GMAIL_PLAN_FAILURE };
  }
}

async function groupLabel(context: GmailPlanContext, plan: PrivateGmailPlan, name: string, byName: Map<string, GmailLabelRecord>) {
  const existing = byName.get(name.toLowerCase());
  if (existing) {
    if (!plan.applyResult!.labelsCreated.some(label => label.id === existing.id)
      && !plan.applyResult!.labelsReused.some(label => label.id === existing.id)) plan.applyResult!.labelsReused.push(existing);
    return existing;
  }
  let created!: GmailLabelRecord;
  await planEffect(context, plan, { kind: 'create-label', labelName: name },
    client => client.users.labels.create({ userId: 'me', requestBody: { name, labelListVisibility: 'labelShow', messageListVisibility: 'show' } }, context.requestOptions()),
    response => {
      created = parsePlanLabel(response.data);
      if (SYSTEM_LABEL_IDS.has(created.id) || created.name !== name) throw new Error('Etiqueta incompatible.');
      plan.applyResult!.labelsCreated.push(created); byName.set(name.toLowerCase(), created);
    });
  return created;
}

function result(plan: PrivateGmailPlan, success: boolean, error?: string, recoveryRequired = false): GmailOrganizationApplyResult {
  return { success, planId: plan.id, groupsApplied: plan.applyResult?.completedGroups.length ?? 0,
    messagesLabeled: plan.applyResult?.messagesLabeled ?? 0, removeFromInbox: plan.applyResult?.removeFromInbox ?? plan.removeFromInbox,
    labelsCreated: plan.applyResult?.labelsCreated ?? [], labelsReused: plan.applyResult?.labelsReused ?? [],
    ...(error ? { error } : {}), ...(recoveryRequired ? { partial: true, recoveryRequired: true } : {}), ...(plan.pending ? { uncertain: true } : {}) };
}
