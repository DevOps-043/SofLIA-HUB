import { WorkflowConfigForm } from './WorkflowConfigForm';
import { PassiveWorkflowEditor } from './PassiveWorkflowEditor';
import { VariantActionPanel } from './VariantActionPanel';
import type { WorkflowHubController } from './useWorkflowHubController';

export function WorkflowEditorPanel({ controller }: { controller: WorkflowHubController }) {
  const { selectedWorkflow, selectedVariant } = controller;
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1a1c20]/50 p-5 shadow-sm dark:shadow-lg space-y-4">
      <div>
        <p className="text-sm font-bold text-gray-900 dark:text-white">{selectedWorkflow?.name || 'Workflow'}</p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
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
