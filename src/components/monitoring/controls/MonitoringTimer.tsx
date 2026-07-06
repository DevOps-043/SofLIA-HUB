import { formatTime } from './format';

interface MonitoringTimerProps {
  elapsedSeconds: number;
  currentWindow: string;
  isRunning: boolean;
}

export function MonitoringTimer({ elapsedSeconds, currentWindow, isRunning }: MonitoringTimerProps) {
  return (
    <div className="relative py-8 mb-8 flex flex-col items-center justify-center">
      <div className={`text-5xl font-semibold tabular-nums transition-colors ${
        isRunning ? 'text-gray-900 dark:text-white' : 'text-secondary/40'
      }`}>
        {formatTime(elapsedSeconds)}
      </div>

      {currentWindow && isRunning && (
        <div className="mt-4 px-4 py-2 bg-surface-2 border border-border rounded-xl max-w-full animate-in fade-in slide-in-from-top-2 duration-500">
          <p className="text-xs text-accent font-medium text-center mb-1">Ventana Activa</p>
          <p className="text-xs text-gray-600 dark:text-gray-300 truncate text-center italic">"{currentWindow}"</p>
        </div>
      )}
    </div>
  );
}
