import type {
  GmailOrganizationApplyResult,
  GmailOrganizationPreviewResult,
  GmailOrganizationUndoResult,
  SendEmailParams,
} from './gmail/types';
import './gmail/window-api';

export async function sendEmail(params: SendEmailParams) {
  return window.gmail.send(params);
}

export async function getEmails(options?: { maxResults?: number; query?: string; labelIds?: string[]; pageToken?: string }) {
  return window.gmail.getMessages(options);
}

export async function getEmail(messageId: string) {
  return window.gmail.getMessage(messageId);
}

export async function modifyEmailLabels(messageId: string, addLabels?: string[], removeLabels?: string[]) {
  return window.gmail.modifyLabels(messageId, addLabels, removeLabels);
}

export async function trashEmail(messageId: string) {
  return window.gmail.trash(messageId);
}

export async function getGmailLabels() {
  return window.gmail.getLabels();
}

export async function createGmailLabel(name: string) {
  return window.gmail.createLabel(name);
}

export async function deleteGmailLabel(labelId: string) {
  return window.gmail.deleteLabel(labelId);
}

export async function previewGmailOrganization(options?: { query?: string; maxMessages?: number; minGroupSize?: number; removeFromInbox?: boolean; pageLimit?: number }): Promise<GmailOrganizationPreviewResult> {
  return window.gmail.previewOrganization(options);
}

export async function applyGmailOrganizationPlan(planId: string, options?: { removeFromInbox?: boolean }): Promise<GmailOrganizationApplyResult> {
  return window.gmail.applyOrganizationPlan(planId, options);
}

export async function undoGmailOrganizationPlan(planId?: string): Promise<GmailOrganizationUndoResult> {
  return window.gmail.undoOrganizationPlan(planId);
}

export async function batchModifyEmailsByLabel(
  labelId: string,
  options?: { addLabels?: string[]; removeLabels?: string[]; deleteLabel?: boolean },
) {
  return window.gmail.batchModifyByLabel(labelId, options);
}

export async function emptyAllGmailLabels() {
  return window.gmail.emptyAndDeleteAllLabels();
}

export async function markAsRead(messageId: string) {
  return window.gmail.modifyLabels(messageId, undefined, ['UNREAD']);
}

export async function archiveEmail(messageId: string) {
  return window.gmail.modifyLabels(messageId, undefined, ['INBOX']);
}

export type {
  EmailMessage,
  GmailLabel,
  GmailOrganizationApplyResult,
  GmailOrganizationPreviewGroup,
  GmailOrganizationPreviewResult,
  GmailOrganizationUndoResult,
  SendEmailParams,
} from './gmail/types';
