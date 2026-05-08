import type { UpdatePhase } from './types'

type NotificationActionsProps = {
  phase: UpdatePhase
  onDownload: () => void
  onDismiss: () => void
  onInstall: () => void
  onRetry: () => void
}

export function NotificationActions({
  phase,
  onDownload,
  onDismiss,
  onInstall,
  onRetry,
}: NotificationActionsProps) {
  if (phase === 'available') {
    return (
      <>
        <button onClick={onDownload} className="flex-1 py-2 px-3 rounded-xl bg-white text-black text-xs font-bold transition-all hover:scale-[1.02] active:scale-[0.98]">
          Actualizar ahora
        </button>
        <button onClick={onDismiss} className="py-2 px-3 rounded-xl bg-white/5 border border-white/10 text-gray-400 text-xs font-medium hover:text-white transition-colors">
          Mas tarde
        </button>
      </>
    )
  }

  if (phase === 'ready') {
    return (
      <button onClick={onInstall} className="flex-1 py-2 px-3 rounded-xl bg-emerald-500 text-white text-xs font-bold transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-emerald-500/20">
        Reiniciar para actualizar
      </button>
    )
  }

  if (phase === 'error') {
    return (
      <button onClick={onRetry} className="flex-1 py-2 px-3 rounded-xl bg-white/5 border border-white/10 text-gray-400 text-xs font-medium hover:text-white transition-colors">
        Reintentar
      </button>
    )
  }

  return null
}
