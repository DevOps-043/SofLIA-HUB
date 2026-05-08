import { formatElapsedTime } from './format';

interface TrackingToggleViewProps {
  isTracking: boolean;
  elapsed: number;
  currentWindow: string;
  handleToggle: () => void;
}

export function TrackingToggleView({ isTracking, elapsed, currentWindow, handleToggle }: TrackingToggleViewProps) {
  return (
    <div className="p-6 flex flex-col items-center gap-6">
      <h2 className="text-2xl font-semibold text-primary dark:text-white">Sesion de enfoque</h2>
      <div className="flex flex-col items-center gap-2">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center transition-colors ${isTracking ? 'bg-accent/20' : 'bg-gray-100 dark:bg-white/5'}`}>
          <div className={`w-8 h-8 rounded-full ${isTracking ? 'bg-accent animate-pulse' : 'bg-gray-400'}`} />
        </div>
        <span className="text-sm font-medium text-secondary">
          {isTracking ? 'Seguimiento activo' : 'Listo para iniciar'}
        </span>
      </div>

      <div className="text-center">
        <div className="text-4xl font-mono font-bold text-primary dark:text-white tracking-wider">
          {formatElapsedTime(elapsed)}
        </div>
        <div className="text-xs text-secondary mt-1">DURACION DE SESION</div>
      </div>

      {isTracking && currentWindow && (
        <div className="text-xs text-secondary text-center truncate max-w-full px-4">
          {currentWindow}
        </div>
      )}

      <button
        onClick={handleToggle}
        className={`w-full py-3 px-6 rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl active:scale-95 ${
          isTracking
            ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400'
            : 'bg-primary text-white hover:bg-primary/90'
        }`}
      >
        {isTracking ? 'Detener sesion' : 'Iniciar sesion'}
      </button>
    </div>
  );
}
