export interface MeetingDetectedEvent {
  runId: string;
  ownerUserId: string;
  meetingTitle: string | null;
  sourceFileName: string | null;
}
