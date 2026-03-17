import crypto from 'node:crypto';
import type { PostgrestError } from '@supabase/supabase-js';
import { getMeetingIrisClient } from './meeting-iris-client';

export type MeetingDetectionSource = 'calendar' | 'gmail' | 'drive';
export type MeetingDetectionStatus = 'detected' | 'transcript_pending' | 'processing' | 'run_created' | 'notified' | 'error';

export interface MeetingDetectionRecord {
  id: string;
  owner_user_id: string;
  detection_key: string;
  source_type: MeetingDetectionSource;
  meeting_title: string | null;
  meeting_code: string | null;
  calendar_event_id: string | null;
  gmail_message_id: string | null;
  drive_file_id: string | null;
  workflow_run_id: string | null;
  status: MeetingDetectionStatus;
  error_message: string | null;
  metadata: Record<string, unknown>;
  detected_at: string;
  last_checked_at: string;
  created_at: string;
  updated_at: string;
}

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
      `Faltan las tablas actualizadas de Meeting Ops en IRIS Supabase. Vuelve a ejecutar sql/meeting-ops-tables.sql. Detalle: ${error.message}`,
    );
  }

  throw new Error(`[MeetingDetectionStore] ${operation}: ${error.message}`);
}

export class MeetingDetectionStore {
  init(): void {
    getMeetingIrisClient();
  }

  async getByDetectionKey(detectionKey: string): Promise<MeetingDetectionRecord | null> {
    const supabase = getMeetingIrisClient();
    const { data, error } = await supabase
      .from('meeting_detection_candidates')
      .select('*')
      .eq('detection_key', detectionKey)
      .maybeSingle();

    throwOnError(error, 'getByDetectionKey');
    return data ? this.mapRecord(data) : null;
  }

  async upsertCandidate(input: {
    ownerUserId: string;
    detectionKey: string;
    sourceType: MeetingDetectionSource;
    meetingTitle?: string | null;
    meetingCode?: string | null;
    calendarEventId?: string | null;
    gmailMessageId?: string | null;
    driveFileId?: string | null;
    status: MeetingDetectionStatus;
    errorMessage?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<MeetingDetectionRecord> {
    const supabase = getMeetingIrisClient();
    const existing = await this.getByDetectionKey(input.detectionKey);
    const timestamp = nowIso();

    const record = {
      id: existing?.id || makeId('mdetect'),
      owner_user_id: existing?.owner_user_id || input.ownerUserId,
      detection_key: input.detectionKey,
      source_type: input.sourceType,
      meeting_title: input.meetingTitle ?? existing?.meeting_title ?? null,
      meeting_code: input.meetingCode ?? existing?.meeting_code ?? null,
      calendar_event_id: input.calendarEventId ?? existing?.calendar_event_id ?? null,
      gmail_message_id: input.gmailMessageId ?? existing?.gmail_message_id ?? null,
      drive_file_id: input.driveFileId ?? existing?.drive_file_id ?? null,
      workflow_run_id: existing?.workflow_run_id ?? null,
      status: input.status,
      error_message: input.errorMessage ?? null,
      metadata_json: {
        ...(existing?.metadata || {}),
        ...(input.metadata || {}),
      },
      detected_at: existing?.detected_at || timestamp,
      last_checked_at: timestamp,
      created_at: existing?.created_at || timestamp,
      updated_at: timestamp,
    };

    const { error } = await supabase
      .from('meeting_detection_candidates')
      .upsert(record, { onConflict: 'detection_key' });

    throwOnError(error, 'upsertCandidate');

    const stored = await this.getByDetectionKey(input.detectionKey);
    if (!stored) {
      throw new Error('No pude recuperar el candidate de deteccion despues del upsert.');
    }
    return stored;
  }

  async markRunCreated(detectionKey: string, runId: string): Promise<void> {
    const supabase = getMeetingIrisClient();
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

    throwOnError(error, 'markRunCreated');
  }

  async markStatus(detectionKey: string, status: MeetingDetectionStatus, patch?: {
    errorMessage?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    const existing = await this.getByDetectionKey(detectionKey);
    const supabase = getMeetingIrisClient();
    const { error } = await supabase
      .from('meeting_detection_candidates')
      .update({
        status,
        error_message: patch?.errorMessage ?? null,
        metadata_json: {
          ...(existing?.metadata || {}),
          ...(patch?.metadata || {}),
        },
        last_checked_at: nowIso(),
        updated_at: nowIso(),
      })
      .eq('detection_key', detectionKey);

    throwOnError(error, 'markStatus');
  }

  async hasNotifiedRun(runId: string): Promise<boolean> {
    const supabase = getMeetingIrisClient();
    const { data, error } = await supabase
      .from('meeting_detection_candidates')
      .select('id')
      .eq('workflow_run_id', runId)
      .eq('status', 'notified')
      .limit(1);

    throwOnError(error, 'hasNotifiedRun');
    return Array.isArray(data) && data.length > 0;
  }

  private mapRecord(row: any): MeetingDetectionRecord {
    return {
      id: row.id,
      owner_user_id: row.owner_user_id,
      detection_key: row.detection_key,
      source_type: row.source_type,
      meeting_title: row.meeting_title ?? null,
      meeting_code: row.meeting_code ?? null,
      calendar_event_id: row.calendar_event_id ?? null,
      gmail_message_id: row.gmail_message_id ?? null,
      drive_file_id: row.drive_file_id ?? null,
      workflow_run_id: row.workflow_run_id ?? null,
      status: row.status,
      error_message: row.error_message ?? null,
      metadata: parseJson(row.metadata_json, {}),
      detected_at: row.detected_at,
      last_checked_at: row.last_checked_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}
