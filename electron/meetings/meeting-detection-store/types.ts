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

export interface UpsertMeetingDetectionInput {
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
}
