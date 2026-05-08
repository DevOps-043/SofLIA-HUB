import { approveWorkflowCase, rejectWorkflowCase, syncWorkflowCase } from '../../../services/workflow-hub-service';

export function WorkflowDecisionPanel({ detail, model }: { detail: any; model: any }) {
  const meetingDetail = detail.meetingDetail;
  const hasDraftActions = meetingDetail?.sync_actions.some((action: any) => action.approval_state === 'draft') || false;
  const hasApprovedActions = meetingDetail?.sync_actions.some((action: any) => action.approval_state === 'approved' && action.sync_state !== 'synced') || false;
  if (detail.normalizedStatus !== 'pending_approval' && !meetingDetail) return null;

  const decide = (scope: 'case' | 'summary' | 'actions', label: string, successNotice: string) => model.runAction(label, async () => {
    const result = await approveWorkflowCase({ caseId: detail.id, decidedBy: model.userId, scope, comment: model.decisionComment.trim() || null });
    if (!result.success || !result.detail) throw new Error(result.error || 'No pude aprobar el caso.');
    await model.refreshOverview(true, result.detail.id);
    model.setSelectedCaseDetail(result.detail);
    model.setNotice(successNotice);
  });
  const reject = (label: string) => model.runAction(label, async () => {
    const result = await rejectWorkflowCase({ caseId: detail.id, decidedBy: model.userId, scope: 'case', comment: model.decisionComment.trim() || null });
    if (!result.success || !result.detail) throw new Error(result.error || 'No pude rechazar el caso.');
    model.setDecisionComment('');
    await model.refreshOverview(true, result.detail.id);
    model.setSelectedCaseDetail(result.detail);
    model.setNotice(`Caso rechazado: ${result.detail.title}.`);
  });

  return (
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/8 p-4 space-y-3">
      <textarea className={model.textareaClass} value={model.decisionComment} onChange={(event) => model.setDecisionComment(event.target.value)} placeholder="Comentario opcional" />
      <div className="flex flex-wrap gap-2">
        {detail.engine === 'automation' && detail.normalizedStatus === 'pending_approval' && (
          <>
            <button type="button" className="rounded-xl bg-accent hover:bg-accent/90 text-white px-4 py-2 text-sm font-semibold transition disabled:opacity-40" onClick={() => void decide('case', 'approve-case', `Caso aprobado: ${detail.title}.`)} disabled={model.actionKey === 'approve-case'}>{model.actionKey === 'approve-case' ? 'Aprobando...' : 'Aprobar'}</button>
            <button type="button" className="rounded-xl border border-red-500/20 bg-red-500/8 hover:bg-red-500/12 text-red-600 dark:text-red-300 px-4 py-2 text-sm font-semibold transition disabled:opacity-40" onClick={() => void reject('reject-case')} disabled={model.actionKey === 'reject-case'}>{model.actionKey === 'reject-case' ? 'Rechazando...' : 'No aprobar'}</button>
          </>
        )}
        {meetingDetail && (
          <>
            <button type="button" className="rounded-xl bg-accent hover:bg-accent/90 text-white px-4 py-2 text-sm font-semibold transition disabled:opacity-40" onClick={() => void decide('summary', 'approve-summary', 'Resumen aprobado.')} disabled={model.actionKey === 'approve-summary'}>{model.actionKey === 'approve-summary' ? 'Aprobando...' : 'Aprobar resumen'}</button>
            {hasDraftActions && <button type="button" className="rounded-xl border border-accent/20 bg-accent/10 hover:bg-accent/15 text-accent px-4 py-2 text-sm font-semibold transition disabled:opacity-40" onClick={() => void decide('actions', 'approve-actions', 'Acciones aprobadas.')} disabled={model.actionKey === 'approve-actions'}>{model.actionKey === 'approve-actions' ? 'Aprobando...' : 'Aprobar acciones'}</button>}
            {hasApprovedActions && <button type="button" className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 hover:bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 px-4 py-2 text-sm font-semibold transition disabled:opacity-40" onClick={() => void model.runAction('sync-actions', async () => { const result = await syncWorkflowCase({ caseId: detail.id, decidedBy: model.userId }); if (!result.success || !result.detail) throw new Error(result.error || 'No pude sincronizar.'); await model.refreshOverview(true, result.detail.id); model.setSelectedCaseDetail(result.detail); model.setNotice('Sincronizacion completada.'); })} disabled={model.actionKey === 'sync-actions'}>{model.actionKey === 'sync-actions' ? 'Sincronizando...' : 'Sincronizar'}</button>}
          </>
        )}
      </div>
    </div>
  );
}
