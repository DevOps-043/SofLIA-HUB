import type { MeetingWorkflowService } from '../meetings/meeting-workflow-service';
import { looksLikeDriveReference } from './formatters';

export async function importMeetingWorkflowSource(
  workflowService: MeetingWorkflowService,
  senderNumber: string,
  text: string,
) {
  const baseInput = {
    ownerUserId: senderNumber,
    originChannel: 'whatsapp' as const,
    meetingTitle: null,
    meetingType: 'general' as const,
  };

  if (looksLikeDriveReference(text)) {
    return workflowService.createDriveRun({
      ...baseInput,
      originRef: text.trim(),
      fileIdOrUrl: text.trim(),
    });
  }

  return workflowService.createManualRun({
    ...baseInput,
    originRef: `whatsapp:${senderNumber}`,
    text,
  });
}
