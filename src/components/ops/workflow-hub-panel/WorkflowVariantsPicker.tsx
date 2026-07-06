import type { WorkflowHubOverview } from '../../../services/workflow-hub-service';

type WorkflowVariantsPickerProps = {
  variants: WorkflowHubOverview['variants'];
  selectedVariantId: string | null;
  hasSelectedVariant: boolean;
  onSelectVariant: (variantId: string | null) => void;
};

export function WorkflowVariantsPicker({
  variants,
  selectedVariantId,
  hasSelectedVariant,
  onSelectVariant,
}: WorkflowVariantsPickerProps) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm dark:shadow-none">
      <p className="text-sm font-bold text-gray-900 dark:text-white mb-3">Variantes</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => onSelectVariant(null)}
          className={`px-3 py-1.5 rounded-full text-[11px] font-semibold border transition ${
            !hasSelectedVariant ? 'border-accent/30 bg-accent/10 text-accent' : 'border-border text-secondary'
          }`}>
          Base
        </button>
        {variants.map((variant) => (
          <button key={variant.id} type="button" onClick={() => onSelectVariant(variant.id)}
            className={`px-3 py-1.5 rounded-full text-[11px] font-semibold border transition ${
              selectedVariantId === variant.id ? 'border-accent/30 bg-accent/10 text-accent' : 'border-border text-secondary'
            }`}>
            {variant.name}
          </button>
        ))}
      </div>
    </div>
  );
}
