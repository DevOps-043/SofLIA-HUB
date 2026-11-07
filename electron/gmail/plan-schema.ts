import { z } from 'zod';
import { gmailPlanIdSchema } from '../../src/shared/gmail-organization';
import { gmailObjectIdSchema } from '../../src/shared/gmail-mailbox';

export const gmailObjectId = gmailObjectIdSchema;
const ids = z.array(gmailObjectId).max(100);
const label = z.object({ id: gmailObjectId, name: z.string().min(1).max(225) }).strict();
const delta = z.object({ addedLabelIds: ids, removedLabelIds: ids, expectedLabelIds: ids }).strict();
export const gmailPlanOwnerSchema = z.object({ userId: z.string().min(1).max(320), email: z.email().max(320) }).strict();
export type GmailPlanOwner = z.infer<typeof gmailPlanOwnerSchema>;
export const gmailPrivatePlanSchema = z.object({
  id: gmailPlanIdSchema, createdAt: z.iso.datetime(), queryUsed: z.string().max(4096),
  removeFromInbox: z.boolean(), minGroupSize: z.number().int().min(1).max(20),
  scannedMessages: z.number().int().min(0).max(1000), truncated: z.boolean(),
  status: z.enum(['preview', 'applying', 'applied', 'undoing', 'undone', 'partial']),
  groups: z.array(z.object({ groupKey: z.string().min(1).max(512), labelName: z.string().min(1).max(225),
    count: z.number().int().min(1).max(1000), messageIds: z.array(gmailObjectId).min(1).max(1000),
  }).strict()).max(1000),
  pending: z.object({ kind: z.enum(['create-label', 'modify', 'restore', 'delete-label']),
    labelName: z.string().max(225).optional(), labelId: gmailObjectId.optional(), messageIds: ids.optional(),
    changes: z.record(gmailObjectId, delta).optional(),
  }).strict().optional(),
  applyResult: z.object({ appliedAt: z.iso.datetime(), labelsCreated: z.array(label).max(1000), labelsReused: z.array(label).max(1000),
    messageChanges: z.record(gmailObjectId, delta), removeFromInbox: z.boolean(),
    messagesLabeled: z.number().int().min(0).max(1000), completedGroups: z.array(z.string().max(512)).max(1000),
  }).strict().optional(),
  undoResult: z.object({ restored: z.array(gmailObjectId).max(1000), deleted: z.array(gmailObjectId).max(1000),
    retained: z.array(gmailObjectId).max(1000),
  }).strict().optional(), undoneAt: z.iso.datetime().optional(),
}).strict().superRefine((plan, ctx) => {
  const messageIds = plan.groups.flatMap(group => group.messageIds);
  if (new Set(messageIds).size !== messageIds.length || messageIds.length > plan.scannedMessages
    || new Set(plan.groups.map(group => group.groupKey)).size !== plan.groups.length
    || plan.groups.some(group => group.count !== group.messageIds.length)) ctx.addIssue({ code: 'custom', message: 'Referencias de plan inválidas.' });
  if (plan.status !== 'preview' && !plan.applyResult) ctx.addIssue({ code: 'custom', message: 'Falta el registro de aplicación.' });
  if (plan.applyResult && Object.keys(plan.applyResult.messageChanges).some(id => !messageIds.includes(id))) ctx.addIssue({ code: 'custom', message: 'Cambio fuera del plan.' });
  if (plan.applyResult && (plan.applyResult.messagesLabeled !== Object.keys(plan.applyResult.messageChanges).length
    || new Set(plan.applyResult.completedGroups).size !== plan.applyResult.completedGroups.length
    || plan.applyResult.completedGroups.some(key => !plan.groups.some(group => group.groupKey === key && group.messageIds.every(id => id in plan.applyResult!.messageChanges))))) {
    ctx.addIssue({ code: 'custom', message: 'Avance inconsistente.' });
  }
  if (plan.status === 'applied' && (plan.pending || plan.applyResult?.messagesLabeled !== messageIds.length
    || plan.applyResult.completedGroups.length !== plan.groups.length)) ctx.addIssue({ code: 'custom', message: 'Aplicación incompleta.' });
  if (plan.undoResult && (new Set(plan.undoResult.restored).size !== plan.undoResult.restored.length
    || plan.undoResult.restored.some(id => !plan.applyResult || !(id in plan.applyResult.messageChanges)))) ctx.addIssue({ code: 'custom', message: 'Reversión inconsistente.' });
  if (plan.status === 'undone' && (!plan.undoResult || plan.pending
    || plan.undoResult.restored.length !== Object.keys(plan.applyResult?.messageChanges ?? {}).length)) ctx.addIssue({ code: 'custom', message: 'Reversión incompleta.' });
  if (plan.pending?.kind === 'modify' && (!plan.pending.messageIds || !plan.pending.changes
    || plan.pending.messageIds.some(id => !messageIds.includes(id) || !(id in plan.pending!.changes!))
    || Object.keys(plan.pending.changes).length !== plan.pending.messageIds.length)) ctx.addIssue({ code: 'custom', message: 'Intención incompleta.' });
});
export type PrivateGmailPlan = z.infer<typeof gmailPrivatePlanSchema>;
