import { executeWorkflowHub, saveWorkflowVariant } from '../../../services/workflow-hub-service';
import type { WorkflowHubController } from './useWorkflowHubController';

export function VariantActionPanel({ controller }: { controller: WorkflowHubController }) {
  return (
    <div className="rounded-2xl border border-border bg-surface-2 p-4 space-y-3">
      <input className={controller.inputClass} value={controller.variantName} onChange={(event) => controller.setVariantName(event.target.value)} placeholder="Nombre de la variante" />
      <textarea className={controller.textareaClass} value={controller.variantDescription} onChange={(event) => controller.setVariantDescription(event.target.value)} placeholder="Descripcion corta" />
      <div className="flex gap-2">
        <button type="button" className="flex-1 rounded-xl bg-accent hover:brightness-105 text-on-accent py-2.5 text-sm font-semibold transition disabled:opacity-40"
          onClick={() => void controller.runAction('execute-workflow', async () => {
            if (!controller.selectedWorkflow) throw new Error('Selecciona un workflow.');
            const result = await executeWorkflowHub({
              workflowId: controller.selectedVariant ? undefined : controller.selectedWorkflow.id,
              variantId: controller.selectedVariant?.id,
              requestedBy: `app:${controller.userId}`,
              input: controller.draftConfig,
            });
            if (!result.success || !result.detail) throw new Error(result.error || 'No pude ejecutar el workflow.');
            await controller.refreshOverview(true, result.detail.id);
            controller.setSelectedCaseDetail(result.detail);
            controller.setSelectedCaseId(result.detail.id);
            controller.setNotice(`Caso creado: ${result.detail.title}.`);
          })}
          disabled={controller.actionKey === 'execute-workflow' || !controller.selectedWorkflow}>
          {controller.actionKey === 'execute-workflow' ? 'Ejecutando...' : 'Ejecutar workflow'}
        </button>
        <button type="button" className="flex-1 rounded-xl border border-accent/20 bg-accent/10 hover:bg-accent/15 text-accent py-2.5 text-sm font-semibold transition disabled:opacity-40"
          onClick={() => void controller.runAction('save-variant', async () => {
            if (!controller.selectedWorkflow) throw new Error('Selecciona un workflow.');
            if (!controller.variantName.trim()) throw new Error('Escribe un nombre para la variante.');
            const result = await saveWorkflowVariant({
              variantId: controller.selectedVariant?.id || null,
              workflowId: controller.selectedWorkflow.id,
              name: controller.variantName.trim(),
              description: controller.variantDescription.trim() || null,
              config: controller.draftConfig,
              createdBy: controller.userId,
            });
            if (!result.success || !result.variant) throw new Error(result.error || 'No pude guardar la variante.');
            controller.setSelectedVariantId(result.variant.id);
            await controller.refreshOverview(true, controller.selectedCaseId || undefined);
            controller.setNotice(controller.selectedVariant ? 'Variante actualizada.' : 'Variante guardada.');
          })}
          disabled={controller.actionKey === 'save-variant' || !controller.selectedWorkflow}>
          {controller.actionKey === 'save-variant' ? 'Guardando...' : controller.selectedVariant ? 'Actualizar variante' : 'Guardar variante'}
        </button>
      </div>
    </div>
  );
}
