import type { DriveFile } from '../drive-service';
import type { MeetingDetectionStore } from './meeting-detection-store';
import type { MeetingRunDetail } from './meeting-types';
import type { MeetingWorkflowService } from './meeting-workflow-service';
import { notifyMeetingDetectionUser, type PassiveDetectionUserContext } from './passive-detection-notifier';
import type { WhatsAppService } from '../whatsapp-service';

export interface PassiveDetectionDeps {
  detectionStore: MeetingDetectionStore;
  workflowService: MeetingWorkflowService;
  whatsappService: WhatsAppService | null;
  emitDetected: (payload: unknown) => boolean;
}

export async function processPassiveTranscript(input: {
  user: PassiveDetectionUserContext;
  detectionKey: string;
  fileId: string;
  meetingTitle: string | null;
  sourceRef: string;
  file?: DriveFile;
}, deps: PassiveDetectionDeps): Promise<void> {
  const existing = await deps.detectionStore.getByDetectionKey(input.detectionKey);
  if (existing?.workflow_run_id) return;

  await deps.detectionStore.markStatus(input.detectionKey, 'processing');
  try {
    const result = await deps.workflowService.createDriveRun({
      ownerUserId: input.user.ownerUserId,
      originChannel: 'system',
      originRef: input.sourceRef,
      meetingTitle: input.meetingTitle,
      meetingType: 'google_meet',
      defaultTeamId: null,
      defaultProjectId: null,
      fileIdOrUrl: input.fileId,
    });

    await deps.detectionStore.markRunCreated(input.detectionKey, result.detail.run.id);
    await markNotificationState(input, result.detail, result.deduplicated, deps);
  } catch (error: any) {
    await deps.detectionStore.markStatus(input.detectionKey, 'error', {
      errorMessage: error?.message || String(error),
    });
    console.error('[MeetingPassiveDetection] Failed to process transcript:', error);
  }
}

async function markNotificationState(
  input: { user: PassiveDetectionUserContext; detectionKey: string; file?: DriveFile },
  detail: MeetingRunDetail,
  deduplicated: boolean,
  deps: PassiveDetectionDeps,
): Promise<void> {
  const alreadyNotified = await deps.detectionStore.hasNotifiedRun(detail.run.id);
  if (alreadyNotified) {
    await deps.detectionStore.markStatus(input.detectionKey, 'run_created', {
      metadata: { deduplicated, notification_skipped: true },
    });
    return;
  }

  await notifyMeetingDetectionUser({
    detail,
    file: input.file,
    user: input.user,
    whatsappService: deps.whatsappService,
    workflowService: deps.workflowService,
    emitDetected: deps.emitDetected,
  });
  await deps.detectionStore.markStatus(input.detectionKey, 'notified', { metadata: { deduplicated } });
}
