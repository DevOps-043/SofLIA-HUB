import { MODEL_OPTIONS, type useModelSelector } from '../../../../hooks/useModelSelector';
import { ModelOptionButton } from './ModelOptionButton';
import { ThinkingSelector } from './ThinkingSelector';

export function ModelSelectorDropdown({
  model,
  compact = false,
  align = 'left',
}: {
  model: ReturnType<typeof useModelSelector>;
  compact?: boolean;
  align?: 'left' | 'right';
}) {
  return (
    <div
      role="menu"
      className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} top-[calc(100%+0.5rem)] z-50 ${
        compact ? 'w-[19.5rem]' : 'w-[22rem]'
      } max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-gray-200/90 dark:border-white/12 bg-white/95 dark:bg-[#11161d]/95 shadow-[0_1.75rem_4.5rem_rgba(2,12,23,0.38)] backdrop-blur-2xl transition-all animate-in fade-in slide-in-from-top-2 duration-150`}
      style={{ fontFamily: 'var(--font-system-ui)' }}
    >
      {/* Fondo radial ambiental sutil */}
      <div className="absolute right-0 top-0 h-36 w-36 rounded-full bg-accent/10 blur-3xl pointer-events-none" aria-hidden="true" />
      <div className="absolute left-0 bottom-0 h-28 w-28 rounded-full bg-accent/5 blur-2xl pointer-events-none" aria-hidden="true" />

      <div className="p-2 pt-2.5 relative z-10">
        <div
          className="px-3 pb-2 text-[9.5px] font-bold uppercase tracking-[0.18em] text-gray-400 dark:text-white/40 flex items-center justify-between"
          style={{ fontFamily: 'var(--font-system-label)' }}
        >
          <span>Modelos Disponibles</span>
          <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
        </div>
        <div className="space-y-1">
          {MODEL_OPTIONS.map((option) => (
            <ModelOptionButton key={option.id} model={model} option={option} />
          ))}
        </div>
      </div>
      <ThinkingSelector model={model} />
    </div>
  );
}


