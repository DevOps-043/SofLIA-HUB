import { randomUUID } from 'node:crypto';

import type { ScheduledTaskInfo } from './types';

export function normalizeScheduledTask(task: Partial<ScheduledTaskInfo>): ScheduledTaskInfo {
  const createdAt = String(task.createdAt || new Date().toISOString());
  return {
    id: String(task.id || randomUUID()),
    cronExpression: String(task.cronExpression || '').trim(),
    prompt: String(task.prompt || '').trim(),
    phoneNumber: String(task.phoneNumber || '').trim(),
    createdAt,
    updatedAt: String(task.updatedAt || createdAt),
    lastRun: task.lastRun ? String(task.lastRun) : undefined,
    runOnce: task.runOnce === true,
    scheduledFor: task.scheduledFor ? String(task.scheduledFor).trim() : null,
    name: task.name ? String(task.name).trim() : undefined,
    description: task.description ? String(task.description).trim() : undefined,
    scheduleLabel: task.scheduleLabel ? String(task.scheduleLabel).trim() : undefined,
    source: task.source === 'chat' || task.source === 'app' ? task.source : 'legacy',
    kind: task.kind || 'legacy_prompt',
    executionMode: task.executionMode || 'agent_prompt',
    workflowId: task.workflowId ? String(task.workflowId).trim() : null,
    workflowInput: task.workflowInput && typeof task.workflowInput === 'object'
      ? { ...task.workflowInput }
      : {},
    requestedBy: task.requestedBy ? String(task.requestedBy).trim() : null,
    passiveRuleId: task.passiveRuleId ? String(task.passiveRuleId).trim() : null,
  };
}
