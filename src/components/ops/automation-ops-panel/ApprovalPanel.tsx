import { approveAutomationRun, rejectAutomationRun } from '../../../services/automation-service';
import { textareaClass } from './styles';
import type { AutomationOpsController } from './useAutomationOpsController';

export function ApprovalPanel({ controller }: { controller: AutomationOpsController }) {
  const selectedRun = controller.data.selectedRun;
  if (!selectedRun || selectedRun.status !== 'needs_approval') return null;

  return (
    <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/8 p-4 space-y-3">
      <p className="text-xs text-amber-700 dark:text-amber-200">Este caso espera tu autorizacion antes de ejecutar acciones.</p>
      <textarea className={textareaClass} value={controller.runner.comment} onChange={(event) => controller.runner.setComment(event.target.value)} placeholder="Comentario opcional" />
      <div className="flex gap-2">
        <button type="button" className="flex-1 rounded-xl bg-accent hover:bg-accent/90 text-white py-2.5 text-sm font-semibold transition disabled:opacity-40" onClick={() => void controller.runner.runAction('approve-workflow', async () => {
          const result = await approveAutomationRun({ runId: selectedRun.id, decidedBy: controller.userId, comment: controller.runner.comment.trim() || null });
          if (!result.success || !result.run) throw new Error(result.error || 'No pude autorizar.');
          await controller.data.refreshOverview(true);
          controller.runner.setComment('');
          controller.runner.setNotice(`Autorizado: ${result.run.title}.`);
        })} disabled={controller.runner.actionKey === 'approve-workflow'}>{controller.runner.actionKey === 'approve-workflow' ? 'Autorizando...' : 'Autorizar'}</button>
        <button type="button" className="flex-1 rounded-xl border border-red-500/20 bg-red-500/8 hover:bg-red-500/12 text-red-600 dark:text-red-300 py-2.5 text-sm font-semibold transition disabled:opacity-40" onClick={() => void controller.runner.runAction('reject-workflow', async () => {
          const result = await rejectAutomationRun({ runId: selectedRun.id, decidedBy: controller.userId, comment: controller.runner.comment.trim() || null });
          if (!result.success || !result.run) throw new Error(result.error || 'No pude detener.');
          await controller.data.refreshOverview(true);
          controller.runner.setComment('');
          controller.runner.setNotice(`Detenido: ${result.run.title}.`);
        })} disabled={controller.runner.actionKey === 'reject-workflow'}>{controller.runner.actionKey === 'reject-workflow' ? 'Deteniendo...' : 'No autorizar'}</button>
      </div>
    </div>
  );
}
