import { getMeetingHubClient } from './meeting-hub-client';
import { buildDetectionUpsertRecord } from './meeting-detection-store/record-builder';
import { mapMeetingDetectionRecord } from './meeting-detection-store/record-mapper';
import { nowIso, throwOnDetectionStoreError } from './meeting-detection-store/store-utils';
import type {
  MeetingDetectionRecord,
  MeetingDetectionStatus,
  UpsertMeetingDetectionInput,
} from './meeting-detection-store/types';

export type {
  MeetingDetectionRecord,
  MeetingDetectionSource,
  MeetingDetectionStatus,
  UpsertMeetingDetectionInput,
} from './meeting-detection-store/types';

export class MeetingDetectionStore {
  init(): void {
    getMeetingHubClient();
  }

  async getByDetectionKey(detectionKey: string): Promise<MeetingDetectionRecord | null> {
    const supabase = getMeetingHubClient();
    const { data, error } = await supabase
      .from('meeting_detection_candidates')
      .select('*')
      .eq('detection_key', detectionKey)
      .maybeSingle();

    throwOnDetectionStoreError(error, 'getByDetectionKey');
    return data ? mapMeetingDetectionRecord(data) : null;
  }

  async upsertCandidate(input: UpsertMeetingDetectionInput): Promise<MeetingDetectionRecord> {
    const supabase = getMeetingHubClient();
    const existing = await this.getByDetectionKey(input.detectionKey);
    const record = buildDetectionUpsertRecord(input, existing);
    const { error } = await supabase
      .from('meeting_detection_candidates')
      .upsert(record, { onConflict: 'detection_key' });

    throwOnDetectionStoreError(error, 'upsertCandidate');
    const stored = await this.getByDetectionKey(input.detectionKey);
    if (!stored) throw new Error('No pude recuperar el candidate de deteccion despues del upsert.');
    return stored;
  }

  async markRunCreated(detectionKey: string, runId: string): Promise<void> {
    const supabase = getMeetingHubClient();
    const { error } = await supabase
      .from('meeting_detection_candidates')
      .update({
        workflow_run_id: runId,
        status: 'run_created',
        error_message: null,
        last_checked_at: nowIso(),
        updated_at: nowIso(),
      })
      .eq('detection_key', detectionKey);

    throwOnDetectionStoreError(error, 'markRunCreated');
  }

  async markStatus(
    detectionKey: string,
    status: MeetingDetectionStatus,
    patch?: { errorMessage?: string | null; metadata?: Record<string, unknown> },
  ): Promise<void> {
    const existing = await this.getByDetectionKey(detectionKey);
    const supabase = getMeetingHubClient();
    const { error } = await supabase
      .from('meeting_detection_candidates')
      .update({
        status,
        error_message: patch?.errorMessage ?? null,
        metadata_json: { ...(existing?.metadata || {}), ...(patch?.metadata || {}) },
        last_checked_at: nowIso(),
        updated_at: nowIso(),
      })
      .eq('detection_key', detectionKey);

    throwOnDetectionStoreError(error, 'markStatus');
  }

  async hasNotifiedRun(runId: string): Promise<boolean> {
    const supabase = getMeetingHubClient();
    const { data, error } = await supabase
      .from('meeting_detection_candidates')
      .select('id')
      .eq('workflow_run_id', runId)
      .eq('status', 'notified')
      .limit(1);

    throwOnDetectionStoreError(error, 'hasNotifiedRun');
    return Array.isArray(data) && data.length > 0;
  }
}
