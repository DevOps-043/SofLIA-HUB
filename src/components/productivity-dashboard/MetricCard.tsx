type MetricCardProps = {
  label: string;
  value: string | number;
  icon: 'clock' | 'check' | 'idle' | 'camera';
  trend: 'up' | 'down' | 'neutral';
  color?: 'emerald' | 'blue' | 'rose' | 'amber';
};

const colorMap = {
  emerald: 'border-emerald-500/10 hover:border-emerald-500/30 group/metric',
  blue: 'border-blue-500/10 hover:border-blue-500/30 group/metric',
  rose: 'border-rose-500/10 hover:border-rose-500/30 group/metric',
  amber: 'border-amber-500/10 hover:border-amber-500/30 group/metric',
};

const iconColors = {
  emerald: 'text-emerald-400 bg-emerald-500/10',
  blue: 'text-blue-400 bg-blue-500/10',
  rose: 'text-rose-400 bg-rose-500/10',
  amber: 'text-amber-400 bg-amber-500/10',
};

const icons = {
  clock: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  check: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  idle: 'M13 10V3L4 14h7v7l9-11h-7z',
  camera: 'M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z',
};

export function MetricCard({ label, value, icon, trend, color = 'blue' }: MetricCardProps) {
  return (
    <div className={`relative overflow-hidden bg-white dark:bg-white/2 backdrop-blur-xl border rounded-4xl p-6 transition-all duration-500 hover:scale-[1.02] dark:hover:bg-white/5 hover:bg-gray-50 shadow-lg dark:shadow-2xl ${colorMap[color]}`}>
      <div className={`absolute -right-8 -bottom-8 w-24 h-24 blur-3xl rounded-full opacity-20 transition-opacity group-hover/metric:opacity-40 ${iconColors[color].split(' ')[1]}`} />
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className={`p-3 rounded-2xl transition-transform group-hover/metric:rotate-12 duration-300 ${iconColors[color]}`}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={icons[icon]} />
              {icon === 'camera' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />}
            </svg>
          </div>
          {trend !== 'neutral' && (
            <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${trend === 'up' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
              <svg className={`w-3 h-3 ${trend === 'down' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
              {trend === 'up' ? 'Optimo' : 'Critico'}
            </div>
          )}
        </div>
        <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">{label}</p>
        <p className="text-3xl font-black text-gray-900 dark:text-white tracking-tighter truncate">{value}</p>
      </div>
    </div>
  );
}
