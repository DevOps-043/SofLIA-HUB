import { useCallback, useEffect, useState } from 'react'
import type { DownloadProgress, UpdateAvailableInfo, UpdaterStatus } from '../../services/updater-service'

function getUpdater() {
  return typeof window !== 'undefined' ? (window as any).updater : undefined
}

export function useUpdatePanel() {
  const [status, setStatus] = useState<UpdaterStatus | null>(null)
  const [checking, setChecking] = useState(false)
  const [version, setVersion] = useState('')
  const [releaseNotes, setReleaseNotes] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const updater = getUpdater()

  useEffect(() => {
    if (!updater) return

    updater.getStatus().then(setStatus)
    updater.onUpdateAvailable((info: UpdateAvailableInfo) => {
      setVersion(info.version)
      setReleaseNotes(info.releaseNotes)
      setChecking(false)
      setStatus(prev => prev ? { ...prev, state: 'available', availableVersion: info.version, releaseNotes: info.releaseNotes } : prev)
    })
    updater.onDownloadProgress((download: DownloadProgress) => {
      setProgress(download.percent)
      setStatus(prev => prev ? { ...prev, state: 'downloading', downloadProgress: download.percent } : prev)
    })
    updater.onUpdateDownloaded(() => {
      setStatus(prev => prev ? { ...prev, state: 'downloaded', downloadProgress: 100 } : prev)
    })
    updater.onError((err: Error) => {
      setError(err.message)
      setChecking(false)
      setStatus(prev => prev ? { ...prev, state: 'error', error: err.message } : prev)
    })
    return () => updater.removeListeners()
  }, [updater])

  const handleCheck = useCallback(async () => {
    if (!updater) return
    setChecking(true)
    setError(null)
    try {
      const result = await updater.checkForUpdates()
      if (!result.success) return
      const nextStatus = await updater.getStatus()
      setStatus(nextStatus)
      if (nextStatus.state === 'not-available') setChecking(false)
    } catch (err: any) {
      setError(err.message)
      setChecking(false)
    }
  }, [updater])

  const handleDownload = useCallback(async () => {
    setProgress(0)
    await updater?.downloadUpdate()
  }, [updater])

  const handleInstall = useCallback(() => {
    updater?.installUpdate()
  }, [updater])

  return {
    status,
    checking,
    progress,
    error,
    state: status?.state || 'idle',
    currentVersion: status?.currentVersion || '0.0.0',
    availableVersion: version || status?.availableVersion,
    notes: releaseNotes || status?.releaseNotes,
    isUpdaterAvailable: Boolean(updater),
    handleCheck,
    handleDownload,
    handleInstall,
  }
}
