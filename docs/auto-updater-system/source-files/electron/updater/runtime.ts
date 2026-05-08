import type { ProgressInfo, UpdateInfo } from 'electron-updater'
import type { UpdaterEventHandlers } from './events'
import { normalizeReleaseNotes } from './release-notes'
import type { UpdaterState, UpdaterStatus } from './types'

type UpdaterEmit = (event: string, payload?: unknown) => boolean

export class UpdaterRuntime {
  private state: UpdaterState = 'idle'
  private availableVersion: string | null = null
  private releaseNotes: string | null = null
  private downloadProgress: number | null = null
  private errorMessage: string | null = null

  constructor(
    private readonly emit: UpdaterEmit,
    private readonly getCurrentVersion: () => string,
  ) {}

  createEventHandlers(): UpdaterEventHandlers {
    return {
      checking: () => this.handleChecking(),
      available: (info) => this.handleAvailable(info),
      notAvailable: () => this.handleNotAvailable(),
      progress: (progress) => this.handleDownloadProgress(progress),
      downloaded: () => this.handleDownloaded(),
      error: (error) => this.handleError(error),
    }
  }

  getStatus(): UpdaterStatus {
    return {
      state: this.state,
      currentVersion: this.getCurrentVersion(),
      availableVersion: this.availableVersion,
      releaseNotes: this.releaseNotes,
      downloadProgress: this.downloadProgress,
      error: this.errorMessage,
    }
  }

  startDownload(): void {
    this.state = 'downloading'
    this.downloadProgress = 0
    this.emit('status-changed', this.getStatus())
  }

  handleError(error: Error): void {
    this.state = 'error'
    this.errorMessage = error.message
    this.emit('error', { message: error.message })
    this.emit('status-changed', this.getStatus())
  }

  private handleChecking(): void {
    this.state = 'checking'
    this.emit('status-changed', this.getStatus())
    console.log('[Updater] Verificando actualizaciones...')
  }

  private handleAvailable(info: UpdateInfo): void {
    this.state = 'available'
    this.availableVersion = info.version
    this.releaseNotes = normalizeReleaseNotes(info)
    this.errorMessage = null
    this.emit('update-available', { version: info.version, releaseNotes: this.releaseNotes, releaseDate: info.releaseDate })
    this.emit('status-changed', this.getStatus())
    console.log(`[Updater] Actualizacion disponible: v${info.version}`)
  }

  private handleNotAvailable(): void {
    this.state = 'not-available'
    this.errorMessage = null
    this.emit('status-changed', this.getStatus())
  }

  private handleDownloadProgress(progress: ProgressInfo): void {
    this.state = 'downloading'
    this.downloadProgress = Math.round(progress.percent)
    this.emit('download-progress', {
      percent: this.downloadProgress,
      bytesPerSecond: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total,
    })
    this.emit('status-changed', this.getStatus())
  }

  private handleDownloaded(): void {
    this.state = 'downloaded'
    this.downloadProgress = 100
    this.emit('update-downloaded', { version: this.availableVersion, releaseNotes: this.releaseNotes })
    this.emit('status-changed', this.getStatus())
  }
}
