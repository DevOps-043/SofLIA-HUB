import type { UpdatePhase } from './types';

interface ActionButtonsProps {
  phase: UpdatePhase;
  onDownload: () => void;
  onDismiss: () => void;
  onInstall: () => void;
  onRetry: () => void;
}

export function ActionButtons({
  phase,
  onDownload,
  onDismiss,
  onInstall,
  onRetry,
}: ActionButtonsProps) {
  return (
    <div className="flex gap-2">
      {phase === 'available' && (
        <>
          <button
            onClick={onDownload}
            className="flex-1 py-2 px-3 rounded-xl bg-white text-black text-xs font-bold transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            Actualizar ahora
          </button>
          <button
            onClick={onDismiss}
            className="py-2 px-3 rounded-xl bg-white/5 border border-white/10 text-gray-400 text-xs font-medium hover:text-white transition-colors"
          >
            Mas tarde
          </button>
        </>
      )}
      {phase === 'ready' && (
        <button
          onClick={onInstall}
          className="flex-1 py-2 px-3 rounded-xl bg-emerald-500 text-white text-xs font-bold transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-emerald-500/20"
        >
          Reiniciar para actualizar
        </button>
      )}
      {phase === 'error' && (
        <button
          onClick={onRetry}
          className="flex-1 py-2 px-3 rounded-xl bg-white/5 border border-white/10 text-gray-400 text-xs font-medium hover:text-white transition-colors"
        >
          Reintentar
        </button>
      )}
    </div>
  );
}
