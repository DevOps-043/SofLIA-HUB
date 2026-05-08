import type { WorkflowDefinition, WorkflowId } from '../../../services/workflow-hub-service';
import { Badge } from './components';

type WorkflowCardSectionProps = {
  title: string;
  eyebrow: string;
  workflows: WorkflowDefinition[];
  selectedWorkflowId: WorkflowId;
  passive?: boolean;
  onSelect: (workflowId: WorkflowId) => void;
};

export function WorkflowCardSection({
  title,
  eyebrow,
  workflows,
  selectedWorkflowId,
  passive = false,
  onSelect,
}: WorkflowCardSectionProps) {
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1a1c20]/50 p-5 shadow-sm dark:shadow-lg">
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="text-sm font-bold text-gray-900 dark:text-white">{title}</p>
        <span className="text-[10px] uppercase tracking-[0.16em] text-gray-400 dark:text-gray-500">{eyebrow}</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {workflows.map((workflow) => (
          <button
            key={workflow.id}
            type="button"
            onClick={() => onSelect(workflow.id)}
            className={`rounded-2xl border text-left px-4 py-4 transition-all ${
              selectedWorkflowId === workflow.id
                ? 'border-accent/30 bg-accent/8 shadow-md ring-1 ring-accent/10'
                : 'border-gray-200 dark:border-white/[0.06] hover:border-accent/20 bg-gray-50 dark:bg-white/[0.02]'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-bold text-gray-900 dark:text-white">{workflow.name}</p>
              {passive && <Badge value={workflow.passiveBehavior === 'system' ? 'system' : 'active'} />}
            </div>
            <p className="mt-1 text-[12px] text-gray-500 dark:text-gray-400 leading-relaxed">{workflow.summary}</p>
            {passive && (
              <p className="mt-2 text-[10px] text-accent">
                {workflow.passiveBehavior === 'system' ? 'Pasivo de sistema' : 'Pasivo programable'}
              </p>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
