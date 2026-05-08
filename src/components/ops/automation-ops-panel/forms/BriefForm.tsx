import { executeAutomationTemplate } from '../../../../services/automation-service';
import { inputClass } from '../styles';
import { SpaceSelect } from '../SpaceSelect';
import type { AutomationOpsController } from '../useAutomationOpsController';

export function BriefForm({ controller }: { controller: AutomationOpsController }) {
  const brief = controller.forms.brief;

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-bold text-gray-900 dark:text-white">Resumen de agenda</p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Resume el dia, detecta riesgos y prepara una nota breve.</p>
      </div>
      <input className={inputClass} type="date" value={brief.date} onChange={(event) => brief.setDate(event.target.value)} />
      <details className="rounded-xl border border-gray-200 dark:border-white/[0.06] bg-gray-50 dark:bg-white/[0.02] px-3 py-2">
        <summary className="cursor-pointer list-none text-xs font-medium text-gray-700 dark:text-gray-300">Compartir por Google Chat</summary>
        <div className="mt-3">
          <SpaceSelect spaces={controller.data.spaces} value={brief.chatSpace} onChange={brief.setChatSpace} emptyLabel="Sin Google Chat" />
        </div>
      </details>
      <button
        type="button"
        className="w-full rounded-xl border border-accent/20 bg-accent/10 hover:bg-accent/15 text-accent py-2.5 text-sm font-semibold transition disabled:opacity-40"
        onClick={() => void controller.runner.runAction('run-brief', async () => {
          const result = await executeAutomationTemplate({ templateId: 'calendar_daily_brief', requestedBy: `app:${controller.userId}`, input: { targetDate: brief.date || undefined, gchatSpace: brief.chatSpace || undefined } });
          if (!result.success || !result.run) throw new Error(result.error || 'No pude preparar la agenda.');
          await controller.data.refreshOverview(false);
          controller.data.setSelectedRunId(result.run.id);
          controller.runner.setNotice(`Caso creado: ${result.run.title}.`);
        })}
        disabled={controller.runner.actionKey === 'run-brief'}
      >
        {controller.runner.actionKey === 'run-brief' ? 'Preparando...' : 'Preparar mi agenda'}
      </button>
    </div>
  );
}
