import { WorkflowHubPanelView } from './workflow-hub-panel/WorkflowHubPanelView';
import { WorkflowHubUnavailable } from './workflow-hub-panel/WorkflowHubUnavailable';
import type { WorkflowHubPanelProps } from './workflow-hub-panel/types';
import { useWorkflowHubController } from './workflow-hub-panel/useWorkflowHubController';

export function WorkflowHubPanel({ userId }: WorkflowHubPanelProps) {
  const controller = useWorkflowHubController(userId);
  if (!controller.hubAvailable) return <WorkflowHubUnavailable />;
  return <WorkflowHubPanelView controller={controller} />;
}
