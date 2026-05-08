import { RemoteNodesPanel } from './RemoteNodesPanel';
import { RemoteScreenshot } from './RemoteScreenshot';
import { RunCardsGrid } from './RunCardsGrid';
import { RunDetail } from './RunDetail';
import type { AutomationOpsController } from './useAutomationOpsController';

export function CasesSection({ controller }: { controller: AutomationOpsController }) {
  return (
    <section className="px-6 pb-6 border-t border-gray-200 dark:border-white/[0.05] pt-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-bold text-gray-900 dark:text-white">Casos</p>
        {controller.data.pendingRuns.length > 0 && (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/20">
            {controller.data.pendingRuns.length} pendiente{controller.data.pendingRuns.length > 1 ? 's' : ''}
          </span>
        )}
      </div>
      {controller.data.runs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 dark:border-white/[0.06] px-4 py-10 text-center text-xs text-gray-500 dark:text-gray-500">
          Sin casos aun. Ejecuta una accion arriba para crear uno.
        </div>
      ) : (
        <div className="space-y-3">
          <RunCardsGrid controller={controller} />
          {controller.data.selectedRun && (
            <div className="mt-4 space-y-4">
              <RunDetail controller={controller} />
              {controller.bridge.remoteNode && <RemoteNodesPanel controller={controller} />}
              {controller.bridge.remoteNode && controller.forms.remoteNode.image && <RemoteScreenshot image={controller.forms.remoteNode.image} />}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
