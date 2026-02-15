import { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, desktopCapturer } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null
let tray: Tray | null
let isQuitting = false

function createTray() {
  // Crear icono para el tray (16x16 pixel simple icon)
  const iconPath = path.join(process.env.VITE_PUBLIC!, 'electron-vite.svg')
  let trayIcon: Electron.NativeImage

  try {
    trayIcon = nativeImage.createFromPath(iconPath)
    if (trayIcon.isEmpty()) {
      // Fallback: crear un icono simple programáticamente
      trayIcon = nativeImage.createEmpty()
    }
  } catch {
    trayIcon = nativeImage.createEmpty()
  }

  tray = new Tray(trayIcon)
  tray.setToolTip('SofLIA Hub Desktop')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Abrir SofLIA Hub',
      click: () => {
        if (win) {
          win.show()
          win.focus()
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Salir',
      click: () => {
        isQuitting = true
        app.quit()
      }
    }
  ])

  tray.setContextMenu(contextMenu)

  // Click en el icono del tray restaura la ventana
  tray.on('click', () => {
    if (win) {
      if (win.isVisible()) {
        win.focus()
      } else {
        win.show()
        win.focus()
      }
    }
  })
}

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 700,
    minHeight: 500,
    icon: path.join(process.env.VITE_PUBLIC!, 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })

  // Remove default menu bar
  win.setMenu(null)

  // Minimizar al tray en lugar de cerrar
  win.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      win?.hide()
    }
  })

  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// ==========================================
// IPC Handlers - Screen Capture
// ==========================================

// Capturar pantalla completa (retorna data URL)
ipcMain.handle('capture-screen', async (_event, sourceId?: string) => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1920, height: 1080 }
    })

    if (sources.length === 0) return null

    // Usar sourceId específico o la primera pantalla
    const source = sourceId
      ? sources.find(s => s.id === sourceId) || sources[0]
      : sources[0]

    return source.thumbnail.toDataURL()
  } catch (err) {
    console.error('Error capturing screen:', err)
    return null
  }
})

// Listar fuentes disponibles (pantallas y ventanas)
ipcMain.handle('get-screen-sources', async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: { width: 320, height: 180 }
    })

    return sources.map(source => ({
      id: source.id,
      name: source.name,
      thumbnail: source.thumbnail.toDataURL(),
      isScreen: source.id.startsWith('screen:')
    }))
  } catch (err) {
    console.error('Error getting screen sources:', err)
    return []
  }
})

// ==========================================
// App Lifecycle
// ==========================================

// Antes de cerrar, marcar que estamos saliendo
app.on('before-quit', () => {
  isQuitting = true
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // No hacer nada - la app sigue en el tray
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  } else if (win) {
    win.show()
    win.focus()
  }
})

app.whenReady().then(() => {
  createTray()
  createWindow()
})
