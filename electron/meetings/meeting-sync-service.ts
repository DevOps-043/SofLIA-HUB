import type { MeetingStore } from './meeting-store';
import type { MeetingSyncExecutionResult } from './meeting-types';
import { syncMeetingAction } from './meeting-sync/sync-meeting-action';

export class MeetingSyncService {
  constructor(private readonly store: MeetingStore) {}

  async syncApprovedActions(runId: string, ownerUserId: string): Promise<MeetingSyncExecutionResult> {
    const actions = await this.store.getApprovedPendingActions(runId);
    const details: MeetingSyncExecutionResult['details'] = [];

    if (actions.length === 0) {
      return { synced: 0, failed: 0, skipped: 0, details: [] };
    }

    let synced = 0;
    let failed = 0;
    let skipped = 0;

    for (const action of actions) {
      const result = await syncMeetingAction(this.store, action, ownerUserId);
      details.push(result);
      if (result.status === 'synced') synced += 1;
      if (result.status === 'failed') failed += 1;
      if (result.status === 'skipped') skipped += 1;
    }

    return { synced, failed, skipped, details };
  }
}
