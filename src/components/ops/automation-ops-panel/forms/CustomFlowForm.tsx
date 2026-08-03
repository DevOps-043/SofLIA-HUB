import { createCustomAutomationTemplate, executeAutomationTemplate } from '../../../../services/automation-service';
import { inputClass, textareaClass } from '../styles';
import type { AutomationOpsController } from '../useAutomationOpsController';

export function CustomFlowForm({ controller }: { controller: AutomationOpsController }) {
  const custom = controller.forms.custom;
  const selectedTemplate = controller.data.selectedCustomTemplate;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-bold text-gray-900 dark:text-white">Flujos personalizados</p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Describe un proceso y Pulse lo convierte en un flujo reusable.</p>
      </div>
      <div className="space-y-2">
        <input className={inputClass} value={custom.name} onChange={(event) => custom.setName(event.target.value)} placeholder="Nombre del flujo" />
        <textarea className={textareaClass} value={custom.objective} onChange={(event) => custom.setObjective(event.target.value)} placeholder="Que debe lograr Pulse y cuando pedir autorizacion." />
        <button
          type="button"
          className="w-full rounded-xl bg-accent hover:bg-accent/90 text-white py-2.5 text-sm font-semibold transition disabled:opacity-40"
          onClick={() => void controller.runner.runAction('create-custom-flow', async () => {
            const result = await createCustomAutomationTemplate({ name: custom.name.trim() || undefined, objective: custom.objective.trim(), requestedBy: `app:${controller.userId}` });
            if (!result.success || !result.template) throw new Error(result.error || 'No pude crear el flujo.');
            custom.setName('');
            custom.setObjective('');
            custom.setDetails('');
            await controller.data.refreshOverview(true);
            controller.data.setSelectedCustomTemplateId(result.template.id);
            controller.runner.setNotice(`Flujo creado: ${result.template.name}.`);
          })}
          disabled={controller.runner.actionKey === 'create-custom-flow' || !custom.objective.trim()}
        >
          {controller.runner.actionKey === 'create-custom-flow' ? 'Disenando...' : 'Disenar flujo'}
        </button>
      </div>
      {controller.data.customTemplates.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-gray-200 dark:border-white/[0.05]">
          <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Mis flujos</p>
          {controller.data.customTemplates.map((template) => (
            <button key={template.id} type="button" onClick={() => controller.data.setSelectedCustomTemplateId(template.id)} className={`w-full text-left rounded-xl border px-3 py-2.5 transition ${controller.data.selectedCustomTemplateId === template.id ? 'border-accent/25 bg-accent/8' : 'border-gray-200 dark:border-white/[0.06] hover:border-accent/15'}`}>
              <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">{template.name}</p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate mt-0.5">{template.description}</p>
            </button>
          ))}
        </div>
      )}
      {selectedTemplate && (
        <div className="space-y-2 pt-2 border-t border-gray-200 dark:border-white/[0.05]">
          <p className="text-xs font-semibold text-gray-900 dark:text-white">{selectedTemplate.name}</p>
          {selectedTemplate.guidance && <p className="text-[11px] text-gray-500 dark:text-gray-400">{selectedTemplate.guidance}</p>}
          <textarea className={textareaClass} value={custom.details} onChange={(event) => custom.setDetails(event.target.value)} placeholder="Describe el caso actual para este flujo." />
          <button type="button" className="w-full rounded-xl border border-accent/20 bg-accent/10 hover:bg-accent/15 text-accent py-2.5 text-sm font-semibold transition disabled:opacity-40" onClick={() => void controller.runner.runAction('run-custom-flow', async () => {
            const result = await executeAutomationTemplate({ templateId: selectedTemplate.id, requestedBy: `app:${controller.userId}`, input: { details: custom.details.trim() || undefined } });
            if (!result.success || !result.run) throw new Error(result.error || 'No pude preparar este flujo.');
            await controller.data.refreshOverview(false);
            controller.data.setSelectedRunId(result.run.id);
            controller.runner.setNotice(`Caso creado desde ${selectedTemplate.name}.`);
          })} disabled={controller.runner.actionKey === 'run-custom-flow'}>{controller.runner.actionKey === 'run-custom-flow' ? 'Preparando...' : 'Ejecutar flujo'}</button>
        </div>
      )}
    </div>
  );
}
