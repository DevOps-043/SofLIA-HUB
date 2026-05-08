import { buildCustomAction } from './custom-action-builders';
import type {
  WorkflowActionKind,
  WorkflowActionRecord,
  WorkflowTemplateDefinition,
} from '../types';

export function buildCustomWorkflowActions(
  generatedActions: Array<{
    kind: WorkflowActionKind;
    title: string;
    payload: Record<string, any>;
  }>,
  template: WorkflowTemplateDefinition,
): WorkflowActionRecord[] {
  const allowedCapabilities = new Set<WorkflowActionKind>(
    Array.isArray(template.capabilities) && template.capabilities.length > 0
      ? template.capabilities
      : ['desktop_task'],
  );

  return (Array.isArray(generatedActions) ? generatedActions : []).reduce<WorkflowActionRecord[]>((acc, action) => {
    if (!allowedCapabilities.has(action.kind)) return acc;
    const builtAction = buildCustomAction(action);
    if (builtAction) acc.push(builtAction);
    return acc;
  }, []);
}
