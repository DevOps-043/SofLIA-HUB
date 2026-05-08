import { prettyFieldLabel, previewValue } from './formatters';

export function PreviewGrid({ values }: { values: Record<string, unknown> }) {
  if (Object.keys(values).length === 0) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
      {Object.entries(values).map(([key, value]) => (
        <div key={key} className="rounded-lg border border-gray-100 dark:border-white/[0.05] bg-gray-50 dark:bg-black/10 px-3 py-2">
          <p className="text-[9px] uppercase tracking-wider text-gray-500 dark:text-gray-500 truncate">{prettyFieldLabel(key)}</p>
          <p className="mt-1 text-[12px] text-gray-800 dark:text-gray-200 line-clamp-3 break-words">{previewValue(value)}</p>
        </div>
      ))}
    </div>
  );
}
