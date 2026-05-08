/**
 * GmailService — API pública del paquete Gmail.
 * La lógica de mensajes, labels y planes vive en módulos de dominio.
 */
import { EventEmitter } from 'node:events';
import type { CalendarService } from '../calendar-service';
import { createGmailClient } from './client';
import { emptyAndDeleteGmailUserLabels, type EmptyLabelsResult } from './label-cleanup';
import { createGmailLabel, deleteGmailLabel, listGmailLabels } from './label-operations';
import { findGmailLabelId, resolveGmailLabelIds } from './label-resolution';
import {
  batchModifyGmailByLabel,
  modifyGmailLabels,
  trashGmailMessage,
} from './message-label-operations';
import { getGmailMessage, getGmailMessages, sendGmailEmail } from './message-operations';
import { applyGmailOrganizationPlan } from './organization-apply';
import { previewGmailOrganizationPlan } from './organization-preview';
import { undoGmailOrganizationPlan } from './organization-undo';
import type {
  EmailMessage,
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
  constructor(private readonly calendarService: CalendarService) {
    super();
  }

  async getClient(): Promise<{ client?: GmailClient; error?: string }> {
    return createGmailClient(this.calendarService);
  }

  sendEmail(params: SendEmailParams): Promise<{ success: boolean; messageId?: string; error?: string }> {
    return sendGmailEmail(() => this.getClient(), params);
  }

  getMessages(options?: GetMessagesOptions): Promise<GetMessagesResult> {
    return getGmailMessages(() => this.getClient(), options);
  }

  getMessage(messageId: string): Promise<{ success: boolean; message?: EmailMessage; error?: string }> {
    return getGmailMessage(() => this.getClient(), messageId);
  }

  previewOrganizationPlan(options?: GmailOrganizationPreviewOptions): Promise<GmailOrganizationPreviewResult> {
    return previewGmailOrganizationPlan(options, { getLabels: () => this.getLabels(), getMessages: (input) => this.getMessages(input) });
  }

  applyOrganizationPlan(planId: string, options?: { removeFromInbox?: boolean }): Promise<GmailOrganizationApplyResult> {
    return applyGmailOrganizationPlan(() => this.getClient(), { getLabels: () => this.getLabels(), createLabel: (name) => this.createLabel(name) }, planId, options);
  }

  undoOrganizationPlan(planId?: string): Promise<GmailOrganizationUndoResult> {
    return undoGmailOrganizationPlan(planId, {
      modifyLabels: (messageId, addLabels, removeLabels) => this.modifyLabels(messageId, addLabels, removeLabels),
      getMessages: (options) => this.getMessages(options),
      deleteLabel: (labelId) => this.deleteLabel(labelId),
    });
  }

  modifyLabels(messageId: string, addLabels?: string[], removeLabels?: string[]): Promise<{ success: boolean; error?: string }> {
    return modifyGmailLabels(() => this.getClient(), (labels, options) => this.resolveLabelIds(labels, options), messageId, addLabels, removeLabels);
  }

  resolveLabelIds(labels: string[] | undefined, options: { createMissing: boolean }): Promise<string[]> {
    return resolveGmailLabelIds(labels, options, { getLabels: () => this.getLabels(), createLabel: (name) => this.createLabel(name) });
  }

  findLabelId(labels: GmailLabelRecord[], query: string): string | null {
    return findGmailLabelId(labels, query);
  }

  trashMessage(messageId: string): Promise<{ success: boolean; error?: string }> {
    return trashGmailMessage(() => this.getClient(), messageId);
  }

  createLabel(name: string): Promise<{ success: boolean; label?: GmailLabelRecord; error?: string }> {
    return createGmailLabel(() => this.getClient(), () => this.getLabels(), name);
  }

  batchModifyByLabel(labelId: string, options?: { addLabels?: string[]; removeLabels?: string[]; deleteLabel?: boolean }) {
    return batchModifyGmailByLabel(() => this.getClient(), labelId, options);
  }

  emptyAndDeleteAllLabels(): Promise<EmptyLabelsResult> {
    return emptyAndDeleteGmailUserLabels(() => this.getClient());
  }

  deleteLabel(labelId: string): Promise<{ success: boolean; error?: string }> {
    return deleteGmailLabel(() => this.getClient(), labelId);
  }

  getLabels(): Promise<{ success: boolean; labels?: GmailLabelRecord[]; error?: string }> {
    return listGmailLabels(() => this.getClient());
  }
}
