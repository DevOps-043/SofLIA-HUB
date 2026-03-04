import type { AppUsageStat } from '../../services/monitoring-service';

interface AppUsageChartProps {
  stats: AppUsageStat[];
}

const APP_COLORS = [
  'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]', 
  'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.3)]', 
  'bg-violet-500 shadow-[0_0_10px_rgba(139,92,246,0.3)]', 
  'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.3)]', 
  'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.3)]', 
  'bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.3)]', 
  'bg-pink-500 shadow-[0_0_10px_rgba(236,72,153,0.3)]', 
  'bg-teal-500 shadow-[0_0_10px_rgba(20,184,166,0.3)]', 
  'bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.3)]', 
  'bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.3)]', 
];

export function AppUsageChart({ stats }: AppUsageChartProps) {
  const topStats = stats.slice(0, 8);

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-sm font-bold text-white tracking-tight">Top Aplicaciones</h3>
          <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-0.5">Análisis de uso</p>
        </div>
        <div className="p-2 bg-white/5 rounded-xl border border-white/10">
          <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
      </div>

      {topStats.length === 0 ? (
        <div className="py-12 flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-2xl">
          <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">Esperando datos...</p>
        </div>
      ) : (
        <div className="space-y-4">
          {topStats.map((stat, i) => (
            <div key={stat.name} className="group animate-in fade-in slide-in-from-right-2 duration-500" style={{ animationDelay: `${i * 100}ms` }}>
              <div className="flex items-center justify-between mb-1.5 px-1">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-1 h-3 rounded-full ${APP_COLORS[i % APP_COLORS.length].split(' ')[0]}`} />
                  <span className="text-xs font-black text-gray-300 truncate tracking-tight">
                    {stat.name}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] font-black text-white font-mono">
                    {formatDuration(stat.durationSeconds)}
                  </span>
                  <span className="text-[9px] font-bold text-gray-600 bg-white/5 px-1.5 py-0.5 rounded">
                    {stat.percentage.toFixed(0)}%
                  </span>
                </div>
              </div>
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ease-out ${APP_COLORS[i % APP_COLORS.length]}`}
                  style={{ width: `${stat.percentage}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
