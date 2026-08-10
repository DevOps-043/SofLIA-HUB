import type { MODEL_OPTIONS, useModelSelector } from '../../../../hooks/useModelSelector';
import { ModelIcon } from './ModelIcon';

type ModelOption = (typeof MODEL_OPTIONS)[number];

export function ModelOptionButton({
  model,
  option,
}: {
  model: ReturnType<typeof useModelSelector>;
  option: ModelOption;
}) {
  const isSelected = model.preferredPrimaryModel === option.id;

  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={isSelected}
      onClick={() => model.handleModelChange(option.id)}
      className={`w-full text-left px-3 py-2.5 rounded-xl flex items-start gap-3 transition-all duration-150 group/model focus:outline-none border ${
        isSelected
          ? 'bg-accent/10 dark:bg-accent/15 border-accent/30 dark:border-accent/35 shadow-xs'
          : 'border-transparent hover:bg-gray-100/80 dark:hover:bg-white/[0.05] hover:border-gray-200/50 dark:hover:border-white/5'
      }`}
    >
      <span
        className={`w-8.5 h-8.5 rounded-xl flex items-center justify-center shrink-0 transition-all duration-150 border ${
          isSelected
            ? 'bg-accent text-on-accent border-accent/20 shadow-sm scale-[1.02]'
            : 'bg-gray-100/90 dark:bg-white/[0.06] border-gray-200/60 dark:border-white/10 text-gray-500 dark:text-white/50 group-hover/model:text-gray-900 dark:group-hover/model:text-white group-hover/model:bg-gray-200/70 dark:group-hover/model:bg-white/[0.1] group-hover/model:border-gray-300/50 dark:group-hover/model:border-white/15'
        }`}
      >
        <ModelIcon icon={option.icon} size={17} />
      </span>

      <span className="flex-1 min-w-0">
        <span className="flex items-center gap-1.5">
          <span
            className={`text-[13px] font-semibold truncate ${
              isSelected ? 'text-accent dark:text-accent font-bold' : 'text-gray-900 dark:text-white/90'
            }`}
            style={{ fontFamily: 'var(--font-system-ui)' }}
          >
            {option.name}
          </span>
          {option.badge && (
            <span
              className="shrink-0 px-1.5 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-wider bg-accent/20 text-accent border border-accent/30"
              style={{ fontFamily: 'var(--font-system-label)' }}
            >
              {option.badge}
            </span>
          )}
          <span className="flex-1" />
          {isSelected && (
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-accent shrink-0 animate-in zoom-in-50 duration-150"
              aria-hidden="true"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </span>
        <span className="block text-[11px] text-gray-500 dark:text-white/50 mt-0.5 leading-snug">
          {option.desc}
        </span>
      </span>
    </button>
  );
}


