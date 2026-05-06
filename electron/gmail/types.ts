/**
 * Tipos del paquete Gmail. Sin lógica.
 */

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

export interface GetMessagesOptions {
  maxResults?: number;
  query?: string;
  labelIds?: string[];
  pageToken?: string;
}

export interface GetMessagesResult {
  [key: string]: unknown;
  success: boolean;
  messages?: EmailMessage[];
  nextPageToken?: string;
  resultSizeEstimate?: number;
  error?: string;
}

export interface GmailOrganizationPreviewOptions {
  query?: string;
  maxMessages?: number;
  minGroupSize?: number;
  removeFromInbox?: boolean;
  pageLimit?: number;
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
  [key: string]: unknown;
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
  [key: string]: unknown;
  success: boolean;
  planId: string;
  groupsApplied: number;
  messagesLabeled: number;
  removeFromInbox: boolean;
  labelsCreated: Array<{ id: string; name: string }>;
  labelsReused: Array<{ id: string; name: string }>;
  error?: string;
}

export interface GmailOrganizationUndoResult {
  [key: string]: unknown;
  success: boolean;
  planId: string;
  messagesRestored: number;
  labelsDeleted: number;
  error?: string;
}

/** Internal — used by organization plan storage and apply/undo flows. */
export interface GmailOrganizationMessageSnapshot {
  id: string;
  from: string;
  subject: string;
  labelIds: string[];
}

export interface GmailOrganizationPlanGroup extends GmailOrganizationPreviewGroup {
  messageIds: string[];
}

export interface GmailOrganizationMessageChange {
  addedLabelIds: string[];
  removedLabelIds: string[];
}

export interface GmailOrganizationPlanRecord {
  id: string;
  createdAt: string;
  queryUsed: string;
  removeFromInbox: boolean;
  minGroupSize: number;
  scannedMessages: number;
  truncated: boolean;
  status: 'preview' | 'applied' | 'undone';
  groups: GmailOrganizationPlanGroup[];
  messages: GmailOrganizationMessageSnapshot[];
  applyResult?: {
    appliedAt: string;
    labelsCreated: Array<{ id: string; name: string }>;
    labelsReused: Array<{ id: string; name: string }>;
    groupLabelIds: Record<string, string>;
    messageChanges: Record<string, GmailOrganizationMessageChange>;
    removeFromInbox: boolean;
  };
  undoneAt?: string;
}

/** Cliente Gmail tipado mínimamente. La librería oficial usa `any`; este tipo
 *  acota la superficie real que usamos. */
export type GmailClient = {
  users: {
    messages: {
      send: (args: any) => Promise<any>;
      list: (args: any) => Promise<any>;
      get: (args: any) => Promise<any>;
      modify: (args: any) => Promise<any>;
      batchModify: (args: any) => Promise<any>;
      trash: (args: any) => Promise<any>;
    };
    labels: {
      list: (args: any) => Promise<any>;
      create: (args: any) => Promise<any>;
      delete: (args: any) => Promise<any>;
    };
  };
};

export interface GmailLabelRecord {
  id: string;
  name: string;
}
