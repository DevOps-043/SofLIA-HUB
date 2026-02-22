import { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, desktopCapturer, globalShortcut, screen } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { registerComputerUseHandlers } from './computer-use-handlers'
import { WhatsAppService } from './whatsapp-service'
import { WhatsAppAgent } from './whatsapp-agent'
import { MonitoringService } from './monitoring-service'
import { registerMonitoringHandlers } from './monitoring-handlers'
import { CalendarService } from './calendar-service'
import { registerCalendarHandlers } from './calendar-handlers'
import { GmailService } from './gmail-service'
import { registerGmailHandlers } from './gmail-handlers'
import { DriveService } from './drive-service'
import { registerDriveHandlers } from './drive-handlers'
import { GChatService } from './gchat-service'
import { registerGChatHandlers } from './gchat-handlers'
import { ProactiveService } from './proactive-service'
import { AutoDevService } from './autodev-service'
import { registerAutoDevHandlers } from './autodev-handlers'
import { SelfLearnService } from './autodev-selflearn'
import { generateDailySummary } from './summary-generator'
import { MemoryService } from './memory-service'
import { registerMemoryHandlers } from './memory-handlers'
import { KnowledgeService } from './knowledge-service'

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

// ─── Memory (3-layer persistent memory) ─────────────────────────────
const memoryService = new MemoryService()

// ─── Knowledge Base (OpenClaw-style .md files) ──────────────────────
const knowledgeService = new KnowledgeService()

// ─── Shared state ───────────────────────────────────────────────────
let currentGeminiApiKey: string | null = null

// ─── Monitoring ─────────────────────────────────────────────────────
const monitoringService = new MonitoringService()

// ─── Calendar ───────────────────────────────────────────────────────
const calendarService = new CalendarService()

// ─── Gmail & Drive (share Google OAuth from CalendarService) ────────
const gmailService = new GmailService(calendarService)
const driveService = new DriveService(calendarService)
const gchatService = new GChatService(calendarService)

// ─── AutoDev (autonomous self-programming) ─────────────────────────
const autoDevService = new AutoDevService(path.join(__dirname, '..'))

// ─── Self-Learning (SofLIA learns from its own failures) ────────────
const selfLearnService = new SelfLearnService(path.join(__dirname, '..'))

// ─── Proactive Notifications ────────────────────────────────────────
const proactiveService = new ProactiveService()
proactiveService.setCalendarService(calendarService)
proactiveService.setWhatsAppService(waService)
// Configure OAuth credentials from env
calendarService.setConfig({
  google: {
    clientId: process.env.VITE_GOOGLE_OAUTH_CLIENT_ID || '',
    clientSecret: process.env.VITE_GOOGLE_OAUTH_CLIENT_SECRET || '',
  },
  microsoft: {
    clientId: process.env.VITE_MICROSOFT_CLIENT_ID || '',
  },
})



// Wire calendar work-start/end to monitoring auto-start/stop
calendarService.on('work-start', async (data: any) => {
  console.log('[Main] Calendar work-start → auto-starting monitoring')
  // The renderer will handle creating the session in Supabase and calling monitoring:start
  win?.webContents.send('calendar:work-start', data)
})

calendarService.on('work-end', async (data: any) => {
  console.log('[Main] Calendar work-end → auto-stopping monitoring')
  win?.webContents.send('calendar:work-end', data)
})

// ─── Summary generation on session end ───────────────────────────────
monitoringService.on('session-ended', async (data: any) => {
  if (!currentGeminiApiKey || !data.pendingSnapshots?.length) return
  console.log(`[Main] Session ended — generating summary (${data.snapshotCount} snapshots)`)

  try {
    const summary = await generateDailySummary(
      currentGeminiApiKey,
      data.pendingSnapshots.map((s: any) => ({
        timestamp: typeof s.timestamp === 'string' ? s.timestamp : new Date(s.timestamp).toISOString(),
        windowTitle: s.windowTitle || '',
        processName: s.processName || '',
        url: s.url,
        idle: s.idle || false,
        idleSeconds: s.idleSeconds || 0,
        ocrText: s.ocrText,
        durationSeconds: 30,
      })),
      { startedAt: new Date().toISOString(), triggerType: 'manual' },
    )

    // Send summary to renderer for Supabase storage
    win?.webContents.send('monitoring:summary-generated', {
      userId: data.userId,
      sessionId: data.sessionId,
      summary,
    })

    console.log('[Main] Summary generated successfully')
  } catch (err: any) {
    console.error('[Main] Summary generation error:', err.message)
  }
})

// ─── Summary IPC handlers ─────────────────────────────────────────────
ipcMain.handle('monitoring:generate-summary', async (_event, activities: any[], sessionInfo: any) => {
  if (!currentGeminiApiKey) {
    return { success: false, error: 'API key not configured' }
  }
  try {
    const summary = await generateDailySummary(currentGeminiApiKey, activities, sessionInfo)
    return { success: true, summary }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('monitoring:send-summary-whatsapp', async (_event, phoneNumber: string, summaryText: string) => {
  try {
    if (!waService || !waService.getStatus().connected) {
      return { success: false, error: 'WhatsApp no conectado' }
    }
    const cleanNumber = phoneNumber.replace(/[^0-9]/g, '')
    const jid = `${cleanNumber}@s.whatsapp.net`
    await waService.sendText(jid, summaryText)
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

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

ipcMain.handle('whatsapp:set-group-config', async (_, config: any) => {
  try {
    await waService.setGroupConfig(config)
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

function initWhatsAppAgent(apiKey: string) {
  // Set API key on memory service for embeddings & summarization
  memoryService.setApiKey(apiKey)

  if (waAgent) {
    waAgent.updateApiKey(apiKey)
  } else {
    waAgent = new WhatsAppAgent(waService, apiKey, memoryService, knowledgeService)
    waAgent.setSelfLearnService(selfLearnService)
    waService.on('message', ({ jid, senderNumber, text, isGroup, history }: any) => {
      // Self-learn: analyze every user message for complaints & suggestions
      selfLearnService.analyzeUserMessage(text, 'whatsapp', { jid, senderNumber })
      waAgent!.handleMessage(jid, senderNumber, text, isGroup, history)
    })
    waService.on('audio', ({ jid, senderNumber, buffer, isGroup, history }: any) => {
      waAgent!.handleAudio(jid, senderNumber, buffer, isGroup, history)
    })
    waService.on('media', ({ jid, senderNumber, buffer, fileName, mimetype, text, isGroup, history }: any) => {
      if (text) selfLearnService.analyzeUserMessage(text, 'whatsapp', { jid, senderNumber })
      waAgent!.handleMedia(jid, senderNumber, buffer, fileName, mimetype, text, isGroup, history)
    })
    console.log('[WhatsApp] Agent initialized with API key + SelfLearn')
  }

  // Connect Google services and AutoDev to WhatsApp agent
  waAgent.setGoogleServices(calendarService, gmailService, driveService, gchatService)
  waAgent.setAutoDevService(autoDevService)

  // Store API key for summary generation
  currentGeminiApiKey = apiKey

  // Start proactive notifications engine
  proactiveService.setApiKey(apiKey)
  if (!proactiveService.isRunning()) {
    proactiveService.start()
  }

  // Start AutoDev autonomous programming engine
  autoDevService.setApiKey(apiKey)
  autoDevService.on('notify-whatsapp', ({ phone, message }: any) => {
    if (waAgent) {
      waService.sendText(`${phone}@s.whatsapp.net`, message).catch(() => {})
    }
  })
  if (!autoDevService.isRunning()) {
    autoDevService.start()
  }

  // Poll for offline WhatsApp queue generated by standalone autodev
  setInterval(() => {
    try {
      const qtPath = require('path').join(require('electron').app.getPath('userData'), '.autodev-data');
      const qPath = require('path').join(qtPath, 'whatsapp-queue.json');
      const fs = require('fs');
      if (fs.existsSync(qPath) && waService.getStatus().connected) {
        const msgs = JSON.parse(fs.readFileSync(qPath, 'utf8'));
        fs.unlinkSync(qPath);
        for (const msg of msgs) {
            waService.sendText(`${msg.phone}@s.whatsapp.net`, msg.message).catch(() => {});
        }
      }
    } catch {}
  }, 5000);
}

// ─── Proactive Service IPC Handlers ────────────────────────────────
ipcMain.handle('proactive:get-config', async () => {
  return proactiveService.getConfig()
})

ipcMain.handle('proactive:update-config', async (_, updates: any) => {
  try {
    proactiveService.updateConfig(updates)
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('proactive:trigger-now', async (_, phoneNumber?: string) => {
  return proactiveService.triggerNow(phoneNumber)
})

ipcMain.handle('proactive:get-status', async () => {
  return {
    running: proactiveService.isRunning(),
    config: proactiveService.getConfig(),
  }
})

ipcMain.handle('whatsapp:set-api-key', async (_, apiKey: string) => {
  initWhatsAppAgent(apiKey)
  // Persist the key so it works on auto-connect next time
  await waService.saveApiKey(apiKey)
  return { success: true }
})

app.whenReady().then(async () => {
  // ─── Memory & Knowledge init ────────────────────────────────
  memoryService.init()
  registerMemoryHandlers(memoryService)
  knowledgeService.init()

  // Restore saved Google/Microsoft OAuth connections from disk
  calendarService.loadConnections()
  registerComputerUseHandlers()
  registerMonitoringHandlers(monitoringService, () => win)
  registerCalendarHandlers(calendarService, () => win)
  registerGmailHandlers(gmailService, () => win)
  registerDriveHandlers(driveService, () => win)
  registerGChatHandlers(gchatService, () => win)
  registerAutoDevHandlers(autoDevService, selfLearnService, () => win)

  // ─── AutoDev auto-init from env API key ─────────────────────
  const envApiKey = process.env.VITE_GEMINI_API_KEY
  if (envApiKey && !autoDevService.isRunning()) {
    autoDevService.setApiKey(envApiKey)
    autoDevService.on('notify-whatsapp', ({ phone, message }: any) => {
      if (waService.getStatus().connected) {
        waService.sendText(`${phone}@s.whatsapp.net`, message).catch(() => {})
      }
    })
    autoDevService.start()
    console.log('[AutoDev] Auto-initialized with env API key')
  }

  createTray()
  createWindow()

  // ─── Service Init ─────────────────────────────────────────────
  await waService.init()
  await calendarService.init()

  // Auto-start calendar polling if there are restored connections
  const restoredConns = calendarService.getConnections()
  if (restoredConns.some(c => c.isActive)) {
    console.log('[Main] Restored Google connections found — starting calendar polling')
    calendarService.startPolling()
  }

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
    // Initialize agent with saved API key before connecting
    const savedKey = await waService.getSavedApiKey()
    if (savedKey) {
      initWhatsAppAgent(savedKey)
    } else {
      console.log('[WhatsApp] No saved API key — agent will not process messages until key is set from UI')
    }

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
