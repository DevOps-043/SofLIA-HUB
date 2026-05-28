import { vi } from 'vitest';
import { WorkflowHubService } from '../../workflow-hub-service';
import { buildAutomationRun } from './automation-fixtures';
import { buildMeetingDetail, buildMeetingSummary } from './meeting-fixtures';

export function createWorkflowHubTestService() {
  const executeTemplate = vi.fn(async (input: any) => buildAutomationRun(`run_${input.templateId}`, input.templateId));
  const createManualRun = vi.fn(async () => ({ detail: buildMeetingDetail(), deduplicated: false }));
  const createDriveRun = vi.fn(async () => ({ detail: buildMeetingDetail(), deduplicated: false }));
  const taskScheduler = createTaskScheduler();

  const service = new WorkflowHubService({
    calendarService: { getConnections: vi.fn(() => [{ provider: 'google', isActive: true, email: 'owner@empresa.com', userId: '' }]) } as any,
    gchatService: { listSpaces: vi.fn(async () => ({ success: false, error: 'Google Chat app not found. To create a Chat app, you must turn on the Chat API and configure the app in the Google Cloud console.' })) } as any,
    taskScheduler: taskScheduler as any,
    workspaceAutomationService: createWorkspaceAutomationService(executeTemplate) as any,
    meetingWorkflowService: createMeetingWorkflowService(createManualRun, createDriveRun) as any,
  });

  service.init();
  return { service, executeTemplate, createManualRun, createDriveRun, taskScheduler };
}

function createTaskScheduler() {
  const scheduledTasks: any[] = [];
  return {
    getTasks: vi.fn(() => [...scheduledTasks]),
    upsertTask: vi.fn((input: any) => {
      const existingIndex = scheduledTasks.findIndex((task) => task.id === input.id);
      const now = '2026-03-22T20:00:00.000Z';
      const task = {
        id: input.id || `task_${scheduledTasks.length + 1}`,
        cronExpression: input.cronExpression,
        prompt: input.prompt,
        phoneNumber: input.phoneNumber || '',
        createdAt: existingIndex >= 0 ? scheduledTasks[existingIndex].createdAt : now,
        updatedAt: now,
        lastRun: existingIndex >= 0 ? scheduledTasks[existingIndex].lastRun : undefined,
        runOnce: input.runOnce === true,
        scheduledFor: input.scheduledFor || null,
        name: input.name,
        description: input.description,
        scheduleLabel: input.scheduleLabel,
        source: input.source || 'app',
        kind: input.kind || 'passive_workflow',
        executionMode: input.executionMode || 'workflow',
        workflowId: input.workflowId || null,
        workflowInput: input.workflowInput || {},
        requestedBy: input.requestedBy || null,
        passiveRuleId: input.passiveRuleId || input.id || null,
      };
      if (existingIndex >= 0) scheduledTasks[existingIndex] = task;
      else scheduledTasks.push(task);
      return task;
    }),
    deleteTask: vi.fn((taskId: string) => {
      const index = scheduledTasks.findIndex((task) => task.id === taskId);
      if (index < 0) return false;
      scheduledTasks.splice(index, 1);
      return true;
    }),
  };
}

function createWorkspaceAutomationService(executeTemplate: any) {
  return {
    listTemplates: vi.fn(() => [
      { id: 'gmail_triage', name: 'Triage Gmail', description: 'Builtin', kind: 'builtin', inputSchema: {} },
      { id: 'custom_ops', name: 'Flujo libre legacy', description: 'Legacy', kind: 'custom', inputSchema: {}, createdAt: '2026-03-22T17:00:00.000Z' },
    ]),
    listRuns: vi.fn(() => [buildAutomationRun('run_mail', 'gmail_triage')]),
    getRun: vi.fn(() => buildAutomationRun('run_mail', 'gmail_triage')),
    executeTemplate,
    approveRun: vi.fn(async () => buildAutomationRun('run_mail', 'gmail_triage')),
    rejectRun: vi.fn(() => buildAutomationRun('run_mail', 'gmail_triage')),
  };
}

function createMeetingWorkflowService(createManualRun: any, createDriveRun: any) {
  return {
    listRuns: vi.fn(async () => [buildMeetingSummary()]),
    getRunDetail: vi.fn(async () => buildMeetingDetail()),
    createManualRun,
    createDriveRun,
    approveAsset: vi.fn(async () => buildMeetingDetail()),
    approveActions: vi.fn(async () => buildMeetingDetail()),
    rejectAction: vi.fn(async () => buildMeetingDetail()),
    updateAction: vi.fn(async () => buildMeetingDetail()),
    syncApprovedActions: vi.fn(async () => ({ detail: buildMeetingDetail(), result: { synced: 1, failed: 0, skipped: 0 } })),
    getContext: vi.fn(async () => ({
      teams: [{ team_id: 'team_1', name: 'Operacion' }],
      projects: [{ project_id: 'project_1', project_name: 'Cuenta clave', team_id: 'team_1' }],
      teamMembers: [{ membership_id: 'member_1', team_id: 'team_1', user_id: 'user_1', role: 'owner', joined_at: '2026-03-01', display_name: 'Fernando' }],
    })),
  };
}
