import type { TimelineEntry } from '../../../services/monitoring-service';
import { CATEGORY_COLORS } from './colors';
import { formatTimelineTime, getEntryCategory, getEntryDurationMs } from './time';

interface TimelineBarProps {
  timeline: TimelineEntry[];
}

export function TimelineBar({ timeline }: TimelineBarProps) {
  const totalMs = timeline.reduce((sum, entry) => sum + getEntryDurationMs(entry), 0);

  return (
    <div className="relative mb-12">
      <div className="flex rounded-3xl overflow-hidden h-10 bg-white/5 border border-white/10 shadow-inner group/bar p-1">
        {timeline.map((entry, index) => (
          <TimelineSegment key={index} entry={entry} totalMs={totalMs} />
        ))}
      </div>
      <TimeScale first={timeline[0]} last={timeline[timeline.length - 1]} />
    </div>
  );
}

function TimelineSegment({ entry, totalMs }: { entry: TimelineEntry; totalMs: number }) {
  const pct = totalMs > 0 ? (getEntryDurationMs(entry) / totalMs) * 100 : 0;
  if (pct < 0.2) return null;

  const colors = CATEGORY_COLORS[getEntryCategory(entry)] || CATEGORY_COLORS.uncategorized;
  return (
    <div className={`${colors.bg} relative group cursor-crosshair transition-all duration-300 hover:scale-y-110 hover:z-10 shadow-lg`} style={{ width: `${pct}%`, minWidth: '1px' }}>
      <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 hidden group-hover:block z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
        <div className="bg-white text-black p-3 rounded-2xl shadow-2xl shadow-black/50 whitespace-nowrap min-w-[200px]">
          <p className="text-[10px] font-black uppercase tracking-widest text-accent mb-1">
            {entry.idle ? 'Inactivo' : entry.processName}
          </p>
          <p className="text-xs font-medium text-black/80 truncate mb-2">{entry.windowTitle || 'Sin titulo'}</p>
          <div className="flex items-center justify-between pt-2 border-t border-black/5">
            <span className="text-[10px] font-bold text-black/40">{formatTimelineTime(entry.startTime)}</span>
            <span className="text-[10px] font-bold text-black/40">{formatTimelineTime(entry.endTime)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function TimeScale({ first, last }: { first: TimelineEntry; last: TimelineEntry }) {
  return (
    <div className="flex justify-between mt-3 px-2">
      <TimeTick align="start" label={formatTimelineTime(first.startTime)} />
      <TimeTick align="center" label="Hoy" small />
      <TimeTick align="end" label={formatTimelineTime(last.endTime)} />
    </div>
  );
}

function TimeTick({ align, label, small = false }: { align: 'start' | 'center' | 'end'; label: string; small?: boolean }) {
  const alignClass = align === 'start' ? 'items-start' : align === 'center' ? 'items-center' : 'items-end';

  return (
    <div className={`flex flex-col ${alignClass}`}>
      <div className={`${small ? 'h-1 bg-white/10' : 'h-1.5 bg-white/20'} w-px mb-1`} />
      <span className={`${small ? 'text-[8px] text-gray-700 uppercase tracking-[0.2em]' : 'text-[10px] text-gray-500 font-mono'} font-bold`}>
        {label}
      </span>
    </div>
  );
}
