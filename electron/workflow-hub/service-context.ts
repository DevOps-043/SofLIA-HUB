import type { CalendarService } from '../calendar-service';
import type { GChatService } from '../gchat-service';
import type { WorkspaceAutomationService } from '../workspace-automation-service';
import type { TaskScheduler } from '../task-scheduler';
import type { MeetingWorkflowService } from '../meetings/meeting-workflow-service';
import type { WorkflowDefinition, WorkflowHubState, WorkflowId } from './types';

export interface WorkflowHubDependencies {
  calendarService: CalendarService;
  gchatService: GChatService;
  taskScheduler: TaskScheduler;
  workspaceAutomationService: WorkspaceAutomationService;
  meetingWorkflowService: MeetingWorkflowService;
}

export interface WorkflowHubServiceContext {
  deps: WorkflowHubDependencies;
  state: WorkflowHubState;
  getWorkflowDefinition(workflowId: WorkflowId): WorkflowDefinition;
  saveState(): void;
}
