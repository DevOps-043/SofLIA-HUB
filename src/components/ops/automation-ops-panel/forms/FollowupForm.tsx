import { executeAutomationTemplate } from '../../../../services/automation-service';
import { inputClass, textareaClass } from '../styles';
import type { AutomationOpsController } from '../useAutomationOpsController';

export function FollowupForm({ controller }: { controller: AutomationOpsController }) {
  const followup = controller.forms.followup;

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-bold text-gray-900 dark:text-white">Correo de seguimiento</p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Redacta un seguimiento profesional listo para autorizacion.</p>
      </div>
      <input className={inputClass} value={followup.to} onChange={(event) => followup.setTo(event.target.value)} placeholder="correo@empresa.com" />
      <input className={inputClass} value={followup.topic} onChange={(event) => followup.setTopic(event.target.value)} placeholder="Tema o motivo" />
      <details className="rounded-xl border border-gray-200 dark:border-white/[0.06] bg-gray-50 dark:bg-white/[0.02] px-3 py-2">
        <summary className="cursor-pointer list-none text-xs font-medium text-gray-700 dark:text-gray-300">Contexto adicional</summary>
        <div className="mt-3">
          <textarea className={textareaClass} value={followup.context} onChange={(event) => followup.setContext(event.target.value)} placeholder="Ya hubo una llamada, falta confirmar propuesta..." />
        </div>
      </details>
      <button
        type="button"
        className="w-full rounded-xl border border-accent/20 bg-accent/10 hover:bg-accent/15 text-accent py-2.5 text-sm font-semibold transition disabled:opacity-40"
        onClick={() => void controller.runner.runAction('run-followup', async () => {
          const result = await executeAutomationTemplate({ templateId: 'gmail_followup_draft', requestedBy: `app:${controller.userId}`, input: { to: followup.to.trim(), topic: followup.topic.trim(), context: followup.context.trim() || undefined } });
          if (!result.success || !result.run) throw new Error(result.error || 'No pude preparar el seguimiento.');
          await controller.data.refreshOverview(false);
          controller.data.setSelectedRunId(result.run.id);
          controller.runner.setNotice(`Caso creado: ${result.run.title}.`);
        })}
        disabled={controller.runner.actionKey === 'run-followup' || !followup.to.trim() || !followup.topic.trim()}
      >
        {controller.runner.actionKey === 'run-followup' ? 'Preparando...' : 'Preparar seguimiento'}
      </button>
    </div>
  );
}
