import type { useModelSelector } from '../../../../hooks/useModelSelector';

export function ThinkingSelector({ model }: { model: ReturnType<typeof useModelSelector> }) {
  return (
    <div className="px-3.5 pb-4 pt-2 bg-gray-50/50 dark:bg-black/20 border-t border-gray-200 dark:border-white/5">
      <div className="mb-3 px-1 flex justify-between items-center">
        <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Nivel de Razonamiento</span>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
          <span className="text-[10px] font-bold text-accent uppercase tracking-wider">{model.currentThinkingOption?.name}</span>
        </div>
      </div>
      <div className="flex bg-gray-200/50 dark:bg-white/5 p-1 rounded-[10px] gap-1 relative ring-1 ring-black/5">
        {model.currentModel?.thinkingOptions.map((option) => {
          const isActive = model.thinkingMode === option.id;
          return (
            <button
              key={option.id}
              onClick={() => model.setThinkingMode(option.id)}
              className={`flex-1 py-1.5 px-1 text-[11px] font-black uppercase tracking-wider rounded-lg transition-all duration-200 ${isActive ? 'bg-white dark:bg-white/10 text-accent shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
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
