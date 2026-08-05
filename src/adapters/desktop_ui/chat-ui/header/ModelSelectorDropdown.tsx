import { MODEL_OPTIONS, type useModelSelector } from '../../../../hooks/useModelSelector';
import { ModelOptionButton } from './ModelOptionButton';
import { ThinkingSelector } from './ThinkingSelector';

export function ModelSelectorDropdown({ model, compact = false }: { model: ReturnType<typeof useModelSelector>; compact?: boolean }) {
  return (
    <div
      role="menu"
      className={`absolute left-0 top-full z-50 mt-2 ${compact ? 'w-[18.5rem]' : 'w-[21.5rem]'} max-w-[calc(100vw-2rem)] overflow-hidden rounded-[1.35rem] border border-border bg-card/98 shadow-[0_1.5rem_4rem_rgba(2,12,23,0.28)] backdrop-blur-xl animate-fade-in`}
      style={{ fontFamily: 'var(--font-system-ui)' }}
    >
      <div className="p-2 pt-2.5">
        <div className="px-2.5 pb-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-secondary/75" style={{ fontFamily: 'var(--font-system-label)' }}>
          Modelos
        </div>
        <div className="space-y-0.5">
          {MODEL_OPTIONS.map((option) => (
            <ModelOptionButton key={option.id} model={model} option={option} />
          ))}
        </div>
      </div>
      <ThinkingSelector model={model} />
    </div>
  );
}
