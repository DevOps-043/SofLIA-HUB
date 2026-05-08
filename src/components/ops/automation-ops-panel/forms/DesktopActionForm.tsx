import { executeAutomationTemplate } from '../../../../services/automation-service';
import { inputClass, textareaClass } from '../styles';
import type { AutomationOpsController } from '../useAutomationOpsController';

export function DesktopActionForm({ controller }: { controller: AutomationOpsController }) {
  const desktop = controller.forms.desktop;

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-bold text-gray-900 dark:text-white">Accion en mi computadora</p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Prepara una accion operativa y espera tu autorizacion.</p>
      </div>
      <textarea className={textareaClass} value={desktop.objective} onChange={(event) => desktop.setObjective(event.target.value)} placeholder="Entra al portal, descarga el archivo mas reciente..." />
      <details className="rounded-xl border border-gray-200 dark:border-white/[0.06] bg-gray-50 dark:bg-white/[0.02] px-3 py-2">
        <summary className="cursor-pointer list-none text-xs font-medium text-gray-700 dark:text-gray-300">Opciones avanzadas</summary>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <select className={inputClass} value={desktop.backend} onChange={(event) => desktop.setBackend(event.target.value)}>
            <option value="auto">Automatico</option>
            <option value="browser">Navegador</option>
            <option value="desktop">Escritorio</option>
            <option value="uia">Windows UIA</option>
          </select>
          <input className={inputClass} value={desktop.startUrl} onChange={(event) => desktop.setStartUrl(event.target.value)} placeholder="URL inicial (opcional)" />
        </div>
      </details>
      <button
        type="button"
        className="w-full rounded-xl bg-accent hover:bg-accent/90 text-white py-2.5 text-sm font-semibold transition disabled:opacity-40"
        onClick={() => void controller.runner.runAction('run-desktop-action', async () => {
          const result = await executeAutomationTemplate({ templateId: 'desktop_action', requestedBy: `app:${controller.userId}`, input: { objective: desktop.objective.trim(), backend: desktop.backend || undefined, startUrl: desktop.startUrl.trim() || undefined } });
          if (!result.success || !result.run) throw new Error(result.error || 'No pude preparar la accion.');
          await controller.data.refreshOverview(false);
          controller.data.setSelectedRunId(result.run.id);
          controller.runner.setNotice(`Caso creado: ${result.run.title}.`);
        })}
        disabled={controller.runner.actionKey === 'run-desktop-action' || !desktop.objective.trim()}
      >
        {controller.runner.actionKey === 'run-desktop-action' ? 'Preparando...' : 'Preparar accion'}
      </button>
    </div>
  );
}
