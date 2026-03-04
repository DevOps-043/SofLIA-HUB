import type { TimelineEntry } from '../../services/monitoring-service';

interface DailyTimelineProps {
  timeline: TimelineEntry[];
}

const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  productive: { bg: 'bg-emerald-500', border: 'border-emerald-500/20', text: 'text-emerald-400' },
  unproductive: { bg: 'bg-rose-500', border: 'border-rose-500/20', text: 'text-rose-400' },
  neutral: { bg: 'bg-indigo-500', border: 'border-indigo-500/20', text: 'text-indigo-400' },
  uncategorized: { bg: 'bg-slate-600', border: 'border-slate-500/20', text: 'text-slate-400' },
  idle: { bg: 'bg-slate-800', border: 'border-slate-700/20', text: 'text-slate-500' },
};

export function DailyTimeline({ timeline }: DailyTimelineProps) {
  if (timeline.length === 0) {
    return (
      <div className="p-12 flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-white/10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-white/40 font-bold uppercase tracking-widest text-xs">Sin actividad registrada</h3>
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
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-white text-lg font-black tracking-tight">Timeline de Actividad</h3>
          <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-0.5">Distribución visual del tiempo</p>
        </div>
        <div className="flex items-center gap-4 bg-white/5 px-4 py-2 rounded-2xl border border-white/10">
          {Object.entries(CATEGORY_COLORS).filter(([k]) => k !== 'idle' && k !== 'uncategorized').map(([key, val]) => (
            <div key={key} className="flex items-center gap-2">
              <span className={`w-1.5 h-1.5 rounded-full ${val.bg} shadow-[0_0_8px_rgba(255,255,255,0.1)]`} />
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">
                {key === 'productive' ? 'Productivo' : key === 'unproductive' ? 'Improductivo' : 'Neutral'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Modern Analytics Bar */}
      <div className="relative mb-12">
        <div className="flex rounded-3xl overflow-hidden h-10 bg-white/5 border border-white/10 shadow-inner group/bar p-1">
          {timeline.map((entry, i) => {
            const durMs = new Date(entry.endTime).getTime() - new Date(entry.startTime).getTime();
            const pct = totalMs > 0 ? (durMs / totalMs) * 100 : 0;
            if (pct < 0.2) return null;
            const cat = entry.idle ? 'idle' : (entry.category || 'uncategorized');
            const colors = CATEGORY_COLORS[cat] || CATEGORY_COLORS.uncategorized;

            return (
              <div
                key={i}
                className={`${colors.bg} relative group cursor-crosshair transition-all duration-300 hover:scale-y-110 hover:z-10 shadow-lg`}
                style={{ width: `${pct}%`, minWidth: '1px' }}
              >
                {/* Visual Glow on hover */}
                <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                
                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 hidden group-hover:block z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
                  <div className="bg-white text-black p-3 rounded-2xl shadow-2xl shadow-black/50 whitespace-nowrap min-w-[200px]">
                    <p className="text-[10px] font-black uppercase tracking-widest text-accent mb-1">
                      {entry.idle ? 'Inactivo' : entry.processName}
                    </p>
                    <p className="text-xs font-medium text-black/80 truncate mb-2">{entry.windowTitle || 'Sin título'}</p>
                    <div className="flex items-center justify-between pt-2 border-t border-black/5">
                      <span className="text-[10px] font-bold text-black/40">{formatTime(entry.startTime)}</span>
                      <span className="text-[10px] font-bold text-black/40">{formatTime(entry.endTime)}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Horizontal Time Scales */}
        <div className="flex justify-between mt-3 px-2">
          <div className="flex flex-col items-start">
            <div className="w-px h-1.5 bg-white/20 mb-1" />
            <span className="text-[10px] font-bold text-gray-500 font-mono">{formatTime(timeline[0].startTime)}</span>
          </div>
          <div className="flex flex-col items-center">
            <div className="w-px h-1 bg-white/10 mb-1" />
            <span className="text-[8px] font-bold text-gray-700 uppercase tracking-[0.2em]">Hoy</span>
          </div>
          <div className="flex flex-col items-end">
            <div className="w-px h-1.5 bg-white/20 mb-1" />
            <span className="text-[10px] font-bold text-gray-500 font-mono">{formatTime(timeline[timeline.length - 1].endTime)}</span>
          </div>
        </div>
      </div>

      {/* Feed-style Activity List */}
      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-4 custom-scrollbar">
        <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.3em] mb-4">Última Actividad</h4>
        {timeline.slice(-12).reverse().map((entry, i) => {
          const cat = entry.idle ? 'idle' : (entry.category || 'uncategorized');
          const colors = CATEGORY_COLORS[cat] || CATEGORY_COLORS.uncategorized;
          const durMin = Math.round((new Date(entry.endTime).getTime() - new Date(entry.startTime).getTime()) / 60000);

          return (
            <div key={i} className="group flex items-center gap-4 p-3 rounded-2xl bg-white/2 border border-white/5 hover:bg-white/5 hover:border-white/10 transition-all duration-300">
              <div className={`w-1.5 h-8 rounded-full shrink-0 ${colors.bg} opacity-50 group-hover:opacity-100 transition-opacity`} />
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-xs font-black text-white truncate leading-none">
                    {entry.idle ? 'Pausa Detectada' : entry.processName}
                  </p>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-tighter ${colors.text} bg-white/5`}>
                    {cat}
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
                <p className="text-[9px] font-bold text-gray-600 font-mono">{formatTime(entry.startTime)}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
