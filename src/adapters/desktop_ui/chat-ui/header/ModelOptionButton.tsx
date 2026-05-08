import type { MODEL_OPTIONS, useModelSelector } from '../../../../hooks/useModelSelector';

type ModelOption = (typeof MODEL_OPTIONS)[number];

export function ModelOptionButton({
  model,
  option,
}: {
  model: ReturnType<typeof useModelSelector>;
  option: ModelOption;
}) {
  const isSelected = model.preferredPrimaryModel === option.id;
  const isPro = option.name.includes('Pro');
  const isLite = option.name.includes('Lite');

  return (
    <button
      onClick={() => model.handleModelChange(option.id)}
      className={`w-full text-left px-3.5 py-3 rounded-xl flex items-start gap-3.5 transition-all group/model ${isSelected ? 'bg-accent/10 dark:bg-accent/15 ring-1 ring-accent/20' : 'hover:bg-gray-50 dark:hover:bg-white/[0.03]'}`}
    >
      <div className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'bg-accent text-white shadow-[0_0_10px_rgba(var(--color-accent-rgb),0.3)]' : 'bg-gray-100 dark:bg-white/5 text-gray-400 group-hover/model:text-gray-600 dark:group-hover/model:text-gray-300'}`}>
        {isPro ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
        ) : isLite ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707"/></svg>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className={`font-bold text-[13.5px] truncate ${isSelected ? 'text-accent' : 'text-primary dark:text-gray-200'}`}>{option.name}</div>
          {isSelected && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-accent">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          )}
        </div>
        <div className="text-[11.5px] text-gray-500 dark:text-gray-400 mt-0.5 leading-tight line-clamp-2">{option.desc}</div>
      </div>
    </button>
  );
}
