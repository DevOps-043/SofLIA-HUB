import type { AppUsageStat } from '../../services/monitoring-service';

interface AppUsageChartProps {
  stats: AppUsageStat[];
}

const APP_COLORS = [
  'bg-emerald-500', 'bg-blue-500', 'bg-violet-500', 'bg-amber-500',
  'bg-rose-500', 'bg-cyan-500', 'bg-pink-500', 'bg-teal-500',
  'bg-orange-500', 'bg-indigo-500',
];

export function AppUsageChart({ stats }: AppUsageChartProps) {
  const topStats = stats.slice(0, 10);

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  return (
    <div className="bg-white dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10 p-5">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Aplicaciones</h3>

      {topStats.length === 0 ? (
        <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-6">
          Sin datos de aplicaciones
        </p>
      ) : (
        <div className="space-y-2.5">
          {topStats.map((stat, i) => (
            <div key={stat.name} className="group">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate max-w-[60%]">
                  {stat.name}
                </span>
                <span className="text-[10px] text-gray-400 dark:text-gray-500">
                  {formatDuration(stat.durationSeconds)} ({stat.percentage.toFixed(0)}%)
                </span>
              </div>
              <div className="h-2 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${APP_COLORS[i % APP_COLORS.length]}`}
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
