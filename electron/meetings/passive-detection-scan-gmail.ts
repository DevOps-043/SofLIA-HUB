import type { DriveFile } from '../drive-service';
import type { GmailService } from '../gmail-service';
import type { MeetingDetectionStore } from './meeting-detection-store';
import {
  extractDriveFileId,
  extractMeetingCode,
  extractMeetingTitleFromEmail,
  looksLikeMeetingRecordSubject,
  matchTranscriptFile,
} from './meeting-passive-detection-helpers';
import type { PassiveDetectionUserContext } from './passive-detection-notifier';
import type { PassiveTranscriptProcessor } from './passive-detection-types';

interface ScanGmailSignalsInput {
  detectionStore: MeetingDetectionStore;
  gmailService: GmailService;
  processTranscript: PassiveTranscriptProcessor;
  recentTranscriptFiles: DriveFile[];
  user: PassiveDetectionUserContext;
}

export async function scanGmailSignals(input: ScanGmailSignalsInput): Promise<void> {
  const result = await input.gmailService.getMessages({ maxResults: 15, query: 'from:meetings-noreply@google.com newer_than:7d' });
  if (!result.success || !result.messages?.length) return;

  for (const message of result.messages) {
    const subject = message.subject || '';
    if (!looksLikeMeetingRecordSubject(subject)) continue;

    const fullMessage = await input.gmailService.getMessage(message.id);
    const body = fullMessage.message?.body || message.snippet || '';
    const detectionKey = `gmail:${message.id}`;
    const meetingTitle = extractMeetingTitleFromEmail(subject);
    const meetingCode = extractMeetingCode(`${subject} ${body}`);
    const directTranscriptFileId = extractDriveFileId(body);
    const matchedTranscriptFile = directTranscriptFileId ? null : matchTranscriptFile(input.recentTranscriptFiles, meetingCode, meetingTitle);
    const resolvedFileId = directTranscriptFileId || matchedTranscriptFile?.id || null;

    await input.detectionStore.upsertCandidate({
      ownerUserId: input.user.ownerUserId,
      detectionKey,
      sourceType: 'gmail',
      meetingTitle,
      meetingCode,
      gmailMessageId: message.id,
      driveFileId: resolvedFileId,
      status: resolvedFileId ? 'detected' : 'transcript_pending',
      metadata: {
        subject,
        from: message.from,
        date: message.date.toISOString(),
        detected_via: 'gmail',
      },
    });

    if (!resolvedFileId) continue;
    await input.processTranscript({
      user: input.user,
      detectionKey,
      fileId: resolvedFileId,
      meetingTitle,
      sourceRef: `gmail:${message.id}`,
      file: matchedTranscriptFile || undefined,
    });
  }
}
