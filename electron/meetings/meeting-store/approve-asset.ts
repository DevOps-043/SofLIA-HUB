import type { MeetingStore } from '../meeting-store.ts';

export async function approveAsset(this: MeetingStore, runId: string, decidedByUserId: string, comment?: string): Promise<void> {
    await this.recordApproval({
      meeting_run_id: runId,
      scope: 'asset',
      scope_ref_id: null,
      requested_by_user_id: decidedByUserId,
      decided_by_user_id: decidedByUserId,
      decision: 'approved',
      comment: comment ?? null,
    });
    await this.updateRunStatus(runId, 'APPROVED', null);
  }
