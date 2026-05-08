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
