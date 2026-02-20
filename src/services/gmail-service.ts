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
}

export interface GmailLabel {
  id: string
  name: string
}

// ─── Window type augmentation ───────────────────────────────────────

declare global {
  interface Window {
    gmail: {
      send: (params: SendEmailParams) => Promise<{ success: boolean; messageId?: string; error?: string }>
      getMessages: (options?: { maxResults?: number; query?: string; labelIds?: string[] }) => Promise<{ success: boolean; messages?: EmailMessage[]; error?: string }>
      getMessage: (messageId: string) => Promise<{ success: boolean; message?: EmailMessage; error?: string }>
      modifyLabels: (messageId: string, addLabels?: string[], removeLabels?: string[]) => Promise<{ success: boolean; error?: string }>
      trash: (messageId: string) => Promise<{ success: boolean; error?: string }>
      getLabels: () => Promise<{ success: boolean; labels?: GmailLabel[]; error?: string }>
    }
  }
}

// ─── Service functions ──────────────────────────────────────────────

export async function sendEmail(params: SendEmailParams) {
  return window.gmail.send(params)
}

export async function getEmails(options?: { maxResults?: number; query?: string; labelIds?: string[] }) {
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

// ─── Convenience helpers ────────────────────────────────────────────

export async function markAsRead(messageId: string) {
  return window.gmail.modifyLabels(messageId, undefined, ['UNREAD'])
}

export async function archiveEmail(messageId: string) {
  return window.gmail.modifyLabels(messageId, undefined, ['INBOX'])
}
