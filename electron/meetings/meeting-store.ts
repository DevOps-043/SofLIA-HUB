import crypto from 'node:crypto';
import type { PostgrestError } from '@supabase/supabase-js';
import { getMeetingIrisClient } from './meeting-iris-client';
import type {
  CreateMeetingRunInput,
  MeetingApprovalRecord,
  MeetingAssetPayload,
  MeetingAssetRecord,
  MeetingFollowupItem,
  MeetingRunDetail,
  MeetingRunRecord,
  MeetingRunStatus,
  MeetingRunSummary,
  MeetingReviewFlag,
  MeetingReviewFlagCode,
  MeetingSourceArtifactRecord,
  MeetingSyncActionRecord,
  MeetingSyncActionState,
  ProposedMeetingAction,
  UpdateMeetingActionInput,
} from './meeting-types';

function nowIso(): string {
  return new Date().toISOString();
}

function makeId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  if (typeof value === 'object') {
    return value as T;
  }
  return fallback;
}

function throwOnError(error: PostgrestError | null, operation: string): void {
  if (!error) return;

  if (/relation .* does not exist/i.test(error.message)) {
    throw new Error(
      `Faltan las tablas de Meeting Ops en IRIS Supabase. Aplica el archivo sql/meeting-ops-tables.sql antes de usar este workflow. Detalle: ${error.message}`,
    );
  }

  throw new Error(`[MeetingStore] ${operation}: ${error.message}`);
}

export class MeetingStore {
  init(): void {
    getMeetingIrisClient();
    console.log('[MeetingStore] Using IRIS Supabase persistence');
  }

  async findRunByOwnerAndSourceHash(ownerUserId: string, sourceHash: string): Promise<MeetingRunRecord | null> {
    const supabase = getMeetingIrisClient();
    const { data, error } = await supabase
      .from('meeting_runs')
      .select('*')
      .eq('owner_user_id', ownerUserId)
      .eq('source_hash', sourceHash)
      .order('created_at', { ascending: false })
      .limit(1);

    throwOnError(error, 'findRunByOwnerAndSourceHash');
    return data?.[0] ? this.mapRun(data[0]) : null;
  }

  async createRun(input: CreateMeetingRunInput & { traceId: string; sourceVersion: number }): Promise<MeetingRunRecord> {
    const supabase = getMeetingIrisClient();
    const timestamp = nowIso();
    const record: MeetingRunRecord = {
      id: makeId('mrun'),
      organization_id: input.organizationId ?? null,
      workspace_id: input.workspaceId ?? null,
      owner_user_id: input.ownerUserId,
      origin_channel: input.originChannel,
      origin_ref: input.originRef ?? null,
      meeting_title: input.meetingTitle ?? null,
      meeting_type: input.meetingType || 'general',
      meeting_series_key: input.meetingSeriesKey ?? null,
      primary_source_uri: input.source.source_uri ?? null,
      status: 'EXTRACTING',
      source_hash: input.source.content_hash,
      source_version: input.sourceVersion,
      trace_id: input.traceId,
      last_error: null,
      created_at: timestamp,
      updated_at: timestamp,
    };

    const { error } = await supabase
      .from('meeting_runs')
      .insert(record);

    throwOnError(error, 'createRun');
    return record;
  }

  async getNextSourceVersion(ownerUserId: string, sourceUri?: string | null): Promise<number> {
    if (!sourceUri) return 1;

    const supabase = getMeetingIrisClient();
    const { data, error } = await supabase
      .from('meeting_runs')
      .select('source_version')
      .eq('owner_user_id', ownerUserId)
      .eq('primary_source_uri', sourceUri)
      .order('source_version', { ascending: false })
      .limit(1);

    throwOnError(error, 'getNextSourceVersion');
    return data?.[0]?.source_version ? Number(data[0].source_version) + 1 : 1;
  }

  async addSourceArtifact(runId: string, input: CreateMeetingRunInput['source']): Promise<MeetingSourceArtifactRecord> {
    const supabase = getMeetingIrisClient();
    const record: MeetingSourceArtifactRecord = {
      id: makeId('msrc'),
      meeting_run_id: runId,
      source_system: input.source_system,
      source_type: input.source_type,
      source_uri: input.source_uri ?? null,
      external_file_id: input.external_file_id ?? null,
      mime_type: input.mime_type ?? null,
      authority_level: input.authority_level,
      sha256: input.content_hash,
      normalized_text: input.normalized_text,
      metadata: input.metadata,
      created_at: nowIso(),
    };

    const { error } = await supabase
      .from('meeting_source_artifacts')
      .insert({
        ...record,
        metadata_json: record.metadata,
      });

    throwOnError(error, 'addSourceArtifact');
    return record;
  }

  async addAsset(runId: string, payload: MeetingAssetPayload, confidence: number | null): Promise<MeetingAssetRecord> {
    const supabase = getMeetingIrisClient();
    const { data: versions, error: versionError } = await supabase
      .from('meeting_assets')
      .select('asset_version')
      .eq('meeting_run_id', runId)
      .order('asset_version', { ascending: false })
      .limit(1);

    throwOnError(versionError, 'addAsset.selectVersion');
    const assetVersion = versions?.[0]?.asset_version ? Number(versions[0].asset_version) + 1 : 1;

    const record: MeetingAssetRecord = {
      id: makeId('masset'),
      meeting_run_id: runId,
      schema_version: payload.schema_version,
      asset_version: assetVersion,
      payload,
      executive_summary: payload.executive_summary,
      operational_summary: payload.operational_summary,
      review_flags: payload.review_flags,
      confidence,
      created_at: nowIso(),
    };

    const { error } = await supabase
      .from('meeting_assets')
      .insert({
        ...record,
        payload_json: record.payload,
        review_flags_json: record.review_flags,
      });

    throwOnError(error, 'addAsset.insert');
    return record;
  }

  async replaceSyncActions(runId: string, assetId: string, actions: ProposedMeetingAction[]): Promise<MeetingSyncActionRecord[]> {
    const supabase = getMeetingIrisClient();

    const { error: deleteError } = await supabase
      .from('meeting_sync_actions')
      .delete()
      .eq('meeting_run_id', runId)
      .eq('approval_state', 'draft');

    throwOnError(deleteError, 'replaceSyncActions.deleteDrafts');

    const records = actions.map((action) => {
      const createdAt = nowIso();
      const record: MeetingSyncActionRecord = {
        id: makeId('mact'),
        meeting_run_id: runId,
        meeting_asset_id: assetId,
        action_type: action.action_type,
        target_type: action.target_type,
        payload: action.payload,
        approval_state: 'draft',
        sync_state: 'draft',
        sync_target: 'iris_direct',
        idempotency_key: crypto.createHash('sha256')
          .update(`${runId}:${assetId}:${action.action_type}:${JSON.stringify(action.payload)}`)
          .digest('hex'),
        external_ref: null,
        error_message: null,
        summary: action.summary,
        blocking_flags: action.blocking_flags,
        created_at: createdAt,
        updated_at: createdAt,
      };

      return record;
    });

    if (records.length === 0) {
      return [];
    }

    const { error } = await supabase
      .from('meeting_sync_actions')
      .insert(
        records.map((record) => ({
          ...record,
          payload_json: record.payload,
          blocking_flags_json: record.blocking_flags,
        })),
      );

    throwOnError(error, 'replaceSyncActions.insert');
    return records;
  }

  async listRuns(filters?: { ownerUserId?: string; limit?: number }): Promise<MeetingRunSummary[]> {
    const supabase = getMeetingIrisClient();

    let query = supabase
      .from('meeting_runs')
      .select('*')
      .order('updated_at', { ascending: false });

    if (filters?.ownerUserId) {
      query = query.eq('owner_user_id', filters.ownerUserId);
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

  async getRunDetail(runId: string): Promise<MeetingRunDetail | null> {
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

  async updateRunStatus(runId: string, status: MeetingRunStatus, lastError?: string | null): Promise<void> {
    const supabase = getMeetingIrisClient();
    const { error } = await supabase
      .from('meeting_runs')
      .update({
        status,
        last_error: lastError ?? null,
        updated_at: nowIso(),
      })
      .eq('id', runId);

    throwOnError(error, 'updateRunStatus');
  }

  async updateRunClassification(runId: string, updates: { meetingTitle?: string | null; meetingType?: string }): Promise<void> {
    const nextPayload: Record<string, unknown> = {
      updated_at: nowIso(),
    };

    if (updates.meetingTitle !== undefined) {
      nextPayload.meeting_title = updates.meetingTitle;
    }
    if (updates.meetingType) {
      nextPayload.meeting_type = updates.meetingType;
    }

    const supabase = getMeetingIrisClient();
    const { error } = await supabase
      .from('meeting_runs')
      .update(nextPayload)
      .eq('id', runId);

    throwOnError(error, 'updateRunClassification');
  }

  async approveAsset(runId: string, decidedByUserId: string, comment?: string): Promise<void> {
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

  async approveActions(runId: string, decidedByUserId: string, actionIds?: string[], comment?: string): Promise<MeetingSyncActionRecord[]> {
    const supabase = getMeetingIrisClient();
    let targetIds = actionIds?.filter(Boolean) || [];

    if (targetIds.length === 0) {
      const { data, error } = await supabase
        .from('meeting_sync_actions')
        .select('id')
        .eq('meeting_run_id', runId)
        .eq('approval_state', 'draft');

      throwOnError(error, 'approveActions.selectDrafts');
      targetIds = (data || []).map((row) => row.id as string);
    }

    if (targetIds.length > 0) {
      const { error: updateError } = await supabase
        .from('meeting_sync_actions')
        .update({
          approval_state: 'approved',
          updated_at: nowIso(),
        })
        .in('id', targetIds);

      throwOnError(updateError, 'approveActions.update');

      await Promise.all(
        targetIds.map((actionId) =>
          this.recordApproval({
            meeting_run_id: runId,
            scope: 'action',
            scope_ref_id: actionId,
            requested_by_user_id: decidedByUserId,
            decided_by_user_id: decidedByUserId,
            decision: 'approved',
            comment: comment ?? null,
          })),
      );
    }

    if (!actionIds || actionIds.length === 0) {
      await this.recordApproval({
        meeting_run_id: runId,
        scope: 'actions',
        scope_ref_id: null,
        requested_by_user_id: decidedByUserId,
        decided_by_user_id: decidedByUserId,
        decision: 'approved',
        comment: comment ?? null,
      });
    }

    return (await this.getRunDetail(runId))?.sync_actions ?? [];
  }

  async rejectAction(actionId: string, decidedByUserId: string, comment?: string): Promise<MeetingSyncActionRecord | null> {
    const supabase = getMeetingIrisClient();
    const row = await this.getAction(actionId);
    if (!row) return null;

    const { error } = await supabase
      .from('meeting_sync_actions')
      .update({
        approval_state: 'rejected',
        sync_state: 'rejected',
        updated_at: nowIso(),
      })
      .eq('id', actionId);

    throwOnError(error, 'rejectAction.update');

    await this.recordApproval({
      meeting_run_id: row.meeting_run_id,
      scope: 'action',
      scope_ref_id: actionId,
      requested_by_user_id: decidedByUserId,
      decided_by_user_id: decidedByUserId,
      decision: 'rejected',
      comment: comment ?? null,
    });

    return this.getAction(actionId);
  }

  async updateActionDraft(
    actionId: string,
    updates: UpdateMeetingActionInput & { blockingFlags: MeetingReviewFlagCode[] },
  ): Promise<MeetingSyncActionRecord | null> {
    const supabase = getMeetingIrisClient();
    const current = await this.getAction(actionId);
    if (!current) return null;
    if (current.sync_state === 'synced') {
      throw new Error('No se puede editar una accion ya sincronizada.');
    }

    const nextPayload = {
      ...current.payload,
      ...(updates.title !== undefined ? { title: updates.title || undefined } : {}),
      ...(updates.description !== undefined ? { description: updates.description || undefined } : {}),
      ...(updates.team_id !== undefined ? { team_id: updates.team_id || undefined } : {}),
      ...(updates.project_id !== undefined ? { project_id: updates.project_id || undefined } : {}),
      ...(updates.due_date !== undefined ? { due_date: updates.due_date || null } : {}),
      ...(updates.owner_candidate !== undefined ? { owner_candidate: updates.owner_candidate || null } : {}),
      ...(updates.assignee_id !== undefined ? { assignee_id: updates.assignee_id || null } : {}),
    };

    const summary = updates.summary?.trim() || updates.title?.trim() || current.summary;
    const idempotencyKey = crypto.createHash('sha256')
      .update(`${current.meeting_run_id}:${current.meeting_asset_id}:${current.action_type}:${JSON.stringify(nextPayload)}`)
      .digest('hex');

    const { error } = await supabase
      .from('meeting_sync_actions')
      .update({
        summary,
        payload_json: nextPayload,
        blocking_flags_json: updates.blockingFlags,
        idempotency_key: idempotencyKey,
        approval_state: 'draft',
        sync_state: 'draft',
        external_ref: null,
        error_message: null,
        updated_at: nowIso(),
      })
      .eq('id', actionId);

    throwOnError(error, 'updateActionDraft');
    return this.getAction(actionId);
  }

  async getAction(actionId: string): Promise<MeetingSyncActionRecord | null> {
    const supabase = getMeetingIrisClient();
    const { data, error } = await supabase
      .from('meeting_sync_actions')
      .select('*')
      .eq('id', actionId)
      .maybeSingle();

    throwOnError(error, 'getAction');
    return data ? this.mapSyncAction(data) : null;
  }

  async getApprovedPendingActions(runId: string): Promise<MeetingSyncActionRecord[]> {
    const supabase = getMeetingIrisClient();
    const { data, error } = await supabase
      .from('meeting_sync_actions')
      .select('*')
      .eq('meeting_run_id', runId)
      .eq('approval_state', 'approved')
      .in('sync_state', ['draft', 'failed'])
      .order('created_at', { ascending: true });

    throwOnError(error, 'getApprovedPendingActions');
    return (data || []).map((row) => this.mapSyncAction(row));
  }

  async updateActionSyncState(
    actionId: string,
    syncState: MeetingSyncActionState,
    externalRef?: string | null,
    errorMessage?: string | null,
  ): Promise<void> {
    const supabase = getMeetingIrisClient();
    const { error } = await supabase
      .from('meeting_sync_actions')
      .update({
        sync_state: syncState,
        external_ref: externalRef ?? null,
        error_message: errorMessage ?? null,
        updated_at: nowIso(),
      })
      .eq('id', actionId);

    throwOnError(error, 'updateActionSyncState');
  }

  async getFollowups(ownerUserId?: string): Promise<MeetingFollowupItem[]> {
    const summaries = await this.listRuns(ownerUserId ? { ownerUserId } : undefined);
    const followups: MeetingFollowupItem[] = [];
    const now = Date.now();

    for (const summary of summaries) {
      const detail = await this.getRunDetail(summary.run.id);
      if (!detail?.latest_asset) continue;

      const actionByCommitmentIndex = new Map<number, MeetingSyncActionRecord>();
      for (const action of detail.sync_actions) {
        const index = action.payload.source_commitment_index;
        if (typeof index === 'number') {
          actionByCommitmentIndex.set(index, action);
        }
      }

      detail.latest_asset.payload.commitments.forEach((commitment, index) => {
        if (commitment.status === 'resolved') return;
        const due = commitment.due_date_candidate ? new Date(commitment.due_date_candidate).getTime() : null;
        const dueInHours = due ? Math.round((due - now) / (1000 * 60 * 60)) : null;
        let status: MeetingFollowupItem['status'] = 'open';
        if (typeof dueInHours === 'number' && dueInHours < 0) status = 'overdue';
        if (typeof dueInHours === 'number' && dueInHours >= 0 && dueInHours <= 48) status = 'upcoming';

        const relatedAction = actionByCommitmentIndex.get(index);
        followups.push({
          run_id: summary.run.id,
          meeting_title: summary.run.meeting_title,
          owner_user_id: summary.run.owner_user_id,
          commitment,
          assignee_id: relatedAction?.payload.assignee_id || null,
          due_in_hours: dueInHours,
          status,
        });
      });
    }

    return followups;
  }

  private async recordApproval(input: Omit<MeetingApprovalRecord, 'id' | 'created_at' | 'decided_at'>): Promise<void> {
    const supabase = getMeetingIrisClient();
    const createdAt = nowIso();
    const { error } = await supabase
      .from('meeting_approvals')
      .insert({
        ...input,
        id: makeId('mapproval'),
        created_at: createdAt,
        decided_at: input.decided_by_user_id ? createdAt : null,
      });

    throwOnError(error, 'recordApproval');
  }

  private countActions(rows: Array<{ approval_state: string; sync_state: string }>, state: MeetingSyncActionState): number {
    return rows.filter((row) => row.approval_state === state || row.sync_state === state).length;
  }

  private mapRun(row: any): MeetingRunRecord {
    return {
      id: row.id,
      organization_id: row.organization_id ?? null,
      workspace_id: row.workspace_id ?? null,
      owner_user_id: row.owner_user_id,
      origin_channel: row.origin_channel,
      origin_ref: row.origin_ref ?? null,
      meeting_title: row.meeting_title ?? null,
      meeting_type: row.meeting_type,
      meeting_series_key: row.meeting_series_key ?? null,
      primary_source_uri: row.primary_source_uri ?? null,
      status: row.status,
      source_hash: row.source_hash,
      source_version: Number(row.source_version),
      trace_id: row.trace_id,
      last_error: row.last_error ?? null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  private mapSourceArtifact(row: any): MeetingSourceArtifactRecord {
    return {
      id: row.id,
      meeting_run_id: row.meeting_run_id,
      source_system: row.source_system,
      source_type: row.source_type,
      source_uri: row.source_uri ?? null,
      external_file_id: row.external_file_id ?? null,
      mime_type: row.mime_type ?? null,
      authority_level: row.authority_level,
      sha256: row.sha256,
      normalized_text: row.normalized_text,
      metadata: parseJson(row.metadata_json, {}),
      created_at: row.created_at,
    };
  }

  private mapAsset(row: any): MeetingAssetRecord {
    const payload = parseJson<MeetingAssetPayload>(row.payload_json, {
      schema_version: 'meeting_asset.v1',
      trace_id: '',
      meeting_title: '',
      meeting_type: 'general',
      source_refs: [],
      participants: [],
      decisions: [],
      commitments: [],
      issues: [],
      open_questions: [],
      parking_lot: [],
      executive_summary: '',
      operational_summary: '',
      review_flags: [],
      proposed_actions: [],
      continuity_context: [],
    });

    return {
      id: row.id,
      meeting_run_id: row.meeting_run_id,
      schema_version: row.schema_version,
      asset_version: Number(row.asset_version),
      payload,
      executive_summary: row.executive_summary || payload.executive_summary || '',
      operational_summary: row.operational_summary || payload.operational_summary || '',
      review_flags: parseJson<MeetingReviewFlag[]>(row.review_flags_json, []),
      confidence: row.confidence === null || row.confidence === undefined ? null : Number(row.confidence),
      created_at: row.created_at,
    };
  }

  private mapSyncAction(row: any): MeetingSyncActionRecord {
    return {
      id: row.id,
      meeting_run_id: row.meeting_run_id,
      meeting_asset_id: row.meeting_asset_id,
      action_type: row.action_type,
      target_type: row.target_type,
      payload: parseJson(row.payload_json, {}),
      approval_state: row.approval_state,
      sync_state: row.sync_state,
      sync_target: row.sync_target,
      idempotency_key: row.idempotency_key,
      external_ref: row.external_ref ?? null,
      error_message: row.error_message ?? null,
      summary: row.summary,
      blocking_flags: parseJson(row.blocking_flags_json, []),
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  private mapApproval(row: any): MeetingApprovalRecord {
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
}
