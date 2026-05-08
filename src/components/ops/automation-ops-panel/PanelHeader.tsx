import type { AutomationOpsController } from './useAutomationOpsController';

export function PanelHeader({ controller }: { controller: AutomationOpsController }) {
  return (
    <div className="shrink-0 px-6 py-5 flex items-center justify-between">
      <div>
        <h3 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">Asistente Ejecutivo</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Correos, agenda y autorizaciones en una sola vista</p>
      </div>
      <button
        type="button"
        className="p-2.5 rounded-xl bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-white/10 transition-all active:rotate-180 duration-500"
        onClick={() => void controller.runner.runAction('refresh-overview', async () => {
          await controller.data.refreshOverview(true);
          controller.runner.setNotice('Consola sincronizada.');
        })}
        disabled={controller.runner.actionKey === 'refresh-overview'}
        title="Actualizar"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${controller.runner.actionKey === 'refresh-overview' ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </button>
    </div>
  );
}
