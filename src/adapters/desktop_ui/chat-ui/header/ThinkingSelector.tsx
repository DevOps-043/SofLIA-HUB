import type { useModelSelector } from '../../../../hooks/useModelSelector';

export function ThinkingSelector({ model }: { model: ReturnType<typeof useModelSelector> }) {
  return (
    <div className="px-3.5 pb-3.5 pt-3 bg-gray-50/60 dark:bg-black/20 border-t border-gray-200/70 dark:border-white/[0.06]">
      <div className="mb-2 px-0.5 flex justify-between items-center">
        <span className="text-[10px] font-semibold text-gray-400 dark:text-white/35 uppercase tracking-[0.14em]">
          Razonamiento
        </span>
        <span className="text-[10px] font-semibold text-gray-500 dark:text-white/45">
          {model.currentThinkingOption?.name}
        </span>
      </div>
      <div
        role="radiogroup"
        aria-label="Nivel de razonamiento"
        className="flex bg-gray-200/50 dark:bg-white/[0.05] p-0.5 rounded-[10px] gap-0.5"
      >
        {model.currentModel?.thinkingOptions.map((option) => {
          const isActive = model.thinkingMode === option.id;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={isActive}
              onClick={() => model.setThinkingMode(option.id)}
              className={`flex-1 py-1.5 px-1 text-[11px] font-medium rounded-lg transition-colors duration-150 ${
                isActive
                  ? 'bg-white dark:bg-white/[0.10] text-gray-900 dark:text-white shadow-sm shadow-black/5 dark:shadow-none'
                  : 'text-gray-500 dark:text-white/40 hover:text-gray-800 dark:hover:text-white/70'
              }`}
              title={option.desc}
            >
              {option.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
