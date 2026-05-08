import { CATEGORY_COLORS, getCategoryLabel } from './colors';

export function TimelineLegend() {
  return (
    <div className="flex items-center gap-4 bg-white/5 px-4 py-2 rounded-2xl border border-white/10">
      {Object.entries(CATEGORY_COLORS).filter(([key]) => key !== 'idle' && key !== 'uncategorized').map(([key, val]) => (
        <div key={key} className="flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full ${val.bg} shadow-[0_0_8px_rgba(255,255,255,0.1)]`} />
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">
            {getCategoryLabel(key)}
          </span>
        </div>
      ))}
    </div>
  );
}
