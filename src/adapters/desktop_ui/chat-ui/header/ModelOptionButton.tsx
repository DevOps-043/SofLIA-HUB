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
      aria-pressed={isSelected}
      onClick={() => model.handleModelChange(option.id)}
      className={`w-full text-left px-2.5 py-2.5 rounded-xl flex items-start gap-3 transition-colors duration-150 group/model ${
        isSelected
          ? 'bg-accent/[0.07] dark:bg-accent/[0.10]'
          : 'hover:bg-gray-100/70 dark:hover:bg-white/[0.04]'
      }`}
    >
      <span
        className={`w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0 transition-colors duration-150 ${
          isSelected
            ? 'bg-accent text-on-accent'
            : 'bg-gray-100 dark:bg-white/[0.06] text-gray-400 dark:text-white/45 group-hover/model:text-gray-600 dark:group-hover/model:text-white/75'
        }`}
      >
        <ModelIcon icon={option.icon} size={16} />
      </span>

      <span className="flex-1 min-w-0">
        <span className="flex items-center gap-1.5">
          <span
            className={`text-[13px] font-semibold truncate ${
              isSelected ? 'text-accent' : 'text-gray-900 dark:text-white/90'
            }`}
          >
            {option.name}
          </span>
          {option.badge && (
            <span className="shrink-0 px-1.5 py-px rounded-full text-[9px] font-bold uppercase tracking-wide bg-accent/12 text-accent">
              {option.badge}
            </span>
          )}
          <span className="flex-1" />
          {isSelected && (
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-accent shrink-0"
              aria-hidden="true"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </span>
        <span className="block text-[11px] text-gray-500 dark:text-white/40 mt-0.5 leading-snug">
          {option.desc}
        </span>
      </span>
    </button>
  );
}
