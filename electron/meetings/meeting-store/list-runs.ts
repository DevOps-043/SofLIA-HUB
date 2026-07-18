import type { MeetingStore } from '../meeting-store.ts';
import { getMeetingHubClient } from '../meeting-hub-client';
import type { MeetingRunSummary, MeetingReviewFlag } from '../meeting-types';
import { parseJson, throwOnError } from './shared';

export async function listRuns(this: MeetingStore, filters?: { ownerUserId?: string; ownerUserIds?: string[]; organizationId?: string; limit?: number }): Promise<MeetingRunSummary[]> {
    const supabase = getMeetingHubClient();

    let query = supabase
      .from('meeting_runs')
      .select('*')
      .order('updated_at', { ascending: false });

    // Un mismo usuario puede tener runs bajo varias identidades (id de SOFIA
    // desde la orbe, uid de Lia desde la app): ownerUserIds las cubre todas.
    const ownerIds = (filters?.ownerUserIds || []).filter(Boolean);
    if (ownerIds.length > 0) {
      query = query.in('owner_user_id', ownerIds);
    } else if (filters?.ownerUserId) {
      query = query.eq('owner_user_id', filters.ownerUserId);
    }
    if (filters?.organizationId) {
      // Incluir runs personales (sin organizacion): la orbe y los runs
      // manuales no siempre conocen la organizacion activa.
      query = query.or(`organization_id.eq.${filters.organizationId},organization_id.is.null`);
    }
    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    const { data: runRows, error: runError } = await query;
    throwOnError(runError, 'listRuns.runs');

    const runs = (runRows || []).map((row) => this.mapRun(row));
    if (runs.length === 0) {
      return [];
    }

    const runIds = runs.map((run) => run.id);
    const [{ data: assetRows, error: assetError }, { data: actionRows, error: actionError }] = await Promise.all([
      supabase
        .from('meeting_assets')
        .select('*')
        .in('meeting_run_id', runIds)
        .order('asset_version', { ascending: false }),
      supabase
        .from('meeting_sync_actions')
        .select('meeting_run_id, approval_state, sync_state')
        .in('meeting_run_id', runIds),
    ]);

    throwOnError(assetError, 'listRuns.assets');
    throwOnError(actionError, 'listRuns.actions');

    const latestAssetByRun = new Map<string, MeetingRunSummary['latest_asset']>();
    for (const row of assetRows || []) {
      if (latestAssetByRun.has(row.meeting_run_id)) continue;
      latestAssetByRun.set(row.meeting_run_id, {
        id: row.id,
        executive_summary: row.executive_summary,
        operational_summary: row.operational_summary,
        review_flags: parseJson<MeetingReviewFlag[]>(row.review_flags_json, []),
        created_at: row.created_at,
      });
    }

    const actionsByRun = new Map<string, Array<{ approval_state: string; sync_state: string }>>();
    for (const row of actionRows || []) {
      const list = actionsByRun.get(row.meeting_run_id) || [];
      list.push({
        approval_state: row.approval_state,
        sync_state: row.sync_state,
      });
      actionsByRun.set(row.meeting_run_id, list);
    }

    return runs.map((run) => {
      const actions = actionsByRun.get(run.id) || [];
      return {
        run,
        latest_asset: latestAssetByRun.get(run.id) || null,
        counts: {
          draft_actions: this.countActions(actions, 'draft'),
          approved_actions: this.countActions(actions, 'approved'),
          synced_actions: this.countActions(actions, 'synced'),
          failed_actions: this.countActions(actions, 'failed'),
        },
      };
    });
  }
