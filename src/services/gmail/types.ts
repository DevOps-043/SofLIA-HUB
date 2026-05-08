export interface EmailMessage {
  id: string;
  threadId: string;
  from: string;
  to: string[];
  subject: string;
  snippet: string;
  body?: string;
  date: Date;
  labelIds: string[];
  isUnread: boolean;
}

export interface SendEmailParams {
  to: string[];
  subject: string;
  body: string;
  cc?: string[];
  bcc?: string[];
  isHtml?: boolean;
  attachmentPaths?: string[];
}

export interface GmailLabel {
  id: string;
  name: string;
}

export interface GmailOrganizationPreviewGroup {
  groupKey: string;
  labelName: string;
  count: number;
  domains: string[];
  sampleSenders: string[];
  sampleSubjects: string[];
  existingLabelId?: string;
}

export interface GmailOrganizationPreviewResult {
  success: boolean;
  planId?: string;
  queryUsed?: string;
  scannedMessages?: number;
  groupedMessages?: number;
  uncategorizedMessages?: number;
  truncated?: boolean;
  removeFromInbox?: boolean;
  groups?: GmailOrganizationPreviewGroup[];
  error?: string;
}

export interface GmailOrganizationApplyResult {
  success: boolean;
  planId: string;
  groupsApplied: number;
  messagesLabeled: number;
  removeFromInbox: boolean;
  labelsCreated: GmailLabel[];
  labelsReused: GmailLabel[];
  error?: string;
}

export interface GmailOrganizationUndoResult {
  success: boolean;
  planId: string;
  messagesRestored: number;
  labelsDeleted: number;
  error?: string;
}
