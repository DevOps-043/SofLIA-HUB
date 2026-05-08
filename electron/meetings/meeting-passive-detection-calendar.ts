import type { CalendarService } from '../calendar-service';
import type { DriveFile } from '../drive-service';
import {
  extractMeetingCode,
  matchTranscriptFile,
} from './meeting-passive-detection-helpers';
import { processPassiveTranscript, type PassiveDetectionDeps } from './meeting-passive-detection-process';
import { fetchRecentCalendarMeetings } from './passive-detection-fetchers';
import type { PassiveDetectionUserContext } from './passive-detection-notifier';

export async function scanCalendarMeetingSignals(
  user: PassiveDetectionUserContext,
  recentTranscriptFiles: DriveFile[],
  calendarService: CalendarService,
  deps: PassiveDetectionDeps,
): Promise<void> {
  const events = await fetchRecentCalendarMeetings(calendarService);
  for (const event of events) {
    const detectionKey = `calendar:${event.id}`;
    const meetingCode = event.meetingCode || extractMeetingCode(`${event.title} ${event.meetUrl || ''}`);

    await deps.detectionStore.upsertCandidate({
      ownerUserId: user.ownerUserId,
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

    const transcriptFile = matchTranscriptFile(recentTranscriptFiles, meetingCode, event.title);
    if (!transcriptFile) continue;
    await processPassiveTranscript({
      user,
      detectionKey,
      fileId: transcriptFile.id,
      meetingTitle: event.title,
      sourceRef: event.meetUrl || transcriptFile.webViewLink || `calendar:${event.id}`,
      file: transcriptFile,
    }, deps);
  }
}
