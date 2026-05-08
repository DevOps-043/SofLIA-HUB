import type { WorkspaceAutomationService } from '../../workspace-automation-service.ts';
import type { WorkflowActionRecord, WorkflowRunRecord, WorkflowRunStatus, WorkflowTemplateId } from '../types';

export function createRun(this: WorkspaceAutomationService, input: {
    templateId: WorkflowTemplateId;
    title: string;
    requestedBy: string | null;
    input: Record<string, any>;
    source: Record<string, any> | null;
    preview: Record<string, any>;
    actions: WorkflowActionRecord[];
    status: WorkflowRunStatus;
    initialLog: string;
  }): WorkflowRunRecord {
    const now = new Date().toISOString();
    const run: WorkflowRunRecord = {
      id: `wf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      templateId: input.templateId,
      title: input.title,
      status: input.status,
      summary: String(input.preview.summary || input.title),
      requestedBy: input.requestedBy,
      createdAt: now,
      updatedAt: now,
      input: input.input,
      source: input.source,
      preview: input.preview,
      actions: input.actions,
      approvals: [],
      logs: [
        {
          at: now,
          level: 'info',
          message: input.initialLog,
        },
      ],
    };

    this.state.runs.unshift(run);
    this.state.runs = this.state.runs.slice(0, 100);
    this.persistAndEmit(run);
    return structuredClone(run);
  }
