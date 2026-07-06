import { MODEL_OPTIONS, type useModelSelector } from '../../../../hooks/useModelSelector';
import { ModelOptionButton } from './ModelOptionButton';
import { ThinkingSelector } from './ThinkingSelector';

export function ModelSelectorDropdown({ model }: { model: ReturnType<typeof useModelSelector> }) {
  return (
    <div className="absolute top-full left-0 mt-3 w-80 bg-white/95 dark:bg-[#161B22]/95 backdrop-blur-xl border border-gray-200/50 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 z-50 ring-1 ring-black/5">
      <div className="p-2.5 space-y-1">
        <div className="px-3.5 py-2 text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">
          Modelos Disponibles
        </div>
        {MODEL_OPTIONS.map((option) => (
          <ModelOptionButton key={option.id} model={model} option={option} />
        ))}
      </div>
      <ThinkingSelector model={model} />
    </div>
  );
}
