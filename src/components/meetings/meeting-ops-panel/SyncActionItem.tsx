import { SyncActionEditor } from './SyncActionEditor';
import type { FormClassNames, MeetingOpsState, RunDetail } from './run-detail-types';

interface SyncActionItemProps extends FormClassNames {
  action: RunDetail['sync_actions'][number];
  state: MeetingOpsState;
}

function getApprovalColor(approvalState: string): string {
  if (approvalState === 'approved') return 'text-emerald-600 dark:text-emerald-400';
  if (approvalState === 'rejected') return 'text-red-600 dark:text-red-400';
  return 'text-gray-500';
}

export function SyncActionItem({ action, inputClass, selectClass, state }: SyncActionItemProps) {
  const isExpanded = state.expandedAction === action.id;

  return (
    <div className="rounded-xl bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/[0.04] overflow-hidden">
      <button
        type="button"
        className="w-full text-left p-3 hover:bg-gray-100 dark:hover:bg-white/[0.01] transition"
        onClick={() => state.setExpandedAction(isExpanded ? null : action.id)}
      >
        <div className="text-[13px] text-gray-700 dark:text-gray-200 leading-snug">{action.summary}</div>
        <div className="mt-1.5 flex items-center gap-2 flex-wrap">
          <span className={`text-[10px] font-medium ${getApprovalColor(action.approval_state)}`}>{action.approval_state}</span>
          <span className="text-[10px] text-gray-300 dark:text-gray-600">|</span>
          <span className="text-[10px] text-gray-500 dark:text-gray-400">{action.sync_state}</span>
          {action.payload.owner_candidate && (
            <span className="text-[10px] bg-blue-500/10 text-blue-500 dark:text-blue-400 px-1.5 py-0.5 rounded">{action.payload.owner_candidate}</span>
          )}
        </div>
        {action.blocking_flags.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {action.blocking_flags.map((flag) => (
              <span key={flag} className="text-[9px] bg-amber-500/15 text-amber-600 dark:text-amber-400 px-1 py-0.5 rounded">{flag.replace(/_/g, ' ')}</span>
            ))}
          </div>
        )}
        {action.error_message && <div className="mt-1 text-[11px] text-red-500 dark:text-red-400">{action.error_message}</div>}
      </button>
      {isExpanded && <SyncActionEditor action={action} inputClass={inputClass} selectClass={selectClass} state={state} />}
    </div>
  );
}
