import type { MeetingWorkflowService } from '../meetings/meeting-workflow-service';
import type { WorkflowHubOverview } from './types';

export async function getSafeMeetingContext(
  meetingWorkflowService: MeetingWorkflowService,
): Promise<WorkflowHubOverview['meetingContext']> {
  try {
    const context = await meetingWorkflowService.getContext();
    return {
      teams: context.teams || [],
      projects: context.projects || [],
      teamMembers: context.teamMembers || [],
    };
  } catch {
    return {
      teams: [],
      projects: [],
      teamMembers: [],
    };
  }
}
