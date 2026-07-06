import type { MonitoringStatus } from '../../../core/entities/ActivityLog';

interface MonitoringActionsProps {
  isRunning: boolean;
  loading: boolean;
  status: MonitoringStatus | null;
  onStart: () => void;
  onStop: () => void;
}

export function MonitoringActions({ isRunning, loading, status, onStart, onStop }: MonitoringActionsProps) {
  return (
    <div className="flex flex-col gap-3">
      {!isRunning ? (
        <button
          onClick={onStart}
          disabled={loading}
          className="w-full py-3.5 rounded-xl bg-accent text-on-accent text-sm font-medium transition-all hover:brightness-105 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
          </svg>
          {loading ? 'Sincronizando...' : 'Iniciar Monitoreo'}
        </button>
      ) : (
        <button
          onClick={onStop}
          disabled={loading}
          className="w-full py-3.5 rounded-xl bg-danger/10 border border-danger/20 text-danger text-sm font-medium transition-colors hover:bg-danger hover:text-white hover:border-transparent active:scale-[0.98] flex items-center justify-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
          </svg>
          {loading ? 'Guardando Sesión...' : 'Detener y Guardar'}
        </button>
      )}

      {isRunning && (
        <div className="mt-4 p-4 rounded-xl bg-surface-2 border border-border">
          <div className="flex items-center justify-between text-xs font-medium text-secondary mb-2">
            <span>Sincronización</span>
            <span className="text-accent">{status?.snapshotCount || 0} capturas</span>
          </div>
          <div className="h-1.5 bg-surface rounded-full overflow-hidden">
            <div className="h-full bg-accent transition-all duration-1000" style={{ width: `${Math.min(((status?.snapshotCount || 0) % 60) / 0.6, 100)}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}
