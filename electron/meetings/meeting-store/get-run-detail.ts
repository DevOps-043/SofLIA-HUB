import type { MeetingStore } from '../meeting-store.ts';
import { getMeetingIrisClient } from '../meeting-iris-client';
import type { MeetingRunDetail } from '../meeting-types';
import { throwOnError } from './shared';

export async function getRunDetail(this: MeetingStore, runId: string): Promise<MeetingRunDetail | null> {
    const supabase = getMeetingIrisClient();
    const [
      { data: runRow, error: runError },
      { data: sourceRows, error: sourceError },
      { data: assetRows, error: assetError },
      { data: actionRows, error: actionError },
      { data: approvalRows, error: approvalError },
    ] = await Promise.all([
      supabase
        .from('meeting_runs')
        .select('*')
        .eq('id', runId)
        .maybeSingle(),
      supabase
        .from('meeting_source_artifacts')
        .select('*')
        .eq('meeting_run_id', runId)
        .order('created_at', { ascending: true }),
      supabase
        .from('meeting_assets')
        .select('*')
        .eq('meeting_run_id', runId)
        .order('asset_version', { ascending: false })
        .limit(1),
      supabase
        .from('meeting_sync_actions')
        .select('*')
        .eq('meeting_run_id', runId)
        .order('created_at', { ascending: true }),
      supabase
        .from('meeting_approvals')
        .select('*')
        .eq('meeting_run_id', runId)
        .order('created_at', { ascending: true }),
    ]);

    throwOnError(runError, 'getRunDetail.run');
    throwOnError(sourceError, 'getRunDetail.sources');
    throwOnError(assetError, 'getRunDetail.assets');
    throwOnError(actionError, 'getRunDetail.actions');
    throwOnError(approvalError, 'getRunDetail.approvals');

    if (!runRow) {
      return null;
    }

    return {
      run: this.mapRun(runRow),
      source_artifacts: (sourceRows || []).map((row) => this.mapSourceArtifact(row)),
      latest_asset: assetRows?.[0] ? this.mapAsset(assetRows[0]) : null,
      sync_actions: (actionRows || []).map((row) => this.mapSyncAction(row)),
      approvals: (approvalRows || []).map((row) => this.mapApproval(row)),
    };
  }
