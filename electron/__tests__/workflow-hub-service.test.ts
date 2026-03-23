import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockExistsSync,
  mockReadFileSync,
  mockWriteFileSync,
  mockMkdirSync,
  mockGetPath,
  mockGetSofiaUserByEmail,
} = vi.hoisted(() => ({
  mockExistsSync: vi.fn(() => false),
  mockReadFileSync: vi.fn(() => '{}'),
  mockWriteFileSync: vi.fn(),
  mockMkdirSync: vi.fn(),
  mockGetPath: vi.fn(() => 'C:/tmp/soflia-tests'),
  mockGetSofiaUserByEmail: vi.fn(async () => null),
}));

vi.mock('node:fs', () => ({
  default: {
    existsSync: mockExistsSync,
    readFileSync: mockReadFileSync,
    writeFileSync: mockWriteFileSync,
    mkdirSync: mockMkdirSync,
  },
  existsSync: mockExistsSync,
  readFileSync: mockReadFileSync,
  writeFileSync: mockWriteFileSync,
  mkdirSync: mockMkdirSync,
}));

vi.mock('electron', () => ({
  app: {
    getPath: mockGetPath,
  },
}));

vi.mock('../iris-data-main', () => ({
  getSofiaUserByEmail: mockGetSofiaUserByEmail,
}));

import { WorkflowHubService } from '../workflow-hub-service';

function buildAutomationRun(id: string, templateId: string) {
  return {
    id,
    templateId,
    title: `Caso ${id}`,
    status: 'needs_approval',
    summary: `Resumen ${id}`,
    requestedBy: 'app:user_1',
    createdAt: '2026-03-22T18:00:00.000Z',
    updatedAt: '2026-03-22T18:10:00.000Z',
    input: {},
    source: null,
    preview: { summary: 'ok' },
    actions: [
      {
        id: `${id}-a1`,
        kind: 'gmail_send',
        title: 'Enviar correo',
        status: 'pending',
        payload: { to: 'demo@empresa.com' },
      },
    ],
    approvals: [],
    logs: [],
  };
}

function buildMeetingSummary() {
  return {
    run: {
      id: 'meeting_run_1',
      owner_user_id: 'user_1',
      meeting_title: 'Comite semanal',
      meeting_type: 'operacion',
      status: 'REVIEW_REQUIRED',
      created_at: '2026-03-22T19:00:00.000Z',
      updated_at: '2026-03-22T19:05:00.000Z',
    },
    latest_asset: {
      id: 'asset_1',
      executive_summary: 'Resumen ejecutivo',
      operational_summary: 'Resumen operativo',
      review_flags: [{ code: 'missing_owner', message: 'Falta responsable' }],
      created_at: '2026-03-22T19:05:00.000Z',
    },
    counts: {
      draft_actions: 1,
      approved_actions: 0,
      synced_actions: 0,
      failed_actions: 0,
    },
  };
}

function buildMeetingDetail() {
  return {
    run: {
      id: 'meeting_run_1',
      owner_user_id: 'user_1',
      meeting_title: 'Comite semanal',
      meeting_type: 'operacion',
      status: 'REVIEW_REQUIRED',
      created_at: '2026-03-22T19:00:00.000Z',
      updated_at: '2026-03-22T19:05:00.000Z',
    },
    source_artifacts: [],
    latest_asset: {
      id: 'asset_1',
      payload: {
        executive_summary: 'Resumen ejecutivo',
        operational_summary: 'Resumen operativo',
        decisions: [],
        commitments: [],
        issues: [],
        review_flags: [{ code: 'missing_owner', message: 'Falta responsable' }],
        proposed_actions: [{ summary: 'Crear tarea' }],
        analysis_result: {
          executiveSummary: 'Resumen ejecutivo',
          keyPoints: ['Cliente pidio seguimiento'],
          decisions: [],
          agreements: [],
          tasks: [],
          risks: [],
          openQuestions: [],
          unresolvedItems: [],
        },
      },
      executive_summary: 'Resumen ejecutivo',
      operational_summary: 'Resumen operativo',
      review_flags: [{ code: 'missing_owner', message: 'Falta responsable' }],
    },
    sync_actions: [
      {
        id: 'sync_action_1',
        action_type: 'iris_task',
        summary: 'Crear tarea en IRIS',
        approval_state: 'draft',
        sync_state: 'pending',
        error_message: null,
        blocking_flags: ['missing_owner'],
        payload: {
          title: 'Dar seguimiento',
          team_id: 'team_1',
          project_id: 'project_1',
          due_date: null,
          assignee_id: null,
        },
      },
    ],
    approvals: [],
  };
}

function createService() {
  const executeTemplate = vi.fn(async (input: any) => buildAutomationRun(`run_${input.templateId}`, input.templateId));
  const createManualRun = vi.fn(async () => ({ detail: buildMeetingDetail(), deduplicated: false }));
  const createDriveRun = vi.fn(async () => ({ detail: buildMeetingDetail(), deduplicated: false }));
  const scheduledTasks: any[] = [];
  const taskScheduler = {
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
      if (existingIndex >= 0) {
        scheduledTasks[existingIndex] = task;
      } else {
        scheduledTasks.push(task);
      }
      return task;
    }),
    deleteTask: vi.fn((taskId: string) => {
      const index = scheduledTasks.findIndex((task) => task.id === taskId);
      if (index < 0) return false;
      scheduledTasks.splice(index, 1);
      return true;
    }),
  };

  const service = new WorkflowHubService({
    calendarService: {
      getConnections: vi.fn(() => [
        {
          provider: 'google',
          isActive: true,
          email: 'owner@empresa.com',
          userId: '',
        },
      ]),
    } as any,
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
      listRuns: vi.fn(() => [
        buildAutomationRun('run_mail', 'gmail_triage'),
      ]),
      getRun: vi.fn(() => buildAutomationRun('run_mail', 'gmail_triage')),
      executeTemplate,
      approveRun: vi.fn(async () => buildAutomationRun('run_mail', 'gmail_triage')),
      rejectRun: vi.fn(() => buildAutomationRun('run_mail', 'gmail_triage')),
    } as any,
    meetingWorkflowService: {
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
    } as any,
  });

  service.init();

  return {
    service,
    executeTemplate,
    createManualRun,
    createDriveRun,
    taskScheduler,
  };
}

describe('WorkflowHubService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(false);
    mockReadFileSync.mockReturnValue('{}');
    mockGetPath.mockReturnValue('C:/tmp/soflia-tests');
    mockGetSofiaUserByEmail.mockResolvedValue(null);
  });

  it('merges builtin workflows, variants, unified cases and workspace capability diagnostics', async () => {
    const { service } = createService();

    service.saveVariant({
      workflowId: 'correo',
      name: 'VIP',
      config: {
        preset: 'priority',
        maxResults: 99,
        unknownField: 'ignored',
      },
      createdBy: 'user_1',
    });

    const overview = await service.getOverview();

    expect(overview.workflows.some((workflow) => workflow.id === 'reuniones')).toBe(true);
    expect(overview.variants).toHaveLength(1);
    expect(overview.variants[0].config).toEqual({
      preset: 'priority',
      query: '',
      maxResults: 10,
      gchatSpace: '',
      removeFromInbox: true,
    });
    expect(overview.cases.map((item) => item.id)).toEqual(
      expect.arrayContaining(['automation:run_mail', 'meeting:meeting_run_1']),
    );
    expect(overview.legacyCustomTemplates).toHaveLength(1);
    expect(overview.capabilities.find((item) => item.key === 'gchat')?.state).toBe('setup_required');
    expect(overview.capabilities.find((item) => item.key === 'google_user_mapping')?.state).toBe('blocked');
    expect(overview.passiveRules.some((rule) => rule.id === 'system:reuniones-auto')).toBe(true);
  });

  it('routes reuniones prep to the builtin meeting prep automation', async () => {
    const { service, executeTemplate } = createService();

    const detail = await service.executeWorkflow({
      workflowId: 'reuniones',
      requestedBy: 'app:user_1',
      input: {
        mode: 'prep',
        targetDate: '2026-03-22',
      },
    });

    expect(executeTemplate).toHaveBeenCalledWith(expect.objectContaining({
      templateId: 'calendar_meeting_prep',
      input: expect.objectContaining({
        targetDate: '2026-03-22',
      }),
    }));
    expect(detail.workflowId).toBe('reuniones');
    expect(detail.engine).toBe('automation');
  });

  it('routes reuniones manual to the rich meeting workflow service', async () => {
    const { service, createManualRun } = createService();

    const detail = await service.executeWorkflow({
      workflowId: 'reuniones',
      requestedBy: 'app:user_1',
      input: {
        mode: 'manual',
        meetingTitle: 'Comite semanal',
        manualText: 'Acuerdos y tareas de la reunion',
      },
    });

    expect(createManualRun).toHaveBeenCalledWith(expect.objectContaining({
      ownerUserId: 'user_1',
      meetingTitle: 'Comite semanal',
      text: 'Acuerdos y tareas de la reunion',
    }));
    expect(detail.engine).toBe('meeting');
    expect(detail.workflowId).toBe('reuniones');
  });

  it('sanitizes variant config to allowed template fields only', () => {
    const { service } = createService();

    const variant = service.saveVariant({
      workflowId: 'drive',
      name: 'Operacion base',
      config: {
        projectName: 'Cliente demo',
        folderPreset: 'invalido',
        parentFolderId: 'folder_123',
        extra: 'remove',
      },
      createdBy: 'user_1',
    });

    expect(variant.config).toEqual({
      projectName: 'Cliente demo',
      parentFolderId: 'folder_123',
      gchatSpace: '',
      folderPreset: 'cliente_estandar',
    });
  });

  it('stores passive workflows on the scheduler and returns them in the overview', async () => {
    const { service, taskScheduler } = createService();

    const rule = service.savePassiveRule({
      workflowId: 'correo',
      name: 'Correos 8 AM',
      description: 'Resumen diario de correo',
      cronExpression: '0 8 * * 1-5',
      scheduleLabel: 'Lunes a viernes a las 08:00',
      config: {
        preset: 'priority',
        maxResults: 3,
      },
      requestedBy: 'app:user_1',
      executionMode: 'workflow',
    });

    expect(taskScheduler.upsertTask).toHaveBeenCalledWith(expect.objectContaining({
      workflowId: 'correo',
      executionMode: 'workflow',
      workflowInput: expect.objectContaining({
        preset: 'priority',
        maxResults: 3,
      }),
    }));
    expect(rule.workflowId).toBe('correo');

    const overview = await service.getOverview();
    const scheduled = overview.passiveRules.find((item) => item.id === rule.id);
    expect(scheduled?.name).toBe('Correos 8 AM');
    expect(scheduled?.scheduleLabel).toBe('Lunes a viernes a las 08:00');
  });
});
