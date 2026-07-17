import type { MeetingStore } from '../meeting-store.ts';
import crypto from 'node:crypto';
import { getMeetingHubClient } from '../meeting-hub-client';
import type { MeetingReviewFlagCode, MeetingSyncActionRecord, UpdateMeetingActionInput } from '../meeting-types';
import { nowIso, throwOnError } from './shared';

export async function updateActionDraft(this: MeetingStore, actionId: string, updates: UpdateMeetingActionInput & { blockingFlags: MeetingReviewFlagCode[] }): Promise<MeetingSyncActionRecord | null> {
    const supabase = getMeetingHubClient();
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
