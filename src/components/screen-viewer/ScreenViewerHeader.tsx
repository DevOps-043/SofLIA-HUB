import type { useScreenCapture } from './useScreenCapture';

type ScreenViewerHeaderProps = ReturnType<typeof useScreenCapture>;

export function ScreenViewerHeader({
  selectedSourceName,
  autoRefresh,
  capturing,
  captureScreen,
  setAutoRefresh,
  toggleSourcePicker,
}: ScreenViewerHeaderProps) {
  return (
    <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100 dark:border-white/5">
      <div className="flex items-center gap-3">
        <h2 className="text-sm font-semibold text-primary dark:text-white">Ver Pantalla</h2>
        <span className="text-xs text-secondary">{selectedSourceName}</span>
        {autoRefresh && (
          <span className="flex items-center gap-1 text-xs text-accent">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            En vivo
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button onClick={toggleSourcePicker} className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5 text-secondary transition-colors">
          Fuente
        </button>
        <button
          onClick={() => setAutoRefresh(!autoRefresh)}
          className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
            autoRefresh
              ? 'bg-accent text-white border-accent'
              : 'border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5 text-secondary'
          }`}
        >
          {autoRefresh ? 'Detener' : 'Auto'}
        </button>
        <button onClick={captureScreen} disabled={capturing} className="px-3 py-1.5 text-xs rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-50 transition-colors">
          {capturing ? 'Capturando...' : 'Capturar'}
        </button>
      </div>
    </div>
  );
}
