import type { FormClassNames, MeetingOpsState, RunDetail } from './run-detail-types';
import { projectHubApi } from '../../../services/project-hub-api';

interface SyncActionEditorProps extends FormClassNames {
  action: RunDetail['sync_actions'][number];
  state: MeetingOpsState;
}

export function SyncActionEditor({ action, inputClass, selectClass, state }: SyncActionEditorProps) {
  const draft = state.actionDrafts[action.id] || {};

  const createProject = async () => {
    const status = await projectHubApi.status();
    const workspace = status.data?.workspaces[0];
    if (!status.success || !workspace) return state.setError(status.error || 'No hay workspace de Project Hub.');
    const suggested = state.currentAnalysis?.detectedContext.project || '';
    const name = window.prompt('Nombre del proyecto nuevo', suggested)?.trim();
    if (!name) return;
    const result = await projectHubApi.createProject(workspace.id, { name, team_id: draft.teamId || undefined, priority: 'medium', tags: [] });
    if (!result.success || !result.data) return state.setError(result.error || 'No se pudo crear el proyecto.');
    await state.loadInitialData();
    state.updateActionDraft(action.id, { projectId: result.data.project_id });
    state.setNotice(`Proyecto “${result.data.project_name}” creado. Guarda y aprueba la acción para anexar la reunión.`);
  };

  return (
    <div className="px-3 pb-3 space-y-2 border-t border-gray-100 dark:border-white/[0.04] pt-3">
      <input className={inputClass} value={draft.title || ''} onChange={(event) => state.updateActionDraft(action.id, { title: event.target.value })} placeholder="Titulo" />
      <div className="grid grid-cols-2 gap-2">
        <select className={selectClass} value={draft.teamId || ''} onChange={(event) => state.updateActionDraft(action.id, { teamId: event.target.value, projectId: '', assigneeId: '' })}>
          <option value="">Sin team</option>
          {state.teams.map((team) => <option key={team.team_id} value={team.team_id}>{team.name}</option>)}
        </select>
        <select className={selectClass} value={draft.projectId || ''} onChange={(event) => state.updateActionDraft(action.id, { projectId: event.target.value })}>
          <option value="">Sin proyecto</option>
          {state.getProjectsForTeam(draft.teamId || '').map((project) => (
            <option key={project.project_id} value={project.project_id}>{project.project_name}</option>
          ))}
        </select>
      </div>
      <button type="button" onClick={() => void createProject()} className="w-full rounded-lg border border-dashed border-accent/40 py-1.5 text-[11px] font-medium text-accent hover:bg-accent/[0.06]">Crear proyecto para esta reunión</button>
      {action.action_type === 'create_task' && (
        <input className={inputClass} value={draft.existingIssueId || ''} onChange={(event) => state.updateActionDraft(action.id, { existingIssueId: event.target.value })} placeholder="UUID de tarea existente para vincular (opcional)" />
      )}
      <select className={selectClass} value={draft.assigneeId || ''} onChange={(event) => state.updateActionDraft(action.id, { assigneeId: event.target.value })}>
        <option value="">Sin responsable</option>
        {state.getMembersForTeam(draft.teamId || '').map((member) => (
          <option key={member.membership_id} value={member.user_id}>{member.display_name || member.username || member.email || member.user_id}</option>
        ))}
      </select>
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
