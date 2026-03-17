/**
 * Gmail renderer-side service.
 * Typed wrappers for the window.gmail bridge exposed via preload.
 */

// ─── Types ──────────────────────────────────────────────────────────

export interface EmailMessage {
  id: string
  threadId: string
  from: string
  to: string[]
  subject: string
  snippet: string
  body?: string
  date: Date
  labelIds: string[]
  isUnread: boolean
}

export interface SendEmailParams {
  to: string[]
  subject: string
  body: string
  cc?: string[]
  bcc?: string[]
  isHtml?: boolean
  attachmentPaths?: string[]
}

export interface GmailLabel {
  id: string
  name: string
}

export interface GmailOrganizationPreviewGroup {
  groupKey: string
  labelName: string
  count: number
  domains: string[]
  sampleSenders: string[]
  sampleSubjects: string[]
  existingLabelId?: string
}

export interface GmailOrganizationPreviewResult {
  success: boolean
  planId?: string
  queryUsed?: string
  scannedMessages?: number
  groupedMessages?: number
  uncategorizedMessages?: number
  truncated?: boolean
  removeFromInbox?: boolean
  groups?: GmailOrganizationPreviewGroup[]
  error?: string
}

export interface GmailOrganizationApplyResult {
  success: boolean
  planId: string
  groupsApplied: number
  messagesLabeled: number
  removeFromInbox: boolean
  labelsCreated: GmailLabel[]
  labelsReused: GmailLabel[]
  error?: string
}

export interface GmailOrganizationUndoResult {
  success: boolean
  planId: string
  messagesRestored: number
  labelsDeleted: number
  error?: string
}

// ─── Window type augmentation ───────────────────────────────────────

declare global {
  interface Window {
    gmail: {
      send: (params: SendEmailParams) => Promise<{ success: boolean; messageId?: string; error?: string }>
      getMessages: (options?: { maxResults?: number; query?: string; labelIds?: string[]; pageToken?: string }) => Promise<{ success: boolean; messages?: EmailMessage[]; nextPageToken?: string; resultSizeEstimate?: number; error?: string }>
      getMessage: (messageId: string) => Promise<{ success: boolean; message?: EmailMessage; error?: string }>
      modifyLabels: (messageId: string, addLabels?: string[], removeLabels?: string[]) => Promise<{ success: boolean; error?: string }>
      trash: (messageId: string) => Promise<{ success: boolean; error?: string }>
      getLabels: () => Promise<{ success: boolean; labels?: GmailLabel[]; error?: string }>
      createLabel: (name: string) => Promise<{ success: boolean; label?: GmailLabel; error?: string }>
      deleteLabel: (labelId: string) => Promise<{ success: boolean; error?: string }>
      previewOrganization: (options?: { query?: string; maxMessages?: number; minGroupSize?: number; removeFromInbox?: boolean; pageLimit?: number }) => Promise<GmailOrganizationPreviewResult>
      applyOrganizationPlan: (planId: string, options?: { removeFromInbox?: boolean }) => Promise<GmailOrganizationApplyResult>
      undoOrganizationPlan: (planId?: string) => Promise<GmailOrganizationUndoResult>
      batchModifyByLabel: (labelId: string, options?: { addLabels?: string[]; removeLabels?: string[]; deleteLabel?: boolean }) => Promise<{ success: boolean; processed?: number; remaining?: number; labelDeleted?: boolean; error?: string }>
      emptyAndDeleteAllLabels: () => Promise<{ success: boolean; labelsProcessed?: number; labelsDeleted?: number; totalMessagesMovedToInbox?: number; remainingLabels?: string[]; errors?: string[] }>
    }
  }
}

// ─── Service functions ──────────────────────────────────────────────

export async function sendEmail(params: SendEmailParams) {
  return window.gmail.send(params)
}

export async function getEmails(options?: { maxResults?: number; query?: string; labelIds?: string[]; pageToken?: string }) {
  return window.gmail.getMessages(options)
}

export async function getEmail(messageId: string) {
  return window.gmail.getMessage(messageId)
}

export async function modifyEmailLabels(messageId: string, addLabels?: string[], removeLabels?: string[]) {
  return window.gmail.modifyLabels(messageId, addLabels, removeLabels)
}

export async function trashEmail(messageId: string) {
  return window.gmail.trash(messageId)
}

export async function getGmailLabels() {
  return window.gmail.getLabels()
}

export async function createGmailLabel(name: string) {
  return window.gmail.createLabel(name)
}

export async function deleteGmailLabel(labelId: string) {
  return window.gmail.deleteLabel(labelId)
}

export async function previewGmailOrganization(options?: { query?: string; maxMessages?: number; minGroupSize?: number; removeFromInbox?: boolean; pageLimit?: number }) {
  return window.gmail.previewOrganization(options)
}

export async function applyGmailOrganizationPlan(planId: string, options?: { removeFromInbox?: boolean }) {
  return window.gmail.applyOrganizationPlan(planId, options)
}

export async function undoGmailOrganizationPlan(planId?: string) {
  return window.gmail.undoOrganizationPlan(planId)
}

export async function batchModifyEmailsByLabel(
  labelId: string,
  options?: { addLabels?: string[]; removeLabels?: string[]; deleteLabel?: boolean },
) {
  return window.gmail.batchModifyByLabel(labelId, options)
}

export async function emptyAllGmailLabels() {
  return window.gmail.emptyAndDeleteAllLabels()
}

// ─── Convenience helpers ────────────────────────────────────────────

export async function markAsRead(messageId: string) {
  return window.gmail.modifyLabels(messageId, undefined, ['UNREAD'])
}

export async function archiveEmail(messageId: string) {
  return window.gmail.modifyLabels(messageId, undefined, ['INBOX'])
}
