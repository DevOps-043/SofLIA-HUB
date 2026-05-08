import { parsePassiveWorkflowIntent } from './passive-workflows/intent';
import type { PassiveWorkflowRequestContext } from './passive-workflows/types';

export { detectPassiveWorkflowId, parsePassiveWorkflowIntent } from './passive-workflows/intent';
export { extractClockTime } from './passive-workflows/clock-time';
export { extractPassiveSchedule } from './passive-workflows/schedule';
export { normalizeForIntent } from './passive-workflows/normalize';
export type {
  PassiveWorkflowId,
  PassiveWorkflowIntent,
  PassiveWorkflowRequestContext,
} from './passive-workflows/types';

export function tryHandlePassiveWorkflowRequest({
  workflowHubService,
  senderNumber,
  text,
  isGroup,
}: PassiveWorkflowRequestContext): string | null {
  if (isGroup || !workflowHubService) return null;

  const intent = parsePassiveWorkflowIntent(text);
  if (!intent) return null;

  const rule = workflowHubService.savePassiveRule({
    workflowId: intent.workflowId,
    name: intent.name,
    description: intent.description,
    prompt: intent.prompt,
    cronExpression: intent.cronExpression,
    scheduleLabel: intent.scheduleLabel,
    requestedBy: `whatsapp:${senderNumber}`,
    phoneNumber: senderNumber,
    source: 'chat',
    executionMode: 'agent_prompt',
  });

  return [
    `Listo. Lo guarde como workflow pasivo: *${rule.name}*`,
    `Cuando: ${rule.scheduleLabel}`,
    rule.workflowId ? `Tipo: ${rule.workflowName}` : 'Tipo: Rutina libre recordada',
    'No necesitas volver a pedirlo con comandos; lo voy a ejecutar solo.',
  ].join('\n');
}
