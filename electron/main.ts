
import { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, desktopCapturer, globalShortcut, screen } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { registerComputerUseHandlers } from './computer-use-handlers'
import { WhatsAppService } from './whatsapp-service'
import { WhatsAppAgent } from './whatsapp-agent'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

// Force microphone access without prompts (necessary for borderless floating windows)
app.commandLine.appendSwitch('use-fake-ui-for-media-stream');
app.commandLine.appendSwitch('enable-speech-input');

let win: BrowserWindow | null
let flowWin: BrowserWindow | null = null
let tray: Tray | null
let isQuitting = false

// ─── WhatsApp ───────────────────────────────────────────────────────
const waService = new WhatsAppService()
let waAgent: WhatsAppAgent | null = null

function createFlowWindow() {
  if (flowWin) {
    flowWin.show();
    flowWin.focus();
    return;
  }

  flowWin = new BrowserWindow({
    width: 600,
    height: 450,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    hasShadow: false,
    resizable: false,
    skipTaskbar: true,
    movable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      additionalArguments: ['--view-mode=flow']
    },
  })

  flowWin.setAlwaysOnTop(true, 'screen-saver');

  // Position at bottom center
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width, height } = primaryDisplay.workAreaSize
  flowWin.setPosition(
    Math.floor(width / 2 - 300),
    Math.floor(height - 480)
  )

  if (VITE_DEV_SERVER_URL) {
    flowWin.loadURL(`${VITE_DEV_SERVER_URL}?view=flow`)
  } else {
    flowWin.loadFile(path.join(RENDERER_DIST, 'index.html'), { query: { view: 'flow' } })
  }

  flowWin.on('hide', () => {
    // Optional: could blur or stop things here via IPC
  });

  flowWin.on('closed', () => {
    flowWin = null
  })

  // Handle permissions for microphone in the flow window
  flowWin.webContents.session.setPermissionRequestHandler((_webContents, permission, callback) => {
    if ((permission as string) === 'audio-capture') {
      return callback(true);
    }
    callback(false);
  });
}

function createTray() {
  if (tray) return; // Prevent duplicates

  const iconPath = path.join(process.env.VITE_PUBLIC!, 'assets/icono.ico')
  let trayIcon: Electron.NativeImage

  try {
    trayIcon = nativeImage.createFromPath(iconPath)
    if (trayIcon.isEmpty()) {
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
    icon: path.join(process.env.VITE_PUBLIC!, 'assets/icono.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })

  win.setMenu(null)

  win.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      win?.hide()
    }
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }

  // Handle permissions for microphone
  win.webContents.session.setPermissionRequestHandler((_webContents, permission, callback) => {
    if ((permission as string) === 'audio-capture') {
      return callback(true);
    }
    callback(false);
  });
}

// IPC Handlers
ipcMain.handle('capture-screen', async (_event, sourceId?: string) => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1920, height: 1080 }
    })
    if (sources.length === 0) return null
    const source = sourceId ? sources.find(s => s.id === sourceId) || sources[0] : sources[0]
    return source.thumbnail.toDataURL()
  } catch (err) { return null }
})

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
  } catch (err) { return [] }
})

ipcMain.on('flow-send-to-chat', (_event, text) => {
  if (win) {
    if (!win.isVisible()) win.show();
    if (win.isMinimized()) win.restore();
    win.focus();
    win.webContents.send('flow-message-received', text);
  }
});

ipcMain.on('close-flow', () => {
  if (flowWin) flowWin.hide();
});

// App Lifecycle
app.on('before-quit', () => { isQuitting = true })
app.on('window-all-closed', () => { if (process.platform !== 'darwin') { app.quit() } }) // Quit on windows if closed unless user wants tray
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
  else if (win) { win.show(); win.focus() }
})

// ─── WhatsApp IPC Handlers ──────────────────────────────────────────
ipcMain.handle('whatsapp:connect', async () => {
  try {
    await waService.connect()
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('whatsapp:disconnect', async () => {
  try {
    await waService.disconnect()
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('whatsapp:get-status', async () => {
  return waService.getStatus()
})

ipcMain.handle('whatsapp:set-allowed-numbers', async (_, numbers: string[]) => {
  try {
    await waService.setAllowedNumbers(numbers)
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('whatsapp:set-api-key', async (_, apiKey: string) => {
  if (waAgent) {
    waAgent.updateApiKey(apiKey)
  } else {
    waAgent = new WhatsAppAgent(waService, apiKey)
    waService.on('message', ({ jid, senderNumber, text }: any) => {
      waAgent!.handleMessage(jid, senderNumber, text)
    })
  }
  return { success: true }
})

app.whenReady().then(async () => {
  registerComputerUseHandlers()
  createTray()
  createWindow()

  // ─── WhatsApp init ────────────────────────────────────────────
  await waService.init()

  // Forward WhatsApp events to renderer
  waService.on('qr', (qr: string) => {
    win?.webContents.send('whatsapp:qr', qr)
  })
  waService.on('status', (status: any) => {
    win?.webContents.send('whatsapp:status', status)
  })
  waService.on('connected', () => {
    win?.webContents.send('whatsapp:status', waService.getStatus())
  })
  waService.on('disconnected', () => {
    win?.webContents.send('whatsapp:status', waService.getStatus())
  })

  // Auto-connect if session exists
  const shouldAuto = await waService.shouldAutoConnect()
  if (shouldAuto) {
    console.log('[WhatsApp] Auto-connecting...')
    waService.connect().catch((err: any) => {
      console.error('[WhatsApp] Auto-connect failed:', err.message)
    })
  }

  // Register Global Shortcut
  globalShortcut.register('CommandOrControl+M', () => {
    if (!flowWin) {
      createFlowWindow()
    } else {
      if (flowWin.isVisible()) {
        flowWin.hide()
      } else {
        flowWin.show()
        flowWin.focus()
        flowWin.webContents.send('flow-window-shown')
      }
    }
  })
})

app.on('will-quit', () => { globalShortcut.unregisterAll() })
