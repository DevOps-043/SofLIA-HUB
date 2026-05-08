import type { DriveFile } from '../drive-service';
import {
  extractMeetingCode,
  inferMeetingTitleFromFile,
} from './meeting-passive-detection-helpers';
import { processPassiveTranscript, type PassiveDetectionDeps } from './meeting-passive-detection-process';
import type { PassiveDetectionUserContext } from './passive-detection-notifier';

export async function scanDriveTranscriptSignals(
  user: PassiveDetectionUserContext,
  recentTranscriptFiles: DriveFile[],
  deps: PassiveDetectionDeps,
): Promise<void> {
  for (const file of recentTranscriptFiles) {
    const detectionKey = `drive:${file.id}`;
    const meetingTitle = inferMeetingTitleFromFile(file);

    await deps.detectionStore.upsertCandidate({
      ownerUserId: user.ownerUserId,
      detectionKey,
      sourceType: 'drive',
      meetingTitle,
      meetingCode: extractMeetingCode(file.name),
      driveFileId: file.id,
      status: 'detected',
      metadata: {
        file_name: file.name,
        web_view_link: file.webViewLink || null,
        created_time: file.createdTime || null,
        detected_via: 'drive',
      },
    });

    await processPassiveTranscript({
      user,
      detectionKey,
      fileId: file.id,
      meetingTitle,
      sourceRef: file.webViewLink || `drive:${file.id}`,
      file,
    }, deps);
  }
}
