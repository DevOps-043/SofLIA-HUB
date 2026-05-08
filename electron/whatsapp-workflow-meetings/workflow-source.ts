import type { MeetingWorkflowService } from '../meetings/meeting-workflow-service';
import { looksLikeDriveReference } from './formatters';

export async function importMeetingWorkflowSource(
  workflowService: MeetingWorkflowService,
  senderNumber: string,
  text: string,
) {
  const context = await workflowService.getContext();
  const defaultTeamId = context.teams.length === 1 ? context.teams[0].team_id : null;
  const matchingProjects = defaultTeamId
    ? context.projects.filter((project) => !project.team_id || project.team_id === defaultTeamId)
    : [];
  const defaultProjectId = matchingProjects.length === 1 ? matchingProjects[0].project_id : null;

  if (looksLikeDriveReference(text)) {
    return workflowService.createDriveRun({
      ownerUserId: senderNumber,
      originChannel: 'whatsapp',
      originRef: text.trim(),
      meetingTitle: null,
      meetingType: 'general',
      defaultTeamId,
      defaultProjectId,
      fileIdOrUrl: text.trim(),
    });
  }

  return workflowService.createManualRun({
    ownerUserId: senderNumber,
    originChannel: 'whatsapp',
    originRef: `whatsapp:${senderNumber}`,
    meetingTitle: null,
    meetingType: 'general',
    defaultTeamId,
    defaultProjectId,
    text,
  });
}
