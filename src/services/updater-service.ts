/**
 * Updater Service (Renderer-side)
 * Wrapper tipado para el sistema de auto-actualización vía IPC.
 */

// ─── Types ──────────────────────────────────────────────────────────

export type UpdaterState =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error'

export interface UpdaterStatus {
  state: UpdaterState
  currentVersion: string
  availableVersion: string | null
  releaseNotes: string | null
  downloadProgress: number | null
  error: string | null
}

export interface UpdateAvailableInfo {
  version: string
  releaseNotes: string | null
  releaseDate: string
}

export interface DownloadProgress {
  percent: number
  bytesPerSecond: number
  transferred: number
  total: number
}

// ─── Window type augmentation ───────────────────────────────────────

declare global {
  interface Window {
    updater: {
      checkForUpdates: () => Promise<{ success: boolean; state?: UpdaterState; availableVersion?: string | null; error?: string }>
      downloadUpdate: () => Promise<{ success: boolean; error?: string }>
      installUpdate: () => Promise<{ success: boolean; error?: string }>
      getStatus: () => Promise<UpdaterStatus>
      onUpdateAvailable: (cb: (info: UpdateAvailableInfo) => void) => void
      onDownloadProgress: (cb: (progress: DownloadProgress) => void) => void
      onUpdateDownloaded: (cb: (info: { version: string; releaseNotes: string | null }) => void) => void
      onError: (cb: (err: { message: string }) => void) => void
      removeListeners: () => void
    }
  }
}

// ─── Public API ─────────────────────────────────────────────────────

export async function checkForUpdates(): Promise<UpdaterStatus | null> {
  if (typeof window.updater === 'undefined') return null
  const result = await window.updater.checkForUpdates()
  if (!result.success) return null
  return window.updater.getStatus()
}

export async function downloadUpdate(): Promise<void> {
  await window.updater.downloadUpdate()
}

export async function installUpdate(): Promise<void> {
  await window.updater.installUpdate()
}

export async function getUpdaterStatus(): Promise<UpdaterStatus | null> {
  if (typeof window.updater === 'undefined') return null
  return window.updater.getStatus()
}
