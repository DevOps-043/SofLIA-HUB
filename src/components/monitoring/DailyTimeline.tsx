import type { TimelineEntry } from '../../services/monitoring-service';

interface DailyTimelineProps {
  timeline: TimelineEntry[];
}

const CATEGORY_COLORS: Record<string, { bg: string; border: string }> = {
  productive: { bg: 'bg-emerald-400 dark:bg-emerald-500', border: 'border-emerald-500' },
  unproductive: { bg: 'bg-red-400 dark:bg-red-500', border: 'border-red-500' },
  neutral: { bg: 'bg-blue-400 dark:bg-blue-500', border: 'border-blue-500' },
  uncategorized: { bg: 'bg-gray-300 dark:bg-gray-600', border: 'border-gray-400' },
  idle: { bg: 'bg-gray-200 dark:bg-gray-700', border: 'border-gray-300' },
};

export function DailyTimeline({ timeline }: DailyTimelineProps) {
  if (timeline.length === 0) {
    return (
      <div className="bg-white dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10 p-5">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Timeline</h3>
        <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-6">
          Sin actividad registrada
        </p>
      </div>
    );
  }

  // Calculate total duration for proportional widths
  const totalMs = timeline.reduce((sum, entry) => {
    return sum + (new Date(entry.endTime).getTime() - new Date(entry.startTime).getTime());
  }, 0);

  const formatTime = (date: Date) =>
    new Date(date).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="bg-white dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10 p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Timeline</h3>
        <div className="flex items-center gap-3">
          {Object.entries(CATEGORY_COLORS).filter(([k]) => k !== 'idle').map(([key, val]) => (
            <div key={key} className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-sm ${val.bg}`} />
              <span className="text-[10px] text-gray-400 dark:text-gray-500 capitalize">{key === 'uncategorized' ? 'otro' : key === 'productive' ? 'productivo' : key === 'unproductive' ? 'improductivo' : key}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Timeline bar */}
      <div className="flex rounded-lg overflow-hidden h-8 bg-gray-100 dark:bg-white/5 mb-3">
        {timeline.map((entry, i) => {
          const durMs = new Date(entry.endTime).getTime() - new Date(entry.startTime).getTime();
          const pct = totalMs > 0 ? (durMs / totalMs) * 100 : 0;
          if (pct < 0.3) return null;
          const cat = entry.idle ? 'idle' : (entry.category || 'uncategorized');
          const colors = CATEGORY_COLORS[cat] || CATEGORY_COLORS.uncategorized;

          return (
            <div
              key={i}
              className={`${colors.bg} relative group cursor-pointer transition-opacity hover:opacity-80`}
              style={{ width: `${pct}%`, minWidth: pct > 1 ? '2px' : '1px' }}
              title={`${entry.processName} — ${entry.windowTitle}\n${formatTime(entry.startTime)} - ${formatTime(entry.endTime)}`}
            >
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                <div className="bg-gray-900 dark:bg-gray-800 text-white text-[10px] px-2.5 py-1.5 rounded-lg shadow-lg whitespace-nowrap max-w-[200px]">
                  <p className="font-medium truncate">{entry.processName}</p>
                  <p className="text-gray-300 truncate">{entry.windowTitle}</p>
                  <p className="text-gray-400">{formatTime(entry.startTime)} — {formatTime(entry.endTime)}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Time labels */}
      {timeline.length > 0 && (
        <div className="flex justify-between text-[10px] text-gray-400 dark:text-gray-500">
          <span>{formatTime(timeline[0].startTime)}</span>
          <span>{formatTime(timeline[timeline.length - 1].endTime)}</span>
        </div>
      )}

      {/* Activity list (last 5) */}
      <div className="mt-4 space-y-1">
        {timeline.slice(-8).reverse().map((entry, i) => {
          const cat = entry.idle ? 'idle' : (entry.category || 'uncategorized');
          const colors = CATEGORY_COLORS[cat] || CATEGORY_COLORS.uncategorized;
          const durMin = Math.round((new Date(entry.endTime).getTime() - new Date(entry.startTime).getTime()) / 60000);

          return (
            <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5">
              <span className={`w-1 h-5 rounded-full flex-shrink-0 ${colors.bg}`} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">
                  {entry.idle ? 'Inactivo' : entry.processName}
                </p>
                {!entry.idle && (
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate">{entry.windowTitle}</p>
                )}
              </div>
              <span className="text-[10px] text-gray-400 dark:text-gray-500 flex-shrink-0">
                {durMin > 0 ? `${durMin}m` : '<1m'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
