import type { WorkflowHubService } from '../../workflow-hub-service';

export type PassiveWorkflowId = 'correo' | 'agenda' | 'reuniones';

export interface PassiveWorkflowIntent {
  workflowId?: PassiveWorkflowId;
  name: string;
  description: string;
  prompt: string;
  cronExpression: string;
  scheduleLabel: string;
}

export interface PassiveWorkflowRequestContext {
  workflowHubService: WorkflowHubService | null;
  senderNumber: string;
  text: string;
  isGroup: boolean;
}
