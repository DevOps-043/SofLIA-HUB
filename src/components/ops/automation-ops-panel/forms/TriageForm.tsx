import { executeAutomationTemplate } from '../../../../services/automation-service';
import { TRIAGE_PRESETS } from '../constants';
import { inputClass } from '../styles';
import { SpaceSelect } from '../SpaceSelect';
import type { AutomationOpsController } from '../useAutomationOpsController';

export function TriageForm({ controller }: { controller: AutomationOpsController }) {
  const triage = controller.forms.triage;

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-bold text-gray-900 dark:text-white">Ayuda con correos</p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Revisa un correo importante y sugiere la mejor accion.</p>
      </div>
      <select className={inputClass} value={triage.preset} onChange={(event) => triage.setPreset(event.target.value as typeof triage.preset)}>
        {TRIAGE_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
      </select>
      <p className="text-[11px] text-gray-500 dark:text-gray-400">{TRIAGE_PRESETS.find((preset) => preset.id === triage.preset)?.description}</p>
      <details className="rounded-xl border border-gray-200 dark:border-white/[0.06] bg-gray-50 dark:bg-white/[0.02] px-3 py-2">
        <summary className="cursor-pointer list-none text-xs font-medium text-gray-700 dark:text-gray-300">Opciones avanzadas</summary>
        <div className="mt-3 space-y-2">
          {triage.preset === 'custom' ? (
            <input className={inputClass} value={triage.query} onChange={(event) => triage.setQuery(event.target.value)} placeholder="from:cliente@empresa.com newer_than:7d" />
          ) : (
            <div className="rounded-lg border border-dashed border-gray-200 dark:border-white/[0.06] px-3 py-2 text-xs text-gray-500">Filtro: {triage.effectiveQuery}</div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <input className={inputClass} type="number" min={1} max={10} value={triage.maxResults} onChange={(event) => triage.setMaxResults(Math.max(1, Math.min(10, Number(event.target.value) || 1)))} />
            <SpaceSelect spaces={controller.data.spaces} value={triage.chatSpace} onChange={triage.setChatSpace} emptyLabel="Sin Google Chat" />
          </div>
        </div>
      </details>
      <button
        type="button"
        className="w-full rounded-xl bg-accent hover:bg-accent/90 text-white py-2.5 text-sm font-semibold transition disabled:opacity-40"
        onClick={() => void controller.runner.runAction('run-triage', async () => {
          const result = await executeAutomationTemplate({ templateId: 'gmail_triage', requestedBy: `app:${controller.userId}`, input: { query: triage.effectiveQuery, maxResults: triage.maxResults, gchatSpace: triage.chatSpace || undefined, removeFromInbox: true } });
          if (!result.success || !result.run) throw new Error(result.error || 'No pude revisar el correo.');
          await controller.data.refreshOverview(false);
          controller.data.setSelectedRunId(result.run.id);
          controller.runner.setNotice(`Caso creado: ${result.run.title}.`);
        })}
        disabled={controller.runner.actionKey === 'run-triage'}
      >
        {controller.runner.actionKey === 'run-triage' ? 'Preparando...' : 'Revisar correo importante'}
      </button>
    </div>
  );
}
