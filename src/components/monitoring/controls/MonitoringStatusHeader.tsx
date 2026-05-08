interface MonitoringStatusHeaderProps {
  isRunning: boolean;
}

export function MonitoringStatusHeader({ isRunning }: MonitoringStatusHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h3 className="text-sm font-bold text-white tracking-tight">Estado de Monitoreo</h3>
        <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-0.5">Control en tiempo real</p>
      </div>
      <div className={`flex items-center gap-2 px-3 py-1 rounded-full border transition-all duration-500 ${
        isRunning
          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.1)]'
          : 'bg-white/5 border-white/10 text-gray-500'
      }`}>
        <span className={`w-1.5 h-1.5 rounded-full ${isRunning ? 'bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-gray-600'}`} />
        <span className="text-[10px] font-bold uppercase tracking-wider">{isRunning ? 'En Vivo' : 'Pausado'}</span>
      </div>
    </div>
  );
}
