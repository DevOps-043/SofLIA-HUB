import { vi } from 'vitest';

export function buildAutomationRun(id: string, templateId: string) {
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
    actions: [{
      id: `${id}-a1`,
      kind: 'gmail_send',
      title: 'Enviar correo',
      status: 'pending',
      payload: { to: 'demo@empresa.com' },
    }],
    approvals: [],
    logs: [],
  };
}

export function createTaskSchedulerFixture() {
  const scheduledTasks: any[] = [];
  return {
    scheduledTasks,
    taskScheduler: {
      getTasks: vi.fn(() => [...scheduledTasks]),
      upsertTask: vi.fn((input: any) => upsertScheduledTask(scheduledTasks, input)),
      deleteTask: vi.fn((taskId: string) => {
        const index = scheduledTasks.findIndex((task) => task.id === taskId);
        if (index < 0) return false;
        scheduledTasks.splice(index, 1);
        return true;
      }),
    },
  };
}

function upsertScheduledTask(scheduledTasks: any[], input: any) {
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
  if (existingIndex >= 0) scheduledTasks[existingIndex] = task;
  else scheduledTasks.push(task);
  return task;
}
