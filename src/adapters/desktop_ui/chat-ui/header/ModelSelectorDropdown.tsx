import { MODEL_OPTIONS, type useModelSelector } from '../../../../hooks/useModelSelector';
import { ModelOptionButton } from './ModelOptionButton';
import { ThinkingSelector } from './ThinkingSelector';

export function ModelSelectorDropdown({ model }: { model: ReturnType<typeof useModelSelector> }) {
  return (
    <div
      role="menu"
      className="absolute top-full left-0 mt-2.5 w-[21rem] bg-white/98 dark:bg-[#161B22]/98 backdrop-blur-xl border border-gray-200/70 dark:border-white/10 rounded-2xl shadow-xl shadow-black/10 dark:shadow-black/40 overflow-hidden animate-fade-in z-50"
    >
      <div className="p-2 pt-2.5">
        <div className="px-2.5 pb-1.5 text-[10px] font-semibold text-gray-400 dark:text-white/35 uppercase tracking-[0.14em]">
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
