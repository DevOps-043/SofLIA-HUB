import crypto from 'node:crypto';
import { makeDetectionId, nowIso } from './store-utils';
import type { MeetingDetectionRecord, UpsertMeetingDetectionInput } from './types';

export function buildDetectionUpsertRecord(
  input: UpsertMeetingDetectionInput,
  existing: MeetingDetectionRecord | null,
): Record<string, unknown> {
  const timestamp = nowIso();
  return {
    id: existing?.id || makeDetectionId('mdetect', () => crypto.randomUUID()),
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
}
