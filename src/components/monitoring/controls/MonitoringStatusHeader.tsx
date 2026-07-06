interface MonitoringStatusHeaderProps {
  isRunning: boolean;
}

export function MonitoringStatusHeader({ isRunning }: MonitoringStatusHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Estado de Monitoreo</h3>
        <p className="text-xs text-secondary mt-0.5">Control en tiempo real</p>
      </div>
      <div className={`flex items-center gap-2 px-3 py-1 rounded-full border transition-colors ${
        isRunning
          ? 'bg-success/10 border-success/20 text-success'
          : 'bg-surface-2 border-border text-secondary'
      }`}>
        <span className={`w-1.5 h-1.5 rounded-full ${isRunning ? 'bg-success animate-pulse' : 'bg-secondary/50'}`} />
        <span className="text-xs font-medium">{isRunning ? 'En Vivo' : 'Pausado'}</span>
      </div>
    </div>
  );
}
