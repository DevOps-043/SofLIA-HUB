import { approveWorkflowCase, rejectWorkflowCase, updateWorkflowCaseAction, type WorkflowCaseDetail } from '../../../services/workflow-hub-service';
import { Badge } from './components';
import type { WorkflowHubController } from './useWorkflowHubController';

export function SyncActionRow({ action, controller, detail }: { action: any; controller: WorkflowHubController; detail: WorkflowCaseDetail }) {
  const draft = controller.actionDrafts[action.id] || {
    title: action.payload.title || action.summary || '',
    dueDate: action.payload.due_date || '',
    teamId: action.payload.team_id || '',
    projectId: action.payload.project_id || '',
    assigneeId: action.payload.assignee_id || '',
  };
  const updateDraft = (updates: Partial<typeof draft>) => controller.setActionDrafts((current) => ({ ...current, [action.id]: { ...draft, ...updates } }));
  return (
    <div className="rounded-xl bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/[0.04] p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-[13px] text-gray-700 dark:text-gray-200 leading-snug">{action.summary}</div>
          <div className="mt-1 text-[10px] text-gray-500 dark:text-gray-400">{action.action_type} · {action.approval_state} · {action.sync_state}</div>
        </div>
        <Badge value={action.error_message ? 'failed' : action.sync_state === 'synced' ? 'executed' : action.approval_state === 'approved' ? 'approved' : action.approval_state === 'rejected' ? 'skipped' : 'pending'} />
      </div>
      <input className={controller.inputClass} value={draft.title} onChange={(event) => updateDraft({ title: event.target.value })} placeholder="Titulo" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <select className={controller.inputClass} value={draft.teamId} onChange={(event) => updateDraft({ teamId: event.target.value, projectId: '', assigneeId: '' })}>
          <option value="">Sin team</option>
          {controller.teams.map((team) => <option key={team.team_id} value={team.team_id}>{team.name}</option>)}
        </select>
        <select className={controller.inputClass} value={draft.projectId} onChange={(event) => updateDraft({ projectId: event.target.value })}>
          <option value="">Sin proyecto</option>
          {controller.getProjectsForTeam(draft.teamId).map((project) => <option key={project.project_id} value={project.project_id}>{project.project_name}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <select className={controller.inputClass} value={draft.assigneeId} onChange={(event) => updateDraft({ assigneeId: event.target.value })}>
          <option value="">Sin responsable</option>
          {controller.getMembersForTeam(draft.teamId).map((member) => <option key={member.membership_id} value={member.user_id}>{member.display_name || member.username || member.email || member.user_id}</option>)}
        </select>
        <input type="date" className={controller.inputClass} value={draft.dueDate} onChange={(event) => updateDraft({ dueDate: event.target.value })} />
      </div>
      <SyncActionButtons action={action} controller={controller} detail={detail} draft={draft} />
    </div>
  );
}

function SyncActionButtons({ action, controller, detail, draft }: { action: any; controller: WorkflowHubController; detail: WorkflowCaseDetail; draft: any }) {
  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" className="rounded-xl border border-gray-200 dark:border-white/[0.06] py-1.5 px-3 text-[11px] text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition"
        onClick={() => void controller.runAction(`save-action-${action.id}`, async () => {
          const result = await updateWorkflowCaseAction({ caseId: detail.id, actionId: action.id, updates: { title: draft.title, due_date: draft.dueDate || null, team_id: draft.teamId || null, project_id: draft.projectId || null, assignee_id: draft.assigneeId || null } });
          if (!result.success || !result.detail) throw new Error(result.error || 'No pude guardar la accion.');
          await controller.refreshOverview(true, result.detail.id); controller.setSelectedCaseDetail(result.detail); controller.setNotice('Accion actualizada.');
        })}>{controller.actionKey === `save-action-${action.id}` ? 'Guardando...' : 'Guardar'}</button>
      {action.approval_state !== 'approved' && action.approval_state !== 'rejected' && <button type="button" className="rounded-xl border border-accent/20 bg-accent/10 hover:bg-accent/15 text-accent py-1.5 px-3 text-[11px] font-semibold transition" onClick={() => void controller.runAction(`approve-single-${action.id}`, async () => {
        const result = await approveWorkflowCase({ caseId: detail.id, decidedBy: controller.userId, scope: 'action', actionId: action.id, comment: controller.decisionComment.trim() || null });
        if (!result.success || !result.detail) throw new Error(result.error || 'No pude aprobar la accion.');
        await controller.refreshOverview(true, result.detail.id); controller.setSelectedCaseDetail(result.detail); controller.setNotice('Accion aprobada.');
      })}>{controller.actionKey === `approve-single-${action.id}` ? 'Aprobando...' : 'Aprobar'}</button>}
      {action.approval_state !== 'rejected' && <button type="button" className="rounded-xl border border-red-500/20 bg-red-500/8 hover:bg-red-500/12 text-red-600 dark:text-red-300 py-1.5 px-3 text-[11px] font-semibold transition" onClick={() => void controller.runAction(`reject-single-${action.id}`, async () => {
        const result = await rejectWorkflowCase({ caseId: detail.id, decidedBy: controller.userId, scope: 'action', actionId: action.id, comment: controller.decisionComment.trim() || null });
        if (!result.success || !result.detail) throw new Error(result.error || 'No pude rechazar la accion.');
        await controller.refreshOverview(true, result.detail.id); controller.setSelectedCaseDetail(result.detail); controller.setNotice('Accion rechazada.');
      })}>{controller.actionKey === `reject-single-${action.id}` ? 'Rechazando...' : 'Rechazar'}</button>}
    </div>
  );
}
