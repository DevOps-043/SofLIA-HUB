import { z } from 'zod';
import { hasUnsafeGmailHeader } from './gmail-delivery';

export const gmailObjectIdSchema = z.string().min(1).max(256).regex(/^[A-Za-z0-9_-]+$/)
  .refine(id => !['__proto__', 'prototype', 'constructor'].includes(id));
export const gmailLabelNameSchema = z.string().trim().min(1).max(225)
  .refine(value => !hasUnsafeGmailHeader(value) && !/[\u200e\u200f]/u.test(value));
const references = z.array(gmailLabelNameSchema).max(100);
export const gmailListOptionsSchema = z.object({ maxResults: z.number().int().min(1).max(100).optional(),
  query: z.string().max(4096).optional(), labelIds: z.array(gmailObjectIdSchema).max(100).optional(),
  pageToken: z.string().min(1).max(4096).optional(),
}).strict();
export const gmailModifyLabelsSchema = z.object({ messageId: gmailObjectIdSchema,
  addLabels: references.optional(), removeLabels: references.optional(),
}).strict().refine(value => (value.addLabels?.length ?? 0) + (value.removeLabels?.length ?? 0) > 0);
export const gmailBatchOptionsSchema = z.object({ addLabels: references.optional(), removeLabels: references.optional(),
  deleteLabel: z.boolean().optional(),
}).strict();
export type GmailListOptions = z.infer<typeof gmailListOptionsSchema>;
export type GmailBatchOptions = z.infer<typeof gmailBatchOptionsSchema>;
export interface GmailEmailMessage {
  id: string; threadId: string; from: string; to: string[]; subject: string;
  snippet: string; body?: string; date: Date; labelIds: string[]; isUnread: boolean;
}
export interface GmailOperationResult {
  success: boolean; error?: string; partial?: boolean; uncertain?: boolean; recoveryRequired?: boolean;
  cancelled?: boolean; conflict?: boolean; effectsConfirmed?: number; operationId?: string;
  labelsCreated?: Array<{ id: string; name: string }>;
}
export interface GmailCreateLabelResult extends GmailOperationResult { label?: { id: string; name: string } }
export interface GmailLabelsResult extends GmailOperationResult { labels?: Array<{ id: string; name: string }> }
export interface GmailMessagesResult extends GmailOperationResult {
  messages?: GmailEmailMessage[]; nextPageToken?: string; resultSizeEstimate?: number;
}
export interface GmailMessageResult extends GmailOperationResult { message?: GmailEmailMessage }
export interface GmailBatchResult extends GmailOperationResult {
  processed: number; remaining?: number; sourceEmpty?: boolean; labelDeleted: boolean;
}
export interface GmailEmptyLabelsResult extends GmailOperationResult {
  labelsProcessed: number; labelsDeleted: number;
  /** Membresías confirmadas por etiqueta; un mensaje puede pertenecer a varias. */
  totalMessagesMovedToInbox: number;
  remainingLabels: string[]; remainingLabelsVerified?: boolean; errors: string[];
}
