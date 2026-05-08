import type { MeetingDetectionRecord } from './types';
import { parseJson } from './store-utils';

export function mapMeetingDetectionRecord(row: any): MeetingDetectionRecord {
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
