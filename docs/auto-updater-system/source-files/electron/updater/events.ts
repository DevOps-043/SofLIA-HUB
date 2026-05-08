import type { AppUpdater, ProgressInfo, UpdateInfo } from 'electron-updater'

export interface UpdaterEventHandlers {
  checking: () => void
  available: (info: UpdateInfo) => void
  notAvailable: (info: UpdateInfo) => void
  progress: (progress: ProgressInfo) => void
  downloaded: (info: UpdateInfo) => void
  error: (error: Error) => void
}

export function registerUpdaterEvents(autoUpdater: AppUpdater, handlers: UpdaterEventHandlers): void {
  autoUpdater.on('checking-for-update', handlers.checking)
  autoUpdater.on('update-available', handlers.available)
  autoUpdater.on('update-not-available', handlers.notAvailable)
  autoUpdater.on('download-progress', handlers.progress)
  autoUpdater.on('update-downloaded', handlers.downloaded)
  autoUpdater.on('error', handlers.error)
}
