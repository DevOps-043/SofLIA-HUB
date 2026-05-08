import type { MeetingStore } from '../meeting-store.ts';
import type { MeetingApprovalRecord } from '../meeting-types';

export function mapApproval(this: MeetingStore, row: any): MeetingApprovalRecord {
    return {
      id: row.id,
      meeting_run_id: row.meeting_run_id,
      scope: row.scope,
      scope_ref_id: row.scope_ref_id ?? null,
      requested_by_user_id: row.requested_by_user_id,
      decided_by_user_id: row.decided_by_user_id ?? null,
      decision: row.decision,
      comment: row.comment ?? null,
      created_at: row.created_at,
      decided_at: row.decided_at ?? null,
    };
  }
