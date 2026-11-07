export type {
  GmailOrganizationPreviewOptions, GmailOrganizationPreviewGroup, GmailOrganizationPreviewResult,
  GmailOrganizationApplyResult, GmailOrganizationUndoResult,
} from '../../src/shared/gmail-organization';
import type { GmailOrganizationPreviewGroup } from '../../src/shared/gmail-organization';
export interface GmailOrganizationMessageSnapshot {
  id: string;
  from: string;
  subject: string;
  labelIds: string[];
}

export interface GmailOrganizationPlanGroup extends GmailOrganizationPreviewGroup {
  messageIds: string[];
}
