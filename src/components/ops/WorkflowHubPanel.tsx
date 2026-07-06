import { WorkflowHubPanelView } from './workflow-hub-panel/WorkflowHubPanelView';
import { WorkflowHubUnavailable } from './workflow-hub-panel/WorkflowHubUnavailable';
import type { WorkflowHubPanelProps } from './workflow-hub-panel/types';
import { useWorkflowHubController } from './workflow-hub-panel/useWorkflowHubController';

export function WorkflowHubPanel({ userId, organizationId }: WorkflowHubPanelProps) {
  const controller = useWorkflowHubController(userId, organizationId ?? undefined);
  if (!controller.hubAvailable) return <WorkflowHubUnavailable />;
  return <WorkflowHubPanelView controller={controller} />;
}
