import { useState, useEffect, useCallback } from 'react'
import type { UpdateAvailableInfo, DownloadProgress } from '../services/updater-service'

type Phase = 'hidden' | 'available' | 'downloading' | 'ready' | 'error'

export function UpdateNotification() {
  const [phase, setPhase] = useState<Phase>('hidden')
  const [version, setVersion] = useState('')
  const [releaseNotes, setReleaseNotes] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [showNotes, setShowNotes] = useState(false)

  useEffect(() => {
    if (typeof window.updater === 'undefined') return

    window.updater.onUpdateAvailable((info: UpdateAvailableInfo) => {
      setVersion(info.version)
      setReleaseNotes(info.releaseNotes)
      setPhase('available')
      setDismissed(false)
    })

    window.updater.onDownloadProgress((prog: DownloadProgress) => {
      setPhase('downloading')
      setProgress(prog.percent)
    })

    window.updater.onUpdateDownloaded(() => {
      setPhase('ready')
    })

    window.updater.onError((err) => {
      setError(err.message)
      setPhase('error')
    })

    return () => {
      window.updater.removeListeners()
    }
  }, [])

  const handleDownload = useCallback(async () => {
    try {
      setPhase('downloading')
      setProgress(0)
      await window.updater.downloadUpdate()
    } catch (err: any) {
      setError(err.message)
      setPhase('error')
    }
  }, [])

  const handleInstall = useCallback(() => {
    window.updater.installUpdate()
  }, [])

  const handleDismiss = useCallback(() => {
    setDismissed(true)
  }, [])

  if (phase === 'hidden' || dismissed) return null

  return (
    <div className="fixed bottom-6 right-6 z-[9999] max-w-sm animate-in slide-in-from-bottom-4 fade-in duration-500">
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0f]/95 backdrop-blur-xl shadow-2xl shadow-black/50">
        {/* Barra de progreso superior */}
        {phase === 'downloading' && (
          <div className="h-0.5 bg-white/5">
            <div
              className="h-full bg-accent transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        <div className="p-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2.5">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                phase === 'ready' ? 'bg-emerald-500/15' :
                phase === 'error' ? 'bg-red-500/15' :
                'bg-accent/15'
              }`}>
                {phase === 'ready' ? (
                  <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : phase === 'error' ? (
                  <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                )}
              </div>
              <div>
                <p className="text-xs font-bold text-white">
                  {phase === 'ready' ? 'Lista para instalar' :
                   phase === 'downloading' ? 'Descargando...' :
                   phase === 'error' ? 'Error de actualización' :
                   'Nueva versión disponible'}
                </p>
                <p className="text-[10px] text-gray-500 font-medium mt-0.5">
                  {phase === 'error' ? error : `SofLIA Hub v${version}`}
                </p>
              </div>
            </div>

            {/* Cerrar */}
            <button
              onClick={handleDismiss}
              className="text-gray-600 hover:text-gray-400 transition-colors p-0.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Progreso de descarga */}
          {phase === 'downloading' && (
            <div className="mb-3">
              <div className="flex items-center justify-between text-[10px] text-gray-500 font-medium mb-1.5">
                <span>Descargando actualización</span>
                <span className="text-accent font-bold">{progress}%</span>
              </div>
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent rounded-full transition-all duration-500 ease-out shadow-[0_0_8px_rgba(0,186,255,0.4)]"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Release notes expandibles */}
          {releaseNotes && phase === 'available' && (
            <button
              onClick={() => setShowNotes(!showNotes)}
              className="w-full text-left mb-3"
            >
              <p className="text-[10px] text-accent font-bold uppercase tracking-widest flex items-center gap-1">
                Ver novedades
                <svg className={`w-3 h-3 transition-transform ${showNotes ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                </svg>
              </p>
              {showNotes && (
                <div className="mt-2 p-2.5 bg-white/5 rounded-lg border border-white/5 max-h-32 overflow-y-auto">
                  <p className="text-[11px] text-gray-400 leading-relaxed whitespace-pre-wrap">{releaseNotes}</p>
                </div>
              )}
            </button>
          )}

          {/* Botones de acción */}
          <div className="flex gap-2">
            {phase === 'available' && (
              <>
                <button
                  onClick={handleDownload}
                  className="flex-1 py-2 px-3 rounded-xl bg-white text-black text-xs font-bold transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  Actualizar ahora
                </button>
                <button
                  onClick={handleDismiss}
                  className="py-2 px-3 rounded-xl bg-white/5 border border-white/10 text-gray-400 text-xs font-medium hover:text-white transition-colors"
                >
                  Más tarde
                </button>
              </>
            )}

            {phase === 'ready' && (
              <button
                onClick={handleInstall}
                className="flex-1 py-2 px-3 rounded-xl bg-emerald-500 text-white text-xs font-bold transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-emerald-500/20"
              >
                Reiniciar para actualizar
              </button>
            )}

            {phase === 'error' && (
              <button
                onClick={() => {
                  setError(null)
                  setPhase('hidden')
                  window.updater.checkForUpdates()
                }}
                className="flex-1 py-2 px-3 rounded-xl bg-white/5 border border-white/10 text-gray-400 text-xs font-medium hover:text-white transition-colors"
              >
                Reintentar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
