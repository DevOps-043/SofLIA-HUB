import { vi } from 'vitest';
import './workflow-hub-test-mocks';
import { WorkflowHubService } from '../workflow-hub-service';
import { buildAutomationRun, createTaskSchedulerFixture } from './workflow-hub-automation-fixtures';
import { buildMeetingDetail, buildMeetingSummary } from './workflow-hub-meeting-fixtures';

export function createWorkflowHubTestService() {
  const executeTemplate = vi.fn(async (input: any) => buildAutomationRun(`run_${input.templateId}`, input.templateId));
  const createManualRun = vi.fn(async () => ({ detail: buildMeetingDetail(), deduplicated: false }));
  const createDriveRun = vi.fn(async () => ({ detail: buildMeetingDetail(), deduplicated: false }));
  const { taskScheduler } = createTaskSchedulerFixture();

  const service = new WorkflowHubService({
    calendarService: { getConnections: vi.fn(() => [{ provider: 'google', isActive: true, email: 'owner@empresa.com', userId: '' }]) } as any,
    gchatService: {
      listSpaces: vi.fn(async () => ({
        success: false,
        error: 'Google Chat app not found. To create a Chat app, you must turn on the Chat API and configure the app in the Google Cloud console.',
      })),
    } as any,
    taskScheduler: taskScheduler as any,
    workspaceAutomationService: {
      listTemplates: vi.fn(() => [
        { id: 'gmail_triage', name: 'Triage Gmail', description: 'Builtin', kind: 'builtin', inputSchema: {} },
        { id: 'custom_ops', name: 'Flujo libre legacy', description: 'Legacy', kind: 'custom', inputSchema: {}, createdAt: '2026-03-22T17:00:00.000Z' },
      ]),
      listRuns: vi.fn(() => [buildAutomationRun('run_mail', 'gmail_triage')]),
      getRun: vi.fn(() => buildAutomationRun('run_mail', 'gmail_triage')),
      executeTemplate,
      approveRun: vi.fn(async () => buildAutomationRun('run_mail', 'gmail_triage')),
      rejectRun: vi.fn(() => buildAutomationRun('run_mail', 'gmail_triage')),
    } as any,
    meetingWorkflowService: buildMeetingWorkflowService(createManualRun, createDriveRun) as any,
  });

  service.init();
  return { service, executeTemplate, createManualRun, createDriveRun, taskScheduler };
}

function buildMeetingWorkflowService(createManualRun: any, createDriveRun: any) {
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
