import { useState, useEffect, useCallback } from 'react'
import type { UpdaterStatus, UpdateAvailableInfo, DownloadProgress } from '../services/updater-service'

export function UpdatePanel() {
  const [status, setStatus] = useState<UpdaterStatus | null>(null)
  const [checking, setChecking] = useState(false)
  const [version, setVersion] = useState('')
  const [releaseNotes, setReleaseNotes] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  // Cargar estado inicial
  useEffect(() => {
    if (typeof window.updater === 'undefined') return

    window.updater.getStatus().then(setStatus)

    window.updater.onUpdateAvailable((info: UpdateAvailableInfo) => {
      setVersion(info.version)
      setReleaseNotes(info.releaseNotes)
      setChecking(false)
      setStatus(prev => prev ? { ...prev, state: 'available', availableVersion: info.version, releaseNotes: info.releaseNotes } : prev)
    })

    window.updater.onDownloadProgress((prog: DownloadProgress) => {
      setProgress(prog.percent)
      setStatus(prev => prev ? { ...prev, state: 'downloading', downloadProgress: prog.percent } : prev)
    })

    window.updater.onUpdateDownloaded(() => {
      setStatus(prev => prev ? { ...prev, state: 'downloaded', downloadProgress: 100 } : prev)
    })

    window.updater.onError((err) => {
      setError(err.message)
      setChecking(false)
      setStatus(prev => prev ? { ...prev, state: 'error', error: err.message } : prev)
    })

    return () => {
      window.updater.removeListeners()
    }
  }, [])

  const handleCheck = useCallback(async () => {
    setChecking(true)
    setError(null)
    try {
      const result = await window.updater.checkForUpdates()
      if (result.success) {
        const s = await window.updater.getStatus()
        setStatus(s)
        // Detener spinner para todos los estados terminales
        if (s.state === 'not-available' || s.state === 'error' || s.state === 'available' || s.state === 'idle') {
          setChecking(false)
          if (s.state === 'error' && s.error) {
            setError(s.error)
          }
        }
      } else {
        setError(result.error || 'Error desconocido al verificar actualizaciones')
        setChecking(false)
      }
    } catch (err: any) {
      setError(err.message)
      setChecking(false)
    }
  }, [])

  const handleDownload = useCallback(async () => {
    setProgress(0)
    await window.updater.downloadUpdate()
  }, [])

  const handleInstall = useCallback(() => {
    window.updater.installUpdate()
  }, [])

  const state = status?.state || 'idle'
  const currentVersion = status?.currentVersion || '0.0.0'
  const availableVersion = version || status?.availableVersion
  const notes = releaseNotes || status?.releaseNotes

  if (typeof window.updater === 'undefined') {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-gray-500 text-sm">Sistema de actualizaciones no disponible en modo desarrollo</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-bold text-white">Actualizaciones</h3>
        <p className="text-xs text-gray-500 mt-1">Mantén SofLIA Hub actualizado con las últimas mejoras</p>
      </div>

      {/* Versión actual */}
      <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Versión actual</p>
            <p className="text-2xl font-black text-white mt-1">v{currentVersion}</p>
          </div>
          <div className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
            state === 'available' || state === 'downloading' || state === 'downloaded'
              ? 'bg-accent/10 border border-accent/20 text-accent'
              : state === 'error'
                ? 'bg-red-500/10 border border-red-500/20 text-red-400'
                : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
          }`}>
            {state === 'available' ? 'Actualización disponible' :
             state === 'downloading' ? 'Descargando...' :
             state === 'downloaded' ? 'Lista para instalar' :
             state === 'checking' || checking ? 'Verificando...' :
             state === 'error' ? 'Error' :
             'Al día'}
          </div>
        </div>
      </div>

      {/* Botón buscar actualizaciones */}
      <button
        onClick={handleCheck}
        disabled={checking || state === 'checking' || state === 'downloading'}
        className="w-full py-3.5 rounded-2xl bg-white text-black text-sm font-bold transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2"
      >
        {checking || state === 'checking' ? (
          <>
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Buscando actualizaciones...
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Buscar actualizaciones
          </>
        )}
      </button>

      {/* Actualización disponible */}
      {(state === 'available' || state === 'downloading' || state === 'downloaded') && availableVersion && (
        <div className="p-4 rounded-2xl bg-accent/5 border border-accent/15 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center">
              <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-white">SofLIA Hub v{availableVersion}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">Nueva versión disponible para descargar</p>
            </div>
          </div>

          {/* Release Notes */}
          {notes && (
            <div className="p-3 rounded-xl bg-black/30 border border-white/5 max-h-48 overflow-y-auto custom-scrollbar">
              <p className="text-[10px] text-accent font-bold uppercase tracking-widest mb-3">Novedades</p>
              <div 
                className="text-xs release-notes"
                dangerouslySetInnerHTML={{ __html: notes }} 
              />
            </div>
          )}

          {/* Progreso de descarga */}
          {state === 'downloading' && (
            <div>
              <div className="flex items-center justify-between text-[10px] font-medium mb-2">
                <span className="text-gray-500">Descargando actualización</span>
                <span className="text-accent font-bold">{progress}%</span>
              </div>
              <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent rounded-full transition-all duration-500 ease-out shadow-[0_0_10px_rgba(0,186,255,0.4)]"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Botones de acción */}
          {state === 'available' && (
            <button
              onClick={handleDownload}
              className="w-full py-3 rounded-xl bg-accent text-white text-sm font-bold transition-all hover:scale-[1.01] active:scale-[0.99]"
            >
              Descargar actualización
            </button>
          )}

          {state === 'downloaded' && (
            <button
              onClick={handleInstall}
              className="w-full py-3 rounded-xl bg-emerald-500 text-white text-sm font-bold transition-all hover:scale-[1.01] active:scale-[0.99] shadow-lg shadow-emerald-500/20"
            >
              Reiniciar para actualizar
            </button>
          )}
        </div>
      )}

      {/* Estado: al día */}
      {state === 'not-available' && !checking && (
        <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/15 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
            <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold text-white">Estás al día</p>
            <p className="text-[10px] text-gray-500 mt-0.5">SofLIA Hub v{currentVersion} es la versión más reciente</p>
          </div>
        </div>
      )}

      {/* Error */}
      {(state === 'error' || error) && (
        <div className="p-4 rounded-2xl bg-red-500/5 border border-red-500/15 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold text-white">Error al verificar</p>
            <p className="text-[10px] text-red-400/70 mt-0.5">{error || status?.error || 'No se pudo conectar al servidor de actualizaciones'}</p>
          </div>
        </div>
      )}

      {/* Info */}
      <div className="pt-4 border-t border-white/5">
        <p className="text-[10px] text-gray-600 leading-relaxed">
          Las actualizaciones se verifican automáticamente cada 4 horas. También puedes verificar manualmente usando el botón de arriba.
        </p>
      </div>
    </div>
  )
}
