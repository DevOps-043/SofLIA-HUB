import type { CalendarService } from '../calendar-service';
import type { DriveFile } from '../drive-service';
import type { MeetingDetectionStore } from './meeting-detection-store';
import { extractMeetingCode, matchTranscriptFile } from './meeting-passive-detection-helpers';
import { fetchRecentCalendarMeetings } from './passive-detection-fetchers';
import type { PassiveDetectionUserContext } from './passive-detection-notifier';
import type { PassiveTranscriptProcessor } from './passive-detection-types';

interface ScanCalendarSignalsInput {
  calendarService: CalendarService;
  detectionStore: MeetingDetectionStore;
  processTranscript: PassiveTranscriptProcessor;
  recentTranscriptFiles: DriveFile[];
  user: PassiveDetectionUserContext;
}

export async function scanCalendarSignals(input: ScanCalendarSignalsInput): Promise<void> {
  const events = await fetchRecentCalendarMeetings(input.calendarService);
  for (const event of events) {
    const detectionKey = `calendar:${event.id}`;
    const meetingCode = event.meetingCode || extractMeetingCode(`${event.title} ${event.meetUrl || ''}`);

    await input.detectionStore.upsertCandidate({
      ownerUserId: input.user.ownerUserId,
      detectionKey,
      sourceType: 'calendar',
      meetingTitle: event.title,
      meetingCode,
      calendarEventId: event.id,
      status: 'transcript_pending',
      metadata: {
        start: event.start,
        end: event.end,
        meet_url: event.meetUrl || null,
        detected_via: 'calendar',
      },
    });

    const transcriptFile = matchTranscriptFile(input.recentTranscriptFiles, meetingCode, event.title);
    if (!transcriptFile) continue;
    await input.processTranscript({
      user: input.user,
      detectionKey,
      fileId: transcriptFile.id,
      meetingTitle: event.title,
      sourceRef: event.meetUrl || transcriptFile.webViewLink || `calendar:${event.id}`,
      file: transcriptFile,
    });
  }
}
