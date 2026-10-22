import type { FormClassNames, MeetingOpsState, RunDetail } from './run-detail-types';

interface SyncActionEditorProps extends FormClassNames {
  action: RunDetail['sync_actions'][number];
  state: MeetingOpsState;
}

export function SyncActionEditor({ action, inputClass, state }: SyncActionEditorProps) {
  const draft = state.actionDrafts[action.id] || {};

  return (
    <div className="px-3 pb-3 space-y-2 border-t border-gray-100 dark:border-white/[0.04] pt-3">
      <input className={inputClass} value={draft.title || ''} onChange={(event) => state.updateActionDraft(action.id, { title: event.target.value })} placeholder="Titulo" />
      <input type="date" className={inputClass} value={draft.dueDate || ''} onChange={(event) => state.updateActionDraft(action.id, { dueDate: event.target.value })} />
      <div className="flex gap-1.5 pt-1">
        <button type="button" className="flex-1 rounded-xl border border-gray-200 dark:border-white/[0.06] py-1.5 text-[11px] text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition" onClick={() => void state.handleSaveAction(action.id)}>Guardar</button>
        <button type="button" className="flex-1 rounded-xl border border-emerald-500/20 py-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/[0.06] transition" onClick={() => void state.handleApproveSingleAction(action.id)}>Aprobar</button>
        {action.approval_state !== 'rejected' && (
          <button type="button" className="rounded-xl border border-red-500/20 py-1.5 px-3 text-[11px] text-red-600 dark:text-red-400 hover:bg-red-500/[0.06] transition" onClick={() => void state.handleRejectAction(action.id)}>Rechazar</button>
        )}
      </div>
    </div>
  );
}
