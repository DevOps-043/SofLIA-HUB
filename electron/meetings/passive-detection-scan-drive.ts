import type { DriveFile } from '../drive-service';
import type { MeetingDetectionStore } from './meeting-detection-store';
import { extractMeetingCode, inferMeetingTitleFromFile } from './meeting-passive-detection-helpers';
import type { PassiveDetectionUserContext } from './passive-detection-notifier';
import type { PassiveTranscriptProcessor } from './passive-detection-types';

interface ScanDriveTranscriptsInput {
  detectionStore: MeetingDetectionStore;
  processTranscript: PassiveTranscriptProcessor;
  recentTranscriptFiles: DriveFile[];
  user: PassiveDetectionUserContext;
}

export async function scanDriveTranscripts(input: ScanDriveTranscriptsInput): Promise<void> {
  for (const file of input.recentTranscriptFiles) {
    const detectionKey = `drive:${file.id}`;
    const meetingTitle = inferMeetingTitleFromFile(file);

    await input.detectionStore.upsertCandidate({
      ownerUserId: input.user.ownerUserId,
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

    await input.processTranscript({
      user: input.user,
      detectionKey,
      fileId: file.id,
      meetingTitle,
      sourceRef: file.webViewLink || `drive:${file.id}`,
      file,
    });
  }
}
