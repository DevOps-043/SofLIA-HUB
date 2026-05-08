import { Badge } from './components';
import { formatDateTime } from './formatters';
import { CaseDetailPanel } from './CaseDetailPanel';
import type { WorkflowHubController } from './useWorkflowHubController';

type Props = { controller: WorkflowHubController };

export function WorkflowCasesSection({ controller }: Props) {
  const cases = controller.overview?.cases || [];
  const pendingCount = cases.filter((item) => item.normalizedStatus === 'pending_approval').length;
  return (
    <section className="px-6 pb-6 border-t border-gray-200 dark:border-white/[0.05] pt-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-bold text-gray-900 dark:text-white">Casos</p>
        {pendingCount > 0 && (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/20">
            {pendingCount} pendientes
          </span>
        )}
      </div>
      {cases.length === 0 ? <EmptyCases /> : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {cases.map((item) => (
              <button key={item.id} type="button" onClick={() => controller.setSelectedCaseId(controller.selectedCaseId === item.id ? null : item.id)}
                className={`w-full text-left rounded-xl border px-4 py-3 transition-all ${controller.selectedCaseId === item.id ? 'border-accent/30 bg-accent/8 shadow-md ring-1 ring-accent/10' : 'border-gray-200 dark:border-white/[0.06] hover:border-accent/20 bg-white dark:bg-white/[0.02]'}`}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[12px] font-semibold text-gray-900 dark:text-white line-clamp-2 flex-1">{item.title}</p>
                  <Badge value={item.normalizedStatus} />
                </div>
                <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1.5 truncate">{item.workflowName} - {formatDateTime(item.updatedAt)}</p>
              </button>
            ))}
          </div>
          {controller.selectedCaseDetail && <CaseDetailPanel detail={controller.selectedCaseDetail} controller={controller} />}
        </div>
      )}
    </section>
  );
}

function EmptyCases() {
  return (
    <div className="rounded-2xl border border-dashed border-gray-300 dark:border-white/[0.06] px-4 py-10 text-center text-xs text-gray-500 dark:text-gray-500">
      Sin casos aun. Ejecuta un workflow arriba para crear el primero.
    </div>
  );
}
