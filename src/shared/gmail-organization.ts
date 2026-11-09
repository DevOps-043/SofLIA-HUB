import { z } from 'zod';

export const gmailPlanIdSchema = z.string().regex(/^gmail-plan-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
export const gmailPreviewOptionsSchema = z.object({
  query: z.string().max(4096).optional(), maxMessages: z.number().int().min(1).max(1000).optional(),
  minGroupSize: z.number().int().min(1).max(20).optional(), pageLimit: z.number().int().min(1).max(50).optional(),
  removeFromInbox: z.boolean().optional(),
}).strict();
export const gmailApplyOptionsSchema = z.object({ removeFromInbox: z.boolean().optional() }).strict();
export type GmailOrganizationPreviewOptions = z.infer<typeof gmailPreviewOptionsSchema>;
export interface GmailOrganizationOutcome {
  partial?: boolean; uncertain?: boolean; recoveryRequired?: boolean; cancelled?: boolean; conflict?: boolean;
}
export interface GmailOrganizationPreviewGroup {
  groupKey: string; labelName: string; count: number; domains: string[];
  sampleSenders: string[]; sampleSubjects: string[]; existingLabelId?: string;
}
export interface GmailOrganizationPreviewResult extends GmailOrganizationOutcome {
  success: boolean; planId?: string; queryUsed?: string; scannedMessages?: number; groupedMessages?: number;
  uncategorizedMessages?: number; truncated?: boolean; removeFromInbox?: boolean;
  groups?: GmailOrganizationPreviewGroup[]; error?: string;
}
export interface GmailOrganizationApplyResult extends GmailOrganizationOutcome {
  success: boolean; planId: string; groupsApplied: number; messagesLabeled: number; removeFromInbox: boolean;
  labelsCreated: Array<{ id: string; name: string }>; labelsReused: Array<{ id: string; name: string }>; error?: string;
}
export interface GmailOrganizationUndoResult extends GmailOrganizationOutcome {
  success: boolean; planId: string; messagesRestored: number; labelsDeleted: number; labelsRetained?: number; error?: string;
}
