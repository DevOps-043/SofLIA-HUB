import type { ScheduledTaskInfo } from '../task-scheduler';
import { describeCron, isWorkflowId } from './normalizers';
import type {
  PassiveWorkflowRule,
  PassiveWorkflowStatus,
  WorkflowDefinition,
  WorkflowId,
  WorkspaceCapabilityStatus,
} from './types';

type WorkflowResolver = (workflowId: WorkflowId) => WorkflowDefinition;

export function mapScheduledTaskToPassiveRule(
  task: ScheduledTaskInfo,
  getWorkflowDefinition: WorkflowResolver,
): PassiveWorkflowRule {
  const workflowId = task.workflowId && isWorkflowId(task.workflowId) ? task.workflowId : null;
  const workflowName = workflowId ? getWorkflowDefinition(workflowId).name : 'Rutina libre';
  const status: PassiveWorkflowStatus = task.kind === 'passive_workflow' || task.kind === 'passive_prompt'
    ? 'active'
    : 'active';

  return {
    id: task.id,
    workflowId,
    workflowName,
    name: task.name || workflowName,
    description: task.description || (workflowId
      ? `Workflow pasivo ${workflowName.toLowerCase()} programado.`
      : 'Instruccion recordada que el agente ejecutara automaticamente.'),
    prompt: task.prompt,
    scheduleLabel: task.scheduleLabel || describeCron(task.cronExpression),
    cronExpression: task.cronExpression,
    source: task.source === 'chat' || task.source === 'app' ? task.source : 'legacy',
    status,
    executionMode: task.executionMode || 'agent_prompt',
    createdAt: task.createdAt,
    updatedAt: task.updatedAt || task.createdAt,
    lastRunAt: task.lastRun || null,
    requestedBy: task.requestedBy || null,
    phoneNumber: task.phoneNumber || null,
    config: task.workflowInput && typeof task.workflowInput === 'object' ? { ...task.workflowInput } : {},
    reason: null,
  };
}

export function getSystemPassiveRules(
  capabilities: WorkspaceCapabilityStatus[],
  getWorkflowDefinition: WorkflowResolver,
): PassiveWorkflowRule[] {
  const mappingCapability = capabilities.find((item) => item.key === 'google_user_mapping');
  const googleCapability = capabilities.find((item) => item.key === 'calendar');
  const systemTimestamp = new Date(0).toISOString();
  const status: PassiveWorkflowStatus =
    mappingCapability?.state === 'available' && googleCapability?.state === 'available'
      ? 'system'
      : 'blocked';

  return [{
    id: 'system:reuniones-auto',
    workflowId: 'reuniones',
    workflowName: getWorkflowDefinition('reuniones').name,
    name: 'Deteccion automatica de reuniones',
    description: 'Escanea Calendar, Gmail y Drive para detectar artifacts de reunion, y admite triggers externos via soflia://meeting-trigger para iniciar trazabilidad viva.',
    prompt: 'Deteccion automatica del sistema',
    scheduleLabel: 'Cada 20 minutos y por eventos de Google',
    cronExpression: null,
    source: 'system',
    status,
    executionMode: 'workflow',
    createdAt: systemTimestamp,
    updatedAt: systemTimestamp,
    lastRunAt: null,
    requestedBy: null,
    phoneNumber: null,
    config: { mode: 'auto' },
    reason: status === 'blocked'
      ? mappingCapability?.guidance || mappingCapability?.message || 'La auto-deteccion esta bloqueada.'
      : 'Activo en segundo plano.',
  }];
}
