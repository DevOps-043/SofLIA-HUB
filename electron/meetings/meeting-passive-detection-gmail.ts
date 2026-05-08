import type { DriveFile } from '../drive-service';
import type { GmailService } from '../gmail-service';
import {
  extractDriveFileId,
  extractMeetingCode,
  extractMeetingTitleFromEmail,
  looksLikeMeetingRecordSubject,
  matchTranscriptFile,
} from './meeting-passive-detection-helpers';
import { processPassiveTranscript, type PassiveDetectionDeps } from './meeting-passive-detection-process';
import type { PassiveDetectionUserContext } from './passive-detection-notifier';

export async function scanGmailMeetingSignals(
  user: PassiveDetectionUserContext,
  recentTranscriptFiles: DriveFile[],
  gmailService: GmailService,
  deps: PassiveDetectionDeps,
): Promise<void> {
  const result = await gmailService.getMessages({ maxResults: 15, query: 'from:meetings-noreply@google.com newer_than:7d' });
  if (!result.success || !result.messages?.length) return;

  for (const message of result.messages) {
    const subject = message.subject || '';
    if (!looksLikeMeetingRecordSubject(subject)) continue;

    const fullMessage = await gmailService.getMessage(message.id);
    const body = fullMessage.message?.body || message.snippet || '';
    const meetingTitle = extractMeetingTitleFromEmail(subject);
    const meetingCode = extractMeetingCode(`${subject} ${body}`);
    const directTranscriptFileId = extractDriveFileId(body);
    const matchedTranscriptFile = directTranscriptFileId ? null : matchTranscriptFile(recentTranscriptFiles, meetingCode, meetingTitle);
    const resolvedFileId = directTranscriptFileId || matchedTranscriptFile?.id || null;
    const detectionKey = `gmail:${message.id}`;

    await deps.detectionStore.upsertCandidate({
      ownerUserId: user.ownerUserId,
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
    await processPassiveTranscript({
      user,
      detectionKey,
      fileId: resolvedFileId,
      meetingTitle,
      sourceRef: `gmail:${message.id}`,
      file: matchedTranscriptFile || undefined,
    }, deps);
  }
}
