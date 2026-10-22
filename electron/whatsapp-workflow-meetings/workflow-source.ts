import type { MeetingWorkflowService } from '../meetings/meeting-workflow-service';
import { looksLikeDriveReference } from './formatters';

export async function importMeetingWorkflowSource(
  workflowService: MeetingWorkflowService,
  senderNumber: string,
  text: string,
) {

  if (looksLikeDriveReference(text)) {
    return workflowService.createDriveRun({
      ownerUserId: senderNumber,
      originChannel: 'whatsapp',
      originRef: text.trim(),
      meetingTitle: null,
      meetingType: 'general',
      fileIdOrUrl: text.trim(),
    });
  }

  return workflowService.createManualRun({
    ownerUserId: senderNumber,
    originChannel: 'whatsapp',
    originRef: `whatsapp:${senderNumber}`,
    meetingTitle: null,
    meetingType: 'general',
    text,
  });
}
