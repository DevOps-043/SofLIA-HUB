import { useCallback, useEffect, useState } from 'react'
import type { DownloadProgress, UpdateAvailableInfo } from '../../services/updater-service'
import type { UpdateNotificationState, UpdatePhase } from './types'

export function useUpdateNotification() {
  const [state, setState] = useState<UpdateNotificationState>({
    phase: 'hidden',
    version: '',
    releaseNotes: null,
    progress: 0,
    error: null,
    dismissed: false,
    showNotes: false,
  })

  const patch = useCallback((next: Partial<UpdateNotificationState>) => {
    setState((current) => ({ ...current, ...next }))
  }, [])

  useEffect(() => {
    if (typeof window.updater === 'undefined') return
    window.updater.onUpdateAvailable((info: UpdateAvailableInfo) => {
      patch({ version: info.version, releaseNotes: info.releaseNotes, phase: 'available', dismissed: false })
    })
    window.updater.onDownloadProgress((progress: DownloadProgress) => {
      patch({ phase: 'downloading', progress: progress.percent })
    })
    window.updater.onUpdateDownloaded(() => patch({ phase: 'ready' }))
    window.updater.onError((err) => patch({ error: err.message, phase: 'error' }))
    return () => window.updater.removeListeners()
  }, [patch])

  const setPhase = useCallback((phase: UpdatePhase) => patch({ phase }), [patch])
  const handleDownload = useCallback(async () => {
    try {
      patch({ phase: 'downloading', progress: 0 })
      await window.updater.downloadUpdate()
    } catch (err: any) {
      patch({ error: err.message, phase: 'error' })
    }
  }, [patch])

  return {
    state,
    setPhase,
    handleDownload,
    handleInstall: () => window.updater.installUpdate(),
    handleDismiss: () => patch({ dismissed: true }),
    toggleNotes: () => patch({ showNotes: !state.showNotes }),
    retry: () => {
      patch({ error: null, phase: 'hidden' })
      window.updater.checkForUpdates()
    },
  }
}
