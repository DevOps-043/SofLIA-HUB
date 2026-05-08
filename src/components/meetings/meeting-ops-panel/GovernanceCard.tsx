import type { CurrentAnalysis } from './run-detail-types';

interface GovernanceCardProps {
  analysis: CurrentAnalysis;
}

export function GovernanceCard({ analysis }: GovernanceCardProps) {
  return (
    <div className="rounded-2xl bg-white dark:bg-[#1a1c20]/50 border border-gray-200 dark:border-white/10 p-5 shadow-sm dark:shadow-lg">
      <div className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">Gobernanza</div>
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-gray-500 dark:text-gray-400">Nivel de autonomia</span>
          <div className="flex gap-0.5">
            {[0, 1, 2, 3, 4].map((level) => (
              <div key={level} className={`w-5 h-1.5 rounded-sm ${level <= analysis.governance.autonomyLevelApplied ? 'bg-accent' : 'bg-gray-200 dark:bg-white/[0.06]'}`} />
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-gray-500 dark:text-gray-400">Aprobacion humana</span>
          <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${analysis.governance.requiresHumanApproval ? 'bg-amber-500/15 text-amber-400' : 'bg-emerald-500/15 text-emerald-400'}`}>
            {analysis.governance.requiresHumanApproval ? 'Requerida' : 'No requerida'}
          </span>
        </div>
        {analysis.governance.sensitiveActionsBlocked.length > 0 && (
          <div>
            <div className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1.5">Acciones bloqueadas</div>
            <div className="space-y-1">
              {analysis.governance.sensitiveActionsBlocked.slice(0, 3).map((action, index) => (
                <div key={index} className="flex items-start gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
                  <span className="mt-1 w-1 h-1 rounded-full bg-red-500/60 shrink-0" />
                  {action}
                </div>
              ))}
              {analysis.governance.sensitiveActionsBlocked.length > 3 && (
                <span className="text-[10px] text-gray-400 dark:text-gray-500">+{analysis.governance.sensitiveActionsBlocked.length - 3} mas</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
