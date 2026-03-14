import { app, BrowserWindow } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import * as dotenv from 'dotenv';

// ─── 0. GLOBAL BOOTSTRAP GUARD ───
const g = globalThis as any;
if (g.__SOFLIA_BOOTSTRAP_COMPLETE__) {
  console.log(`[BOOT] ⏭️ Bootstrap duplicado evitado en PID: ${process.pid}`);
  // No salimos con process.exit(0) para no matar al proceso que si es válido si este fuera un worker thread o similar
  // Pero detenemos la ejecución de este script aquí:
} else {
  g.__SOFLIA_BOOTSTRAP_COMPLETE__ = true;

  // ─── 1. SANDBOX (MUST be before app.whenReady) ───
  // Disabled because BrowserWindow creation is crashing with EXCEPTION_ACCESS_VIOLATION
  // inside Electron's sandbox path on this Windows/Electron 34 setup.
  // app.enableSandbox();

  // ─── 2. CONTROL DE INSTANCIA ÚNICA ───
  const gotTheLock = app.requestSingleInstanceLock()
  if (!gotTheLock) {
    console.log(`[BOOT] ⚠️ SEGUNDA INSTANCIA (PID: ${process.pid}) bloqueada. Saliendo...`)
    app.exit(0)
  } else {
    console.log(`[BOOT] 🚀 INICIANDO SOFLIA HUB — PID: ${process.pid}, PPID: ${process.ppid}`);
    
    // ─── 2. IMPORTS DE SERVICIOS ───
    // Importamos todo aquí para que sean parte de la misma unidad de compilación
    const runBootstrap = async () => {
      const { registerComputerUseHandlers } = await import('./computer-use-handlers')
      const { WhatsAppService } = await import('./whatsapp-service')
      const { WhatsAppAgent } = await import('./whatsapp-agent')
      const { MonitoringService } = await import('./monitoring-service')
      const { registerMonitoringHandlers } = await import('./monitoring-handlers')
      const { CalendarService } = await import('./calendar-service')
      const { registerCalendarHandlers } = await import('./calendar-handlers')
      const { GmailService } = await import('./gmail-service')
      const { registerGmailHandlers } = await import('./gmail-handlers')
      const { DriveService } = await import('./drive-service')
      const { registerDriveHandlers } = await import('./drive-handlers')
      const { GChatService } = await import('./gchat-service')
      const { registerGChatHandlers } = await import('./gchat-handlers')
      const { ProactiveService } = await import('./proactive-service')
      const { AutoDevService } = await import('./autodev-service')
      const { registerAutoDevHandlers } = await import('./autodev-handlers')
      const { SelfLearnService } = await import('./autodev-selflearn')
      const { DesktopAgentService } = await import('./desktop-agent-service')
      const { registerDesktopAgentHandlers } = await import('./desktop-agent-handlers')
      const { MemoryService } = await import('./memory-service')
      const { registerMemoryHandlers } = await import('./memory-handlers')
      const { KnowledgeService } = await import('./knowledge-service')
      const { UpdaterService } = await import('./updater-service')
      const { registerUpdaterHandlers } = await import('./updater-handlers')
      const { ClipboardAIAssistant } = await import('./clipboard-ai-assistant')
      const { TaskScheduler } = await import('./task-scheduler')
      const { NeuralOrganizerService: NeuralOrganizerAI } = await import('./neural-organizer')
      const { PathMemoryService } = await import('./path-memory-service')
      const { MenuManager } = await import('./menu-manager')
      const { registerWhatsAppHandlers } = await import('./whatsapp-handlers')
      await import('./agent-task-queue')

      const __dirname = path.dirname(fileURLToPath(import.meta.url))

      // Entorno
      const envPaths = [path.join(__dirname, '..', '.env'), path.join(__dirname, '.env')];
      for (const envPath of envPaths) {
        if (!dotenv.config({ path: envPath }).error) {
          console.log(`[Main] Entorno cargado desde: ${envPath}`);
          break;
        }
      }

      process.env.APP_ROOT = path.join(__dirname, '..')
      const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
      const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')
      process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

      // Instanciación
      const waService = new WhatsAppService()
      const memoryService = new MemoryService()
      const knowledgeService = new KnowledgeService()
      const monitoringService = new MonitoringService()
      const calendarService = new CalendarService()
      const gmailService = new GmailService(calendarService)
      const driveService = new DriveService(calendarService)
      const gchatService = new GChatService(calendarService)
      const autoDevService = new AutoDevService(process.env.APP_ROOT)
      const selfLearnService = new SelfLearnService(process.env.APP_ROOT)
      const desktopAgentService = new DesktopAgentService()
      const updaterService = new UpdaterService()
      const clipboardAssistant = new ClipboardAIAssistant({ maxHistorySize: 100, pollingIntervalMs: 5000 })
      const taskScheduler = new TaskScheduler()
      const pathMemoryService = new PathMemoryService()
      const proactiveService = new ProactiveService()
      
      let win: BrowserWindow | null = null
      let isQuitting = false
      let waAgent: any = null
      let neuralOrganizer: any = null

      proactiveService.setCalendarService(calendarService)
      proactiveService.setWhatsAppService(waService)

      // Eventos
      selfLearnService.on('micro-fix-candidate', (trigger: any) => autoDevService.queueMicroFix(trigger))
      taskScheduler.on('task-triggered', (data: any) => {
        if (waAgent && waService.getStatus().connected) {
          const jid = `${data.phoneNumber.replace(/\D/g, '')}@s.whatsapp.net`
          waAgent.handleMessage(jid, data.phoneNumber, data.prompt, false, '')
        }
      })

// ─── Wire SystemGuardian alerts → WhatsApp notifications ─────────────
systemGuardian.on('alert', (alert: any) => {
  console.log(`[SystemGuardian] Alert: ${alert.type} — ${alert.message}`)
})

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
  // Use allSnapshots (full session) if available, fall back to pendingSnapshots
  const snapshots = data.allSnapshots?.length ? data.allSnapshots : data.pendingSnapshots;
  if (!currentGeminiApiKey || !snapshots?.length) return
  console.log(`[Main] Session ended — generating summary (${snapshots.length} snapshots of ${data.snapshotCount} total)`)

  try {
    const summary = await generateDailySummary(
      currentGeminiApiKey,
      snapshots.map((s: any) => ({
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
      preload: path.join(__dirname, 'preload.js'),
      additionalArguments: ['--view-mode=flow'],
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
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
      preload: path.join(__dirname, 'preload.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
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

ipcMain.handle('get-desktop-sources', async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1920, height: 1080 }
    })
    return sources.map(source => ({
      display_id: source.id,
      id: source.id,
      name: source.name,
      thumbnail: source.thumbnail.toDataURL()
    }))
  } catch (err: any) {
    console.error('[Main] get-desktop-sources error:', err.message)
    return []
  }
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
app.on('before-quit', () => {
  isQuitting = true
  pathMemoryService.stop()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

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
    if (dailyBriefingService && numbers.length > 0) {
      const currentConfig = dailyBriefingService.getConfig();
      if (!currentConfig.ownerNumber) {
        dailyBriefingService.updateConfig({ ownerNumber: numbers[0] });
      }
    }
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

  // Connect Google services, AutoDev, and Desktop Agent to WhatsApp agent
  waAgent.setGoogleServices(calendarService, gmailService, driveService, gchatService)
  waAgent.setAutoDevService(autoDevService)
  waAgent.setDesktopAgentService(desktopAgentService)
  waAgent.setClipboardAssistant(clipboardAssistant)
  waAgent.setTaskScheduler(taskScheduler)
  waAgent.setSystemGuardian(systemGuardian)

  // Store API key for summary generation
  currentGeminiApiKey = apiKey

  // Start proactive notifications engine
  proactiveService.setApiKey(apiKey)
  if (!proactiveService.isRunning()) {
    proactiveService.start()
  }

  // Update Daily Briefing Service
  if (dailyBriefingService) {
    dailyBriefingService.updateConfig({ apiKey })
  }

  // Start AutoDev autonomous programming engine
  autoDevService.setApiKey(apiKey)

  // Desktop Agent API key
  desktopAgentService.setApiKey(apiKey)

  // Clipboard AI Assistant — update API key and start
  clipboardAssistant.updateApiKey(apiKey)
  clipboardAssistant.start()

  // Neural Organizer AI — initialize with API key
  if (!neuralOrganizer) {
    neuralOrganizer = new NeuralOrganizerAI({
      apiKey,
      notifyCallback: async (msg: string) => {
        if (waService.getStatus().connected) {
          const status = waService.getStatus() as any
          const numbers = status.allowedNumbers || []
          for (const num of numbers) {
            const jid = `${num.replace(/\D/g, '')}@s.whatsapp.net`
            await waService.sendText(jid, msg).catch(() => {})
          }
        }
      }
    })
    waAgent.setNeuralOrganizer(neuralOrganizer)
  } else {
    neuralOrganizer.updateApiKey(apiKey)
  }
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
    if (dailyBriefingService && updates.notifyPhone) {
      dailyBriefingService.updateConfig({ ownerNumber: updates.notifyPhone })
    }
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

const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    // Si alguien intenta abrir otra instancia, enfocamos la principal
    if (win) {
      if (win.isMinimized()) win.restore()
      if (!win.isVisible()) win.show()
      win.focus()
    }
  })
}

      app.whenReady().then(async () => {
        console.log('[BOOT] App ready. Initializing subsystems...');
        MenuManager.setup()
        registerComputerUseHandlers()
        registerMonitoringHandlers(monitoringService, () => win)
        registerCalendarHandlers(calendarService, () => win)
        registerGmailHandlers(gmailService, () => win)
        registerDriveHandlers(driveService, () => win)
        registerGChatHandlers(gchatService, () => win)
        registerAutoDevHandlers(autoDevService, selfLearnService, () => win)
        registerDesktopAgentHandlers(desktopAgentService)
        registerMemoryHandlers(memoryService)
        registerUpdaterHandlers(updaterService, () => win)
        registerWhatsAppHandlers(waService, () => win, (key) => initWhatsAppAgent(key))

        await runOptionalStep('memoryService.init', () => memoryService.init())
        await runOptionalStep('knowledgeService.init', () => knowledgeService.init())
        const pathMemoryReady = await runOptionalStep('pathMemoryService.init', () => pathMemoryService.init())
        if (pathMemoryReady !== undefined) {
          await runOptionalStep('pathMemoryService.start', () => pathMemoryService.start())
        }
        await runOptionalStep('updaterService.init', () => updaterService.init())
        await runOptionalStep('taskScheduler.init', () => taskScheduler.init())
        await runOptionalStep('clipboardAssistant.init', () => clipboardAssistant.init())

        await runOptionalStep('createWindow', () => createWindow())

        const envApiKey = process.env.VITE_GEMINI_API_KEY
        if (envApiKey) {
          await runOptionalStep('initWhatsAppAgent(.env)', () => initWhatsAppAgent(envApiKey))
        }

        await runOptionalStep('waService.init', () => waService.init())
        await runOptionalStep('calendarService.init', () => calendarService.init())

        const shouldAuto = await runOptionalStep('waService.shouldAutoConnect', () => waService.shouldAutoConnect())
        if (shouldAuto) {
          const savedKey = await runOptionalStep('waService.getSavedApiKey', () => waService.getSavedApiKey())
          if (savedKey) {
            await runOptionalStep('initWhatsAppAgent(saved)', () => initWhatsAppAgent(savedKey))
          }
          await runOptionalStep('waService.connect', () => waService.connect())
        }
      }).catch(err => logBootstrapError('app.whenReady bootstrap', err))

      app.on('browser-window-created', () => {
        console.log('[BOOT] Browser window created')
      })
      app.on('render-process-gone', (_event, _webContents, details) => {
        console.error(`[BOOT] App render-process-gone: ${details.reason} (exitCode=${details.exitCode})`)
      })
      app.on('child-process-gone', (_event, details) => {
        console.error(`[BOOT] App child-process-gone: ${details.type} (${details.reason})`)
      })
      app.on('before-quit', () => {
        console.log('[BOOT] before-quit')
        isQuitting = true
        pathMemoryService.stop()
        autoDevService.stop()
      })
      app.on('will-quit', () => {
        console.log('[BOOT] will-quit')
      })
      app.on('window-all-closed', () => {
        console.log('[BOOT] window-all-closed')
        if (process.platform !== 'darwin') app.quit()
      })
    }

    runBootstrap().catch(err => console.error('[BOOT FATAL]', err))
  }
}
