/**
 * GmailService — API pública del paquete Gmail.
 * La lógica de mensajes, labels y planes vive en módulos de dominio.
 */
import { EventEmitter } from 'node:events';
import type { CalendarService } from '../calendar-service';
import { createGmailClient } from './client';
import { emptyAndDeleteGmailUserLabels, type EmptyLabelsResult } from './label-cleanup';
import { createGmailLabel, fetchGmailLabels, editableGmailLabel } from './label-operations';
import { findGmailLabelId } from './label-resolution';
import { gmailExecutionContext, type GmailExecutionContext, type GmailOperationAuthorization } from './execution-context';
import { GmailOperationProgress, GMAIL_OPERATION_FAILED, approveGmailOperation } from './operation-progress';
import { gmailListOptionsSchema, gmailObjectIdSchema, gmailLabelNameSchema,
  type GmailOperationResult, type GmailCreateLabelResult, type GmailLabelsResult, type GmailMessageResult, type GmailBatchOptions, type GmailBatchResult } from '../../src/shared/gmail-mailbox';
import {
  batchModifyGmailByLabel,
  modifyGmailLabels,
  trashGmailMessage,
} from './message-label-operations';
import { getGmailMessage, getGmailMessages } from './message-operations';
import { sendGmailEmail, type GmailSendAuthorization } from './delivery';
import type { GmailSendResult } from '../../src/shared/gmail-delivery';
import { applyGmailOrganizationPlan } from './organization-apply';
import { previewGmailOrganizationPlan } from './organization-preview';
import { undoGmailOrganizationPlan } from './organization-undo';
import { GmailPlanStore } from './plan-storage';
import { gmailPlanContext, currentGmailLabels, publicPlanError, GMAIL_PLAN_FAILURE, type GmailPlanAuthorization, type GmailPlanContext } from './plan-context';
import type {
  GetMessagesOptions,
  GetMessagesResult,
  GmailClient,
  GmailLabelRecord,
  GmailOrganizationApplyResult,
  GmailOrganizationPreviewOptions,
  GmailOrganizationPreviewResult,
  GmailOrganizationUndoResult,
  SendEmailParams,
} from './types';

export class GmailService extends EventEmitter {
  constructor(private readonly calendarService: CalendarService, private readonly planStore = new GmailPlanStore()) {
    super();
  }

  async getClient(): Promise<{ client?: GmailClient; error?: string }> {
    return createGmailClient(this.calendarService);
  }

  sendEmail(params: SendEmailParams, authorization?: GmailSendAuthorization): Promise<GmailSendResult> {
    return sendGmailEmail(() => this.getClient(), this.calendarService, params, authorization);
  }

  getMessages(options?: GetMessagesOptions, authorization?: GmailOperationAuthorization): Promise<GetMessagesResult> {
    return this.withMailbox(authorization, false, async context => {
      const parsed = gmailListOptionsSchema.parse(options === undefined ? {} : options);
      return context.call(client => getGmailMessages(async () => ({ client }), parsed, true, context.requestOptions()));
    }, { success: false, error: GMAIL_OPERATION_FAILED });
  }

  getMessage(messageId: string, authorization?: GmailOperationAuthorization): Promise<GmailMessageResult> {
    return this.withMailbox(authorization, false, async context => {
      const id = gmailObjectIdSchema.parse(messageId);
      return context.call(client => getGmailMessage(async () => ({ client }), id, context.requestOptions()));
    }, { success: false, error: GMAIL_OPERATION_FAILED });
  }

  previewOrganizationPlan(options?: GmailOrganizationPreviewOptions, authorization?: GmailPlanAuthorization): Promise<GmailOrganizationPreviewResult> {
    return this.withPlan(authorization, context => previewGmailOrganizationPlan(options,
      { getLabels: async () => ({ success: true, labels: await currentGmailLabels(context) }),
        getMessages: input => context.call(client => getGmailMessages(async () => ({ client }), input, true, context.requestOptions())) }, context),
    { success: false, error: GMAIL_PLAN_FAILURE });
  }

  applyOrganizationPlan(planId: string, options?: { removeFromInbox?: boolean }, authorization?: GmailPlanAuthorization): Promise<GmailOrganizationApplyResult> {
    return this.withPlan(authorization, context => applyGmailOrganizationPlan(context, planId, options),
      { success: false, planId: '', groupsApplied: 0, messagesLabeled: 0, removeFromInbox: true, labelsCreated: [], labelsReused: [], error: GMAIL_PLAN_FAILURE });
  }

  undoOrganizationPlan(planId?: string, authorization?: GmailPlanAuthorization): Promise<GmailOrganizationUndoResult> {
    return this.withPlan(authorization, context => undoGmailOrganizationPlan(context, planId),
      { success: false, planId: '', messagesRestored: 0, labelsDeleted: 0, error: GMAIL_PLAN_FAILURE });
  }

  private async withPlan<T>(authorization: GmailPlanAuthorization | undefined,
    operation: (context: GmailPlanContext) => Promise<T>, failure: T): Promise<T> {
    try {
      const context = gmailPlanContext(this.calendarService, this.planStore, () => this.getClient(), authorization);
      return await context.store.exclusive(() => operation(context));
    } catch (error) { return { ...failure, error: publicPlanError(error) }; }
  }

  private async withMailbox<T extends GmailOperationResult>(authorization: GmailOperationAuthorization | undefined, exclusive: boolean,
    operation: (context: GmailExecutionContext, progress: GmailOperationProgress) => Promise<T>, failure: T): Promise<T> {
    const progress = new GmailOperationProgress();
    let result: T | undefined;
    try {
      const context = gmailExecutionContext(this.calendarService, () => this.getClient(), authorization);
      const execute = async () => { context.assert(); result = await operation(context, progress); context.assert(); return result; };
      return await (exclusive ? this.planStore.account(context.owner).exclusive(execute) : execute());
    } catch (error) { return { ...(exclusive && result ? result : failure), ...progress.failure(error) }; }
  }

  modifyLabels(messageId: string, addLabels?: string[], removeLabels?: string[], authorization?: GmailOperationAuthorization): Promise<GmailOperationResult> {
    return this.withMailbox(authorization, true, (context, progress) => modifyGmailLabels(context, progress, messageId, addLabels, removeLabels), { success: false });
  }

  findLabelId(labels: GmailLabelRecord[], query: string): string | null {
    return findGmailLabelId(labels, query);
  }

  trashMessage(messageId: string, authorization?: GmailOperationAuthorization): Promise<GmailOperationResult> {
    return this.withMailbox(authorization, true, (context, progress) => trashGmailMessage(context, progress, messageId), { success: false });
  }

  createLabel(input: string, authorization?: GmailOperationAuthorization): Promise<GmailCreateLabelResult> {
    return this.withMailbox<GmailCreateLabelResult>(authorization, true, async (context, progress) => {
      const name = gmailLabelNameSchema.parse(input), labels = await fetchGmailLabels(context);
      const existing = labels.filter(label => label.name.toLowerCase() === name.toLowerCase());
      if (existing.length > 1) throw new Error('Nombre de etiqueta ambiguo.');
      if (existing.length) return { success: true, label: { id: existing[0].id, name: existing[0].name }, ...progress.result() };
      await approveGmailOperation(context, `Crear etiqueta: ${name}`);
      return { success: true, label: await createGmailLabel(context, progress, name), ...progress.result() };
    }, { success: false });
  }

  batchModifyByLabel(labelId: string, options?: GmailBatchOptions, authorization?: GmailOperationAuthorization): Promise<GmailBatchResult> {
    return this.withMailbox(authorization, true, (context, progress) => batchModifyGmailByLabel(context, progress, labelId, options),
      { success: false, processed: 0, labelDeleted: false });
  }

  emptyAndDeleteAllLabels(authorization?: GmailOperationAuthorization): Promise<EmptyLabelsResult> {
    return this.withMailbox(authorization, true, (context, progress) => emptyAndDeleteGmailUserLabels(context, progress),
      { success: false, labelsProcessed: 0, labelsDeleted: 0, totalMessagesMovedToInbox: 0, remainingLabels: [], errors: [GMAIL_OPERATION_FAILED] });
  }

  deleteLabel(input: string, authorization?: GmailOperationAuthorization): Promise<GmailOperationResult> {
    return this.withMailbox<GmailOperationResult>(authorization, true, async (context, progress) => {
      const id = gmailObjectIdSchema.parse(input), label = editableGmailLabel(await fetchGmailLabels(context), id);
      await approveGmailOperation(context, `Eliminar etiqueta: ${label.name} (${id})\nLa etiqueta se retira de todos sus mensajes; los correos se conservan.`);
      await progress.write(context, client => client.users.labels.delete({ userId: 'me', id }, context.requestOptions()));
      return { success: true, ...progress.result() };
    }, { success: false });
  }

  getLabels(authorization?: GmailOperationAuthorization): Promise<GmailLabelsResult> {
    return this.withMailbox<GmailLabelsResult>(authorization, false, async context => ({ success: true,
      labels: (await fetchGmailLabels(context)).map(label => ({ id: label.id, name: label.name })) }), { success: false });
  }
}
