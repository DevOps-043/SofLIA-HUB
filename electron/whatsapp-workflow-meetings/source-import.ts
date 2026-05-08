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
  const baseInput = {
    ownerUserId: senderNumber,
    originChannel: 'whatsapp' as const,
    meetingTitle: null,
    meetingType: 'general' as const,
    defaultTeamId,
    defaultProjectId,
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
