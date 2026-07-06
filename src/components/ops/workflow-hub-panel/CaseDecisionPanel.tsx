import { approveWorkflowCase, rejectWorkflowCase, syncWorkflowCase, type WorkflowCaseDetail } from '../../../services/workflow-hub-service';
import type { WorkflowHubController } from './useWorkflowHubController';

export function CaseDecisionPanel({ controller, detail }: { controller: WorkflowHubController; detail: WorkflowCaseDetail }) {
  const meetingDetail = detail.meetingDetail;
  const hasDraftActions = meetingDetail?.sync_actions.some((action) => action.approval_state === 'draft') || false;
  const hasApprovedActions = meetingDetail?.sync_actions.some((action) => action.approval_state === 'approved' && action.sync_state !== 'synced') || false;
  return (
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/8 p-4 space-y-3">
      <textarea className={controller.textareaClass} value={controller.decisionComment} onChange={(event) => controller.setDecisionComment(event.target.value)} placeholder="Comentario opcional" />
      <div className="flex flex-wrap gap-2">
        {detail.engine === 'automation' && detail.normalizedStatus === 'pending_approval' && <AutomationDecisionButtons controller={controller} detail={detail} />}
        {meetingDetail && (
          <>
            <DecisionButton label="Aprobar resumen" busyLabel="Aprobando..." actionKey="approve-summary" controller={controller} onClick={async () => {
              const result = await approveWorkflowCase({ caseId: detail.id, decidedBy: controller.userId, scope: 'summary', comment: controller.decisionComment.trim() || null });
              if (!result.success || !result.detail) throw new Error(result.error || 'No pude aprobar el resumen.');
              await controller.refreshOverview(true, result.detail.id); controller.setSelectedCaseDetail(result.detail); controller.setNotice('Resumen aprobado.');
            }} />
            {hasDraftActions && <DecisionButton label="Aprobar acciones" busyLabel="Aprobando..." actionKey="approve-actions" controller={controller} variant="soft" onClick={async () => {
              const result = await approveWorkflowCase({ caseId: detail.id, decidedBy: controller.userId, scope: 'actions', comment: controller.decisionComment.trim() || null });
              if (!result.success || !result.detail) throw new Error(result.error || 'No pude aprobar las acciones.');
              await controller.refreshOverview(true, result.detail.id); controller.setSelectedCaseDetail(result.detail); controller.setNotice('Acciones aprobadas.');
            }} />}
            {hasApprovedActions && <DecisionButton label="Sincronizar" busyLabel="Sincronizando..." actionKey="sync-actions" controller={controller} variant="success" onClick={async () => {
              const result = await syncWorkflowCase({ caseId: detail.id, decidedBy: controller.userId });
              if (!result.success || !result.detail) throw new Error(result.error || 'No pude sincronizar.');
              await controller.refreshOverview(true, result.detail.id); controller.setSelectedCaseDetail(result.detail); controller.setNotice('Sincronizacion completada.');
            }} />}
          </>
        )}
      </div>
    </div>
  );
}

function AutomationDecisionButtons({ controller, detail }: { controller: WorkflowHubController; detail: WorkflowCaseDetail }) {
  return (
    <>
      <DecisionButton label="Aprobar" busyLabel="Aprobando..." actionKey="approve-case" controller={controller} onClick={async () => {
        const result = await approveWorkflowCase({ caseId: detail.id, decidedBy: controller.userId, scope: 'case', comment: controller.decisionComment.trim() || null });
        if (!result.success || !result.detail) throw new Error(result.error || 'No pude aprobar el caso.');
        controller.setDecisionComment(''); await controller.refreshOverview(true, result.detail.id); controller.setSelectedCaseDetail(result.detail); controller.setNotice(`Caso aprobado: ${result.detail.title}.`);
      }} />
      <DecisionButton label="No aprobar" busyLabel="Rechazando..." actionKey="reject-case" controller={controller} variant="danger" onClick={async () => {
        const result = await rejectWorkflowCase({ caseId: detail.id, decidedBy: controller.userId, scope: 'case', comment: controller.decisionComment.trim() || null });
        if (!result.success || !result.detail) throw new Error(result.error || 'No pude rechazar el caso.');
        controller.setDecisionComment(''); await controller.refreshOverview(true, result.detail.id); controller.setSelectedCaseDetail(result.detail); controller.setNotice(`Caso rechazado: ${result.detail.title}.`);
      }} />
    </>
  );
}

function DecisionButton(props: { label: string; busyLabel: string; actionKey: string; controller: WorkflowHubController; onClick: () => Promise<void>; variant?: 'soft' | 'success' | 'danger' }) {
  const classes = props.variant === 'danger'
    ? 'border border-red-500/20 bg-red-500/8 hover:bg-red-500/12 text-red-600 dark:text-red-300'
    : props.variant === 'success'
      ? 'border border-emerald-500/20 bg-emerald-500/10 hover:bg-emerald-500/15 text-emerald-600 dark:text-emerald-300'
      : props.variant === 'soft' ? 'border border-accent/20 bg-accent/10 hover:bg-accent/15 text-accent' : 'bg-accent hover:brightness-105 text-on-accent';
  return <button type="button" className={`rounded-xl px-4 py-2 text-sm font-semibold transition disabled:opacity-40 ${classes}`} onClick={() => void props.controller.runAction(props.actionKey, props.onClick)} disabled={props.controller.actionKey === props.actionKey}>{props.controller.actionKey === props.actionKey ? props.busyLabel : props.label}</button>;
}
