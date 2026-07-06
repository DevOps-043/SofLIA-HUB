import type { UpdatePhase } from './types';

export function NotificationActions({
  phase,
  onDownload,
  onDismiss,
  onInstall,
  onRetry,
}: {
  phase: UpdatePhase;
  onDownload: () => void;
  onDismiss: () => void;
  onInstall: () => void;
  onRetry: () => void;
}) {
  if (phase === 'available') {
    return (
      <>
        <button onClick={onDownload} className="flex-1 py-2 px-3 rounded-xl bg-accent text-on-accent text-xs font-medium transition-all hover:scale-[1.02] active:scale-[0.98]">Actualizar ahora</button>
        <button onClick={onDismiss} className="py-2 px-3 rounded-xl bg-surface-2 border border-border text-secondary text-xs font-medium hover:text-gray-900 dark:hover:text-white transition-colors">Mas tarde</button>
      </>
    );
  }
  if (phase === 'ready') {
    return <button onClick={onInstall} className="flex-1 py-2 px-3 rounded-xl bg-success text-white text-xs font-medium transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-emerald-500/20">Reiniciar para actualizar</button>;
  }
  if (phase === 'error') {
    return <button onClick={onRetry} className="flex-1 py-2 px-3 rounded-xl bg-surface-2 border border-border text-secondary text-xs font-medium hover:text-gray-900 dark:hover:text-white transition-colors">Reintentar</button>;
  }
  return null;
}
