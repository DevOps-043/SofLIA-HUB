import type { useScreenCapture } from './useScreenCapture';

type SourcePickerProps = ReturnType<typeof useScreenCapture>;

export function SourcePicker({
  showSourcePicker,
  sources,
  selectedSourceId,
  selectSource,
}: SourcePickerProps) {
  if (!showSourcePicker || sources.length === 0) return null;

  return (
    <div className="px-6 py-3 border-b border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-white/5">
      <p className="text-xs text-secondary mb-2">Seleccionar fuente:</p>
      <div className="flex flex-wrap gap-2">
        {sources.map((source) => (
          <button
            key={source.id}
            onClick={() => selectSource(source.id)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition-colors ${
              selectedSourceId === source.id
                ? 'border-accent bg-accent/10 text-accent'
                : 'border-gray-200 dark:border-white/10 hover:bg-white dark:hover:bg-white/10 text-primary dark:text-gray-300'
            }`}
          >
            <img
              src={source.thumbnail}
              alt={source.name}
              className="w-12 h-7 rounded object-cover border border-gray-200 dark:border-white/10"
            />
            <span className="max-w-[120px] truncate">
              {source.isScreen ? `Pantalla ${source.name}` : source.name}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
