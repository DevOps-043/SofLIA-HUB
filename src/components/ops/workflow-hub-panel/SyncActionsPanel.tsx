import type { WorkflowCaseDetail } from '../../../services/workflow-hub-service';
import { EmptyState } from './components';
import { SyncActionRow } from './SyncActionRow';
import type { WorkflowHubController } from './useWorkflowHubController';

export function SyncActionsPanel({ controller, detail }: { controller: WorkflowHubController; detail: WorkflowCaseDetail }) {
  const actions = detail.meetingDetail?.sync_actions || [];
  return (
    <div className="rounded-2xl bg-white dark:bg-[#1a1c20]/50 border border-gray-200 dark:border-white/10 p-5 shadow-sm dark:shadow-lg">
      <p className="text-sm font-bold text-gray-900 dark:text-white mb-3">Acciones propuestas</p>
      <div className="space-y-3">
        {actions.length === 0 && <EmptyState text="Sin acciones propuestas" />}
        {actions.map((action) => <SyncActionRow key={action.id} action={action} controller={controller} detail={detail} />)}
      </div>
    </div>
  );
}
