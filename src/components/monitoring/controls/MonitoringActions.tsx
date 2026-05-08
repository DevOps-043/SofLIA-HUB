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
          className="w-full relative group/btn overflow-hidden py-4 rounded-2xl bg-white text-black text-sm font-black transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xl hover:shadow-white/10"
        >
          <div className="absolute inset-0 bg-accent translate-y-full group-hover/btn:translate-y-0 transition-transform duration-500" />
          <span className="relative z-10 flex items-center justify-center gap-2 group-hover/btn:text-white transition-colors duration-300">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
            </svg>
            {loading ? 'Sincronizando...' : 'Iniciar Monitoreo'}
          </span>
        </button>
      ) : (
        <button
          onClick={onStop}
          disabled={loading}
          className="w-full relative group/btn overflow-hidden py-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm font-black transition-all hover:bg-red-500 hover:text-white hover:border-transparent active:scale-[0.98] shadow-lg hover:shadow-red-500/20"
        >
          <span className="relative z-10 flex items-center justify-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
            </svg>
            {loading ? 'Guardando Sesión...' : 'Detener y Guardar'}
          </span>
        </button>
      )}

      {isRunning && (
        <div className="mt-4 p-4 rounded-2xl bg-white/5 border border-white/10">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">
            <span>Sincronización</span>
            <span className="text-accent">{status?.snapshotCount || 0} capturas</span>
          </div>
          <div className="h-1 bg-white/5 rounded-full overflow-hidden">
            <div className="h-full bg-accent transition-all duration-1000 shadow-[0_0_8px_rgba(0,186,255,0.5)]" style={{ width: `${Math.min(((status?.snapshotCount || 0) % 60) / 0.6, 100)}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}
