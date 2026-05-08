import type { LlmTaskService } from '../../llm-task-service';
import type {
  WorkflowActionRecord,
  WorkflowDependencies,
  WorkflowRunRecord,
  WorkflowRunStatus,
  WorkflowTemplateId,
} from '../types';

export interface CreateWorkflowRunInput {
  templateId: WorkflowTemplateId;
  title: string;
  requestedBy: string | null;
  input: Record<string, any>;
  source: Record<string, any> | null;
  preview: Record<string, any>;
  actions: WorkflowActionRecord[];
  status: WorkflowRunStatus;
  initialLog: string;
}

export interface WorkspaceTemplateHandlerContext {
  deps: WorkflowDependencies;
  llmTaskService: LlmTaskService;
  createRun(input: CreateWorkflowRunInput): WorkflowRunRecord;
}
