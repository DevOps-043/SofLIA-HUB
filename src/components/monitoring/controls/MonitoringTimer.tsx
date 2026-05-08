import { formatTime } from './format';

interface MonitoringTimerProps {
  elapsedSeconds: number;
  currentWindow: string;
  isRunning: boolean;
}

export function MonitoringTimer({ elapsedSeconds, currentWindow, isRunning }: MonitoringTimerProps) {
  return (
    <div className="relative py-8 mb-8 flex flex-col items-center justify-center">
      <div className="absolute inset-0 bg-accent/5 rounded-full blur-3xl opacity-0 group-hover/monitor:opacity-100 transition-opacity duration-1000" />
      <div className={`text-5xl font-black tracking-tighter transition-all duration-700 ${
        isRunning ? 'text-white scale-110 drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]' : 'text-white/20'
      }`}>
        {formatTime(elapsedSeconds)}
      </div>

      {currentWindow && isRunning && (
        <div className="mt-4 px-4 py-2 bg-white/5 border border-white/10 rounded-xl backdrop-blur-md max-w-full animate-in fade-in slide-in-from-top-2 duration-500">
          <p className="text-[10px] text-accent font-bold uppercase tracking-widest text-center mb-1">Ventana Activa</p>
          <p className="text-xs text-gray-300 truncate text-center font-medium italic">"{currentWindow}"</p>
        </div>
      )}
    </div>
  );
}
