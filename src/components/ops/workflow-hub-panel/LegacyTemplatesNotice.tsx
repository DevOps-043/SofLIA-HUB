import type { WorkflowHubOverview } from '../../../services/workflow-hub-service';

export function LegacyTemplatesNotice({ overview }: { overview: WorkflowHubOverview | null }) {
  if (!overview || overview.legacyCustomTemplates.length === 0) return null;

  return (
    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/8 px-5 py-4 text-xs text-amber-700 dark:text-amber-200">
      Detecte {overview.legacyCustomTemplates.length} flujo(s) personalizados legacy. Se conservan en storage, pero ahora se crean variantes sobre workflows predeterminados.
    </div>
  );
}
