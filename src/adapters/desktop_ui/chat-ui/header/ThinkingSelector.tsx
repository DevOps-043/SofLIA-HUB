import type { useModelSelector } from '../../../../hooks/useModelSelector';

export function ThinkingSelector({ model }: { model: ReturnType<typeof useModelSelector> }) {
  return (
    <div className="px-3.5 pb-4 pt-2.5 bg-gray-50/40 dark:bg-black/10 border-t border-gray-100 dark:border-white/[0.04]">
      <div className="mb-2 px-1 flex justify-between items-center">
        <span className="text-[10px] font-bold text-gray-400 dark:text-white/30 uppercase tracking-widest">Nivel de Razonamiento</span>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse shadow-[0_0_8px_rgba(0,212,179,0.5)]" />
          <span className="text-[10px] font-bold text-accent uppercase tracking-wider">{model.currentThinkingOption?.name}</span>
        </div>
      </div>
      <div className="flex bg-gray-200/40 dark:bg-white/[0.04] p-1 rounded-xl gap-0.5 relative border border-gray-200/10 dark:border-white/[0.02]">
        {model.currentModel?.thinkingOptions.map((option) => {
          const isActive = model.thinkingMode === option.id;
          return (
            <button
              key={option.id}
              onClick={() => model.setThinkingMode(option.id)}
              className={`flex-1 py-1.5 px-0.5 text-[10px] font-bold uppercase tracking-wider rounded-[9px] transition-all duration-200 ${
                isActive
                  ? 'bg-white dark:bg-white/[0.08] text-accent shadow-sm shadow-black/5 dark:shadow-none'
                  : 'text-gray-400 dark:text-white/30 hover:text-gray-700 dark:hover:text-white/60'
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
