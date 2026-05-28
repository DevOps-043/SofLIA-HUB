import { describeCron, requireNonEmptyString } from './normalizers';
import { mapScheduledTaskToPassiveRule } from './passive-rule-mappers';
import type { PassiveWorkflowRule, SavePassiveWorkflowRuleInput } from './types';
import type { WorkflowHubServiceContext } from './service-context';
import { resolvePassivePrompt } from './passive-prompt';
import { sanitizeWorkflowConfig } from './workflow-config';

export function savePassiveRule(
  ctx: WorkflowHubServiceContext,
  input: SavePassiveWorkflowRuleInput,
): PassiveWorkflowRule {
  const workflow = input.workflowId ? ctx.getWorkflowDefinition(input.workflowId) : null;
  if (workflow?.passiveBehavior === 'system') {
    throw new Error('Ese workflow pasivo ya corre automaticamente en segundo plano y no necesita programacion manual.');
  }

  const name = String(input.name || '').trim();
  if (!name) throw new Error('Necesito un nombre para guardar el workflow pasivo.');
  const cronExpression = requireNonEmptyString(
    input.cronExpression,
    'Necesito una programacion valida para guardar el workflow pasivo.',
  );
  const config = workflow ? sanitizeWorkflowConfig(workflow.id, input.config || {}) : {};
  const prompt = resolvePassivePrompt({
    workflowId: workflow?.id || null,
    prompt: input.prompt || null,
    config,
  });
  const executionMode = input.executionMode
    || (input.phoneNumber ? 'agent_prompt' : workflow ? 'workflow' : 'agent_prompt');

  const task = ctx.deps.taskScheduler.upsertTask({
    id: input.ruleId || undefined,
    cronExpression,
    prompt,
    phoneNumber: String(input.phoneNumber || '').trim(),
    name,
    description: String(input.description || '').trim(),
    scheduleLabel: String(input.scheduleLabel || '').trim() || describeCron(cronExpression),
    runOnce: input.runOnce === true,
    scheduledFor: input.scheduledFor || null,
    source: input.source === 'chat' || input.source === 'app' ? input.source : 'app',
    kind: workflow ? 'passive_workflow' : 'passive_prompt',
    executionMode,
    workflowId: workflow?.id || null,
    workflowInput: workflow && executionMode === 'workflow' ? config : {},
    requestedBy: input.requestedBy || null,
    passiveRuleId: input.ruleId || undefined,
  });

  return mapScheduledTaskToPassiveRule(task, ctx.getWorkflowDefinition.bind(ctx));
}

export function deletePassiveRule(ctx: WorkflowHubServiceContext, ruleId: string): boolean {
  return ctx.deps.taskScheduler.deleteTask(String(ruleId || '').trim());
}
