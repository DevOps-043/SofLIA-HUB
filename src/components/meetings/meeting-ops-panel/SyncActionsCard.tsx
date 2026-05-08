import { EmptyState, SectionTitle } from './base-components';
import { SyncActionItem } from './SyncActionItem';
import type { FormClassNames, MeetingOpsState, RunDetail } from './run-detail-types';

interface SyncActionsCardProps extends FormClassNames {
  detail: RunDetail;
  state: MeetingOpsState;
}

export function SyncActionsCard({ detail, inputClass, selectClass, state }: SyncActionsCardProps) {
  return (
    <div className="rounded-2xl bg-white dark:bg-[#1a1c20]/50 border border-gray-200 dark:border-white/10 p-5 shadow-sm dark:shadow-lg">
      <SectionTitle count={detail.sync_actions.length}>Acciones propuestas</SectionTitle>
      <div className="space-y-2">
        {detail.sync_actions.length === 0 && <EmptyState text="Sin acciones propuestas" />}
        {detail.sync_actions.map((action) => (
          <SyncActionItem key={action.id} action={action} inputClass={inputClass} selectClass={selectClass} state={state} />
        ))}
      </div>
    </div>
  );
}
