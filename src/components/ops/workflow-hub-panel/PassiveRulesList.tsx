import type { WorkflowHubOverview } from '../../../services/workflow-hub-service';
import { Badge, EmptyState } from './components';
import { formatDateTime } from './formatters';

type PassiveRulesListProps = {
  passiveRules: WorkflowHubOverview['passiveRules'];
  actionKey: string | null;
  onDeleteRule: (rule: WorkflowHubOverview['passiveRules'][number]) => void;
};

export function PassiveRulesList({ passiveRules, actionKey, onDeleteRule }: PassiveRulesListProps) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm dark:shadow-none">
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="text-sm font-bold text-gray-900 dark:text-white">Rutinas guardadas</p>
        <span className="text-[10px] uppercase tracking-[0.16em] text-secondary">{passiveRules.length}</span>
      </div>
      <div className="space-y-2">
        {passiveRules.length === 0 && <EmptyState text="Sin workflows pasivos guardados" />}
        {passiveRules.map((rule) => (
          <div key={rule.id} className="rounded-xl border border-border bg-surface-2 px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-[12px] font-semibold text-gray-900 dark:text-white">{rule.name}</p>
                  <Badge value={rule.status} />
                </div>
                <p className="mt-1 text-[11px] text-secondary">{rule.description}</p>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-secondary">
                  <span>{rule.workflowName}</span>
                  <span>{rule.scheduleLabel}</span>
                  {rule.lastRunAt && <span>Ultima: {formatDateTime(rule.lastRunAt)}</span>}
                </div>
                {rule.reason && <p className="mt-2 text-[11px] text-amber-600 dark:text-amber-300">{rule.reason}</p>}
              </div>
              {rule.source !== 'system' && (
                <button
                  type="button"
                  className="rounded-xl border border-red-500/20 bg-red-500/8 hover:bg-red-500/12 text-red-600 dark:text-red-300 px-3 py-1.5 text-[11px] font-semibold transition disabled:opacity-40"
                  onClick={() => onDeleteRule(rule)}
                  disabled={actionKey === `delete-passive-${rule.id}`}
                >
                  {actionKey === `delete-passive-${rule.id}` ? 'Eliminando...' : 'Eliminar'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
