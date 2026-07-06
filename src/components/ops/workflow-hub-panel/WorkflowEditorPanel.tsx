import { WorkflowConfigForm } from './WorkflowConfigForm';
import { PassiveWorkflowEditor } from './PassiveWorkflowEditor';
import { VariantActionPanel } from './VariantActionPanel';
import type { WorkflowHubController } from './useWorkflowHubController';

export function WorkflowEditorPanel({ controller }: { controller: WorkflowHubController }) {
  const { selectedWorkflow, selectedVariant } = controller;
  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm dark:shadow-none space-y-4">
      <div>
        <p className="text-sm font-bold text-gray-900 dark:text-white">{selectedWorkflow?.name || 'Workflow'}</p>
        <p className="mt-1 text-xs text-secondary">
          {selectedVariant ? `Editando variante: ${selectedVariant.name}` : selectedWorkflow?.description}
        </p>
      </div>
      {selectedWorkflow?.triggerModes.includes('passive') && <PassiveWorkflowEditor controller={controller} />}
      {selectedWorkflow && (
        <WorkflowConfigForm
          workflow={selectedWorkflow}
          draftConfig={controller.draftConfig}
          inputClass={controller.inputClass}
          textareaClass={controller.textareaClass}
          gchatSpaces={controller.gchatSpaces}
          teams={controller.teams}
          getProjectsForTeam={controller.getProjectsForTeam}
          updateConfig={controller.updateConfig}
        />
      )}
      <VariantActionPanel controller={controller} />
    </div>
  );
}
