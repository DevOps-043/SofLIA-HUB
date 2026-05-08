import type { DriveFile } from '../drive-service';
import type { MeetingDetectionStore } from './meeting-detection-store';
import type { MeetingRunDetail } from './meeting-types';
import type { MeetingWorkflowService } from './meeting-workflow-service';
import type { PassiveDetectionUserContext } from './passive-detection-notifier';
import type { PassiveTranscriptInput } from './passive-detection-types';

interface ProcessPassiveTranscriptFileInput {
  detectionStore: MeetingDetectionStore;
  input: PassiveTranscriptInput;
  notifyUser: (input: {
    detail: MeetingRunDetail;
    file?: DriveFile;
    user: PassiveDetectionUserContext;
  }) => Promise<void>;
  workflowService: MeetingWorkflowService;
}

export async function processPassiveTranscriptFile({
  detectionStore,
  input,
  notifyUser,
  workflowService,
}: ProcessPassiveTranscriptFileInput): Promise<void> {
  const existing = await detectionStore.getByDetectionKey(input.detectionKey);
  if (existing?.workflow_run_id) return;

  await detectionStore.markStatus(input.detectionKey, 'processing');

  try {
    const result = await workflowService.createDriveRun({
      ownerUserId: input.user.ownerUserId,
      originChannel: 'system',
      originRef: input.sourceRef,
      meetingTitle: input.meetingTitle,
      meetingType: 'google_meet',
      defaultTeamId: null,
      defaultProjectId: null,
      fileIdOrUrl: input.fileId,
    });

    await detectionStore.markRunCreated(input.detectionKey, result.detail.run.id);

    const alreadyNotified = await detectionStore.hasNotifiedRun(result.detail.run.id);
    if (!alreadyNotified) {
      await notifyUser({ user: input.user, detail: result.detail, file: input.file });
      await detectionStore.markStatus(input.detectionKey, 'notified', {
        metadata: { deduplicated: result.deduplicated },
      });
      return;
    }

    await detectionStore.markStatus(input.detectionKey, 'run_created', {
      metadata: {
        deduplicated: result.deduplicated,
        notification_skipped: true,
      },
    });
  } catch (error: any) {
    await detectionStore.markStatus(input.detectionKey, 'error', {
      errorMessage: error?.message || String(error),
    });
    console.error('[MeetingPassiveDetection] Failed to process transcript:', error);
  }
}
