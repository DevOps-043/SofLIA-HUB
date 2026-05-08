import type { TimelineEntry } from '../../../services/monitoring-service';
import { CATEGORY_COLORS } from './colors';
import { formatTimelineTime, getEntryCategory, getEntryDurationMs } from './time';

interface TimelineActivityListProps {
  timeline: TimelineEntry[];
}

export function TimelineActivityList({ timeline }: TimelineActivityListProps) {
  return (
    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-4 custom-scrollbar">
      <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.3em] mb-4">Ultima Actividad</h4>
      {timeline.slice(-12).reverse().map((entry, index) => (
        <ActivityListItem key={index} entry={entry} />
      ))}
    </div>
  );
}

function ActivityListItem({ entry }: { entry: TimelineEntry }) {
  const category = getEntryCategory(entry);
  const colors = CATEGORY_COLORS[category] || CATEGORY_COLORS.uncategorized;
  const durMin = Math.round(getEntryDurationMs(entry) / 60000);

  return (
    <div className="group flex items-center gap-4 p-3 rounded-2xl bg-white/2 border border-white/5 hover:bg-white/5 hover:border-white/10 transition-all duration-300">
      <div className={`w-1.5 h-8 rounded-full shrink-0 ${colors.bg} opacity-50 group-hover:opacity-100 transition-opacity`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-xs font-black text-white truncate leading-none">
            {entry.idle ? 'Pausa Detectada' : entry.processName}
          </p>
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-tighter ${colors.text} bg-white/5`}>
            {category}
          </span>
        </div>
        {!entry.idle && (
          <p className="text-[10px] font-medium text-gray-500 truncate italic">
            {entry.windowTitle}
          </p>
        )}
      </div>
      <div className="text-right shrink-0">
        <p className="text-xs font-black text-white font-mono">{durMin > 0 ? `${durMin}m` : '<1m'}</p>
        <p className="text-[9px] font-bold text-gray-600 font-mono">{formatTimelineTime(entry.startTime)}</p>
      </div>
    </div>
  );
}
