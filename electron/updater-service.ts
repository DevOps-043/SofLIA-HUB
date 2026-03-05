/**
 * UpdaterService — Gestiona auto-actualizaciones de la aplicación vía electron-updater.
 * Polling cada 4 horas + verificación al arrancar (con delay).
 */
import { EventEmitter } from 'events'
import { autoUpdater, type UpdateInfo, type ProgressInfo } from 'electron-updater'
import { app } from 'electron'

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
  downloadProgress: number | null // 0-100
  error: string | null
}

// ─── Service ────────────────────────────────────────────────────────

const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000 // 4 horas
const STARTUP_DELAY_MS = 10 * 1000 // 10 segundos

export class UpdaterService extends EventEmitter {
  private state: UpdaterState = 'idle'
  private availableVersion: string | null = null
  private releaseNotes: string | null = null
  private downloadProgress: number | null = null
  private errorMessage: string | null = null
  private pollInterval: NodeJS.Timeout | null = null

  init(): void {
    // Configuración
    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = true
    autoUpdater.allowDowngrade = false

    // ─── Eventos de electron-updater ──────────────────────────
    autoUpdater.on('checking-for-update', () => {
      this.state = 'checking'
      this.emit('status-changed', this.getStatus())
      console.log('[Updater] Verificando actualizaciones...')
    })

    autoUpdater.on('update-available', (info: UpdateInfo) => {
      this.state = 'available'
      this.availableVersion = info.version
      this.releaseNotes = typeof info.releaseNotes === 'string'
        ? info.releaseNotes
        : Array.isArray(info.releaseNotes)
          ? info.releaseNotes.map(n => typeof n === 'string' ? n : n.note).join('\n')
          : null
      this.errorMessage = null
      this.emit('update-available', {
        version: info.version,
        releaseNotes: this.releaseNotes,
        releaseDate: info.releaseDate,
      })
      this.emit('status-changed', this.getStatus())
      console.log(`[Updater] Actualización disponible: v${info.version}`)
    })

    autoUpdater.on('update-not-available', (_info: UpdateInfo) => {
      this.state = 'not-available'
      this.errorMessage = null
      this.emit('status-changed', this.getStatus())
      console.log('[Updater] No hay actualizaciones disponibles')
    })

    autoUpdater.on('download-progress', (progress: ProgressInfo) => {
      this.state = 'downloading'
      this.downloadProgress = Math.round(progress.percent)
      this.emit('download-progress', {
        percent: this.downloadProgress,
        bytesPerSecond: progress.bytesPerSecond,
        transferred: progress.transferred,
        total: progress.total,
      })
      this.emit('status-changed', this.getStatus())
    })

    autoUpdater.on('update-downloaded', (_info: UpdateInfo) => {
      this.state = 'downloaded'
      this.downloadProgress = 100
      this.emit('update-downloaded', {
        version: this.availableVersion,
        releaseNotes: this.releaseNotes,
      })
      this.emit('status-changed', this.getStatus())
      console.log('[Updater] Actualización descargada — lista para instalar')
    })

    autoUpdater.on('error', (err: Error) => {
      this.state = 'error'
      this.errorMessage = err.message
      this.emit('error', { message: err.message })
      this.emit('status-changed', this.getStatus())
      console.error('[Updater] Error:', err.message)
    })

    // Verificar al arrancar (con delay para no bloquear startup)
    setTimeout(() => {
      this.checkForUpdates().catch(() => {})
    }, STARTUP_DELAY_MS)

    // Polling periódico
    this.pollInterval = setInterval(() => {
      this.checkForUpdates().catch(() => {})
    }, CHECK_INTERVAL_MS)

    console.log('[Updater] Inicializado — polling cada 4h')
  }

  async checkForUpdates(): Promise<UpdaterStatus> {
    try {
      await autoUpdater.checkForUpdates()
    } catch (err: any) {
      this.state = 'error'
      this.errorMessage = err.message
    }
    return this.getStatus()
  }

  async downloadUpdate(): Promise<void> {
    this.state = 'downloading'
    this.downloadProgress = 0
    this.emit('status-changed', this.getStatus())
    await autoUpdater.downloadUpdate()
  }

  installUpdate(): void {
    autoUpdater.quitAndInstall(false, true)
  }

  getStatus(): UpdaterStatus {
    return {
      state: this.state,
      currentVersion: app.getVersion(),
      availableVersion: this.availableVersion,
      releaseNotes: this.releaseNotes,
      downloadProgress: this.downloadProgress,
      error: this.errorMessage,
    }
  }

  stop(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval)
      this.pollInterval = null
    }
  }
}
