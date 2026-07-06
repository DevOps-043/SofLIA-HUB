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
      className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center gap-3 transition-all duration-200 group/model ${
        isSelected
          ? 'bg-accent/8 dark:bg-accent/12 border border-accent/20'
          : 'border border-transparent hover:bg-gray-50 dark:hover:bg-white/[0.03]'
      }`}
    >
      <div
        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
          isSelected
            ? 'bg-accent text-white shadow-[0_0_12px_rgba(0,212,179,0.35)]'
            : 'bg-gray-100 dark:bg-white/[0.08] text-gray-500 dark:text-white/70 group-hover/model:text-gray-700 dark:group-hover/model:text-white'
        }`}
      >
        {isPro ? (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 2 7 12 12 22 7 12 2" />
            <polyline points="2 17 12 22 22 17" />
            <polyline points="2 12 12 17 22 12" />
          </svg>
        ) : isLite ? (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
        ) : (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3.5" />
            <path d="M12 2v3M12 19v3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M2 12h3M19 12h3M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12" />
          </svg>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className={`font-bold text-[13px] ${isSelected ? 'text-accent' : 'text-gray-900 dark:text-white/95'}`}>
            {option.name}
          </div>
          {isSelected && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" className="text-accent shrink-0">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </div>
        <div className="text-[10.5px] text-gray-500 dark:text-white/40 mt-0.5 leading-normal truncate">
          {option.desc}
        </div>
      </div>
    </button>
  );
}
