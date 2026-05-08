import type { MeetingStore } from '../meeting-store';
import type { MeetingSyncService } from '../meeting-sync-service';
import type { MeetingRunDetail, MeetingSyncExecutionResult } from '../meeting-types';

export async function syncApprovedMeetingActions(
  store: MeetingStore,
  syncService: MeetingSyncService,
  getRunDetail: (runId: string) => Promise<MeetingRunDetail>,
  runId: string,
  decidedByUserId: string,
): Promise<{ detail: MeetingRunDetail; result: MeetingSyncExecutionResult }> {
  await store.updateRunStatus(runId, 'SYNCING', null);
  const result = await syncService.syncApprovedActions(runId, decidedByUserId);
  const nextStatus = result.failed > 0 && result.synced === 0 ? 'SYNC_FAILED' : result.synced > 0 ? 'SYNCED' : 'APPROVED';
  await store.updateRunStatus(runId, nextStatus, result.failed > 0 ? 'Algunas acciones no se pudieron sincronizar.' : null);
  return { detail: await getRunDetail(runId), result };
}
