/**
 * IPC handlers para el servicio de auto-actualización.
 */
import { ipcMain, type BrowserWindow } from 'electron'
import type { UpdaterService } from './updater-service'

export function registerUpdaterHandlers(
  updaterService: UpdaterService,
  getMainWindow: () => BrowserWindow | null,
): void {
  // ─── Invoke handlers (request-response) ────────────────────────
  ipcMain.handle('updater:check-for-updates', async () => {
    try {
      const status = await updaterService.checkForUpdates()
      return { success: true, ...status }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('updater:download-update', async () => {
    try {
      await updaterService.downloadUpdate()
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('updater:install-update', async () => {
    try {
      updaterService.installUpdate()
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('updater:get-status', async () => {
    return updaterService.getStatus()
  })

  // ─── Event forwarding (main → renderer) ────────────────────────
  updaterService.on('update-available', (data) => {
    getMainWindow()?.webContents.send('updater:update-available', data)
  })

  updaterService.on('download-progress', (data) => {
    getMainWindow()?.webContents.send('updater:download-progress', data)
  })

  updaterService.on('update-downloaded', (data) => {
    getMainWindow()?.webContents.send('updater:update-downloaded', data)
  })

  updaterService.on('error', (data) => {
    getMainWindow()?.webContents.send('updater:error', data)
  })

  console.log('[UpdaterHandlers] Registrados correctamente')
}
