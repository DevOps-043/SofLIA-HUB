import { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, desktopCapturer, globalShortcut, screen } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import pino from 'pino'
import { ServiceRegistry } from './service-registry'
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
import { WorkflowEngine } from './workflow-engine'
import { CRMService } from './crm-service'
import { WorkflowAIService } from './workflow-ai-service'
import { registerWorkflowHandlers } from './workflow-handlers'
import { ReunionWorkflowAdapter } from './whatsapp-workflow-reunion'
import { DriveTranscriptWatcher } from './drive-transcript-watcher'
import fs from 'node:fs'

const logger = pino({
  name: 'soflia-main',
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
})

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

// ─── Deferred Service Definitions ───────────────────────────────────
let waService: WhatsAppService
let memoryService: MemoryService
let knowledgeService: KnowledgeService
let monitoringService: MonitoringService
let calendarService: CalendarService
let gmailService: GmailService
let driveService: DriveService
let gchatService: GChatService
let autoDevService: AutoDevService
let selfLearnService: SelfLearnService
let workflowEngine: WorkflowEngine
let crmService: CRMService
let transcriptWatcher: DriveTranscriptWatcher
let proactiveService: ProactiveService

let waAgent: WhatsAppAgent | null = null
let workflowAIService: WorkflowAIService | null = null
let reunionAdapter: ReunionWorkflowAdapter | null = null
let currentGeminiApiKey: string | null = null

// ─── Fallback Native ShadowLoop ─────────────────────────────────────
class NativeShadowLoop {
  constructor() {
    logger.info('[ShadowLoop] Initialized Native Fallback');
  }

  async compileInMemory(sourceCode: string): Promise<any> {
    try {
      const ts = (await import('typescript')).default;
      const result = ts.transpileModule(sourceCode, {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
          strict: true,
          esModuleInterop: true
        }
      });

      const vm = (await import('node:vm')).default;
      
      const logs: string[] = [];
      const sandboxConsole = {
        log: (...args: any[]) => logs.push(args.join(' ')),
        error: (...args: any[]) => logs.push('[ERROR] ' + args.join(' ')),
        warn: (...args: any[]) => logs.push('[WARN] ' + args.join(' ')),
        info: (...args: any[]) => logs.push('[INFO] ' + args.join(' ')),
      };

      const sandboxContext = {
        console: sandboxConsole,
        require: require,
        process: process,
        setTimeout: setTimeout,
        clearTimeout: clearTimeout,
        Buffer: Buffer,
        exports: {},
        module: { exports: {} }
      };

      const context = vm.createContext(sandboxContext);
      const script = new vm.Script(result.outputText);
      
      let executionResult = null;
      try {
        script.runInContext(context, { timeout: 5000 });
        executionResult = sandboxContext.module.exports;
      } catch (execErr: any) {
        logger.error({ err: execErr }, '[ShadowLoop] VM Execution failed');
        logs.push(`[EXEC ERROR] ${execErr.message}`);
      }

      return { 
        success: true, 
        js: result.outputText, 
        logs,
        exports: typeof executionResult === 'function' ? '[Function]' : typeof executionResult === 'object' ? JSON.stringify(executionResult) : executionResult
      };
    } catch (err: any) {
      logger.error({ err }, '[ShadowLoop] Transpilation failed');
      return { success: false, error: err.message };
    }
  }
}

// ─── Initialization Functions ───────────────────────────────────────

function setupEventListeners() {
  calendarService.on('work-start', async (data: any) => {
    logger.info('[Main] Calendar work-start → auto-starting monitoring')
    win?.webContents.send('calendar:work-start', data)
  })

  calendarService.on('work-end', async (data: any) => {
    logger.info('[Main] Calendar work-end → auto-stopping monitoring')
    win?.webContents.send('calendar:work-end', data)
  })

  monitoringService.on('session-ended', async (data: any) => {
    if (!currentGeminiApiKey || !data.pendingSnapshots?.length) return
    logger.info(`[Main] Session ended — generating summary (${data.snapshotCount} snapshots)`)

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

      win?.webContents.send('monitoring:summary-generated', {
        userId: data.userId,
        sessionId: data.sessionId,
        summary,
      })

      logger.info('[Main] Summary generated successfully')
    } catch (err: any) {
      logger.error({ err }, '[Main] Summary generation error')
    }
  })

  transcriptWatcher.on('transcript-detected', (data: any) => {
    win?.webContents.send('transcript:detected', data)
  })
  
  transcriptWatcher.on('workflow-triggered', (data: any) => {
    win?.webContents.send('transcript:workflow-triggered', data)
  })

  waService.on('qr', (qr: string) => win?.webContents.send('whatsapp:qr', qr))
  waService.on('status', (status: any) => win?.webContents.send('whatsapp:status', status))
  waService.on('connected', () => win?.webContents.send('whatsapp:status', waService.getStatus()))
  waService.on('disconnected', () => win?.webContents.send('whatsapp:status', waService.getStatus()))
  
  calendarService.on('connected', () => transcriptWatcher.start())
  calendarService.on('disconnected', () => transcriptWatcher.stop())

  workflowEngine.on('sla:breach', (breach: any) => {
    logger.warn({ breach }, '[Workflow] SLA Breach detected')
  })
}

function registerIPCHandlers() {
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

  ipcMain.handle('monitoring:generate-summary', async (_event, activities: any[], sessionInfo: any) => {
    if (!currentGeminiApiKey) return { success: false, error: 'API key not configured' }
    try {
      const summary = await generateDailySummary(currentGeminiApiKey, activities, sessionInfo)
      return { success: true, summary }
    }
    catch (err: any) {
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

  ipcMain.handle('whatsapp:connect', async () => {
    try { await waService.connect(); return { success: true } }
    catch (err: any) { return { success: false, error: err.message } }
  })

  ipcMain.handle('whatsapp:disconnect', async () => {
    try { await waService.disconnect(); return { success: true } }
    catch (err: any) { return { success: false, error: err.message } }
  })

  ipcMain.handle('whatsapp:get-status', async () => waService.getStatus())

  ipcMain.handle('whatsapp:set-allowed-numbers', async (_, numbers: string[]) => {
    try { await waService.setAllowedNumbers(numbers); return { success: true } }
    catch (err: any) { return { success: false, error: err.message } }
  })

  ipcMain.handle('whatsapp:set-group-config', async (_, config: any) => {
    try { await waService.setGroupConfig(config); return { success: true } }
    catch (err: any) { return { success: false, error: err.message } }
  })

  ipcMain.handle('proactive:get-config', async () => proactiveService.getConfig())
  
  ipcMain.handle('proactive:update-config', async (_, updates: any) => {
    try { proactiveService.updateConfig(updates); return { success: true } }
    catch (err: any) { return { success: false, error: err.message } }
  })

  ipcMain.handle('proactive:trigger-now', async (_, phoneNumber?: string) => proactiveService.triggerNow(phoneNumber))

  ipcMain.handle('proactive:get-status', async () => ({
    running: proactiveService.isRunning(),
    config: proactiveService.getConfig(),
  }))

  ipcMain.handle('whatsapp:set-api-key', async (_, apiKey: string) => {
    initWhatsAppAgent(apiKey)
    await waService.saveApiKey(apiKey)
    return { success: true }
  })
}

function initWhatsAppAgent(apiKey: string) {
  memoryService.setApiKey(apiKey)

  if (waAgent) {
    waAgent.updateApiKey(apiKey)
  } else {
    waAgent = new WhatsAppAgent(waService, apiKey, memoryService, knowledgeService)
    waAgent.setSelfLearnService(selfLearnService)
    waService.on('message', ({ jid, senderNumber, text, isGroup, history }: any) => {
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
    logger.info('[WhatsApp] Agent initialized with API key + SelfLearn')
  }

  waAgent.setGoogleServices(calendarService, gmailService, driveService, gchatService)
  waAgent.setAutoDevService(autoDevService)
  currentGeminiApiKey = apiKey

  if (!workflowAIService) workflowAIService = new WorkflowAIService(apiKey)
  if (!reunionAdapter) reunionAdapter = new ReunionWorkflowAdapter(workflowEngine, workflowAIService, waService, crmService)
  else reunionAdapter.setAIService(workflowAIService)
  
  if (waAgent) waAgent.setReunionAdapter(reunionAdapter)

  proactiveService.setApiKey(apiKey)
  if (!proactiveService.isRunning()) proactiveService.start()

  autoDevService.setApiKey(apiKey)
  autoDevService.on('notify-whatsapp', ({ phone, message }: any) => {
    if (waAgent) waService.sendText(`${phone}@s.whatsapp.net`, message).catch(() => {})
  })
  if (!autoDevService.isRunning()) autoDevService.start()
}

// ─── UI Creation ────────────────────────────────────────────────────

function createFlowWindow() {
  if (flowWin) {
    flowWin.show(); flowWin.focus();
    return;
  }

  flowWin = new BrowserWindow({
    width: 600, height: 450,
    transparent: true, frame: false, alwaysOnTop: true,
    hasShadow: false, resizable: false, skipTaskbar: true, movable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      additionalArguments: ['--view-mode=flow']
    },
  })

  flowWin.setAlwaysOnTop(true, 'screen-saver');

  const primaryDisplay = screen.getPrimaryDisplay()
  const { width, height } = primaryDisplay.workAreaSize
  flowWin.setPosition(Math.floor(width / 2 - 300), Math.floor(height - 480))

  if (VITE_DEV_SERVER_URL) flowWin.loadURL(`${VITE_DEV_SERVER_URL}?view=flow`)
  else flowWin.loadFile(path.join(RENDERER_DIST, 'index.html'), { query: { view: 'flow' } })

  flowWin.on('hide', () => {});
  flowWin.on('closed', () => { flowWin = null })
  flowWin.webContents.session.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(permission === 'media');
  });
}

function createTray() {
  if (tray) return;

  const iconPath = path.join(process.env.VITE_PUBLIC!, 'assets/icono.ico')
  let trayIcon: Electron.NativeImage
  try {
    trayIcon = nativeImage.createFromPath(iconPath)
    if (trayIcon.isEmpty()) trayIcon = nativeImage.createEmpty()
  } catch {
    trayIcon = nativeImage.createEmpty()
  }

  tray = new Tray(trayIcon)
  tray.setToolTip('SofLIA Hub Desktop')

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Abrir SofLIA Hub', click: () => { if (win) { win.show(); win.focus() } } },
    { type: 'separator' },
    { label: 'Salir', click: () => { isQuitting = true; app.quit() } }
  ])

  tray.setContextMenu(contextMenu)
  tray.on('click', () => {
    if (win) {
      if (win.isVisible()) win.focus()
      else { win.show(); win.focus() }
    }
  })
}

function createWindow() {
  win = new BrowserWindow({
    width: 1200, height: 800, minWidth: 700, minHeight: 500,
    icon: path.join(process.env.VITE_PUBLIC!, 'assets/icono.ico'),
    webPreferences: { preload: path.join(__dirname, 'preload.mjs') },
  })

  win.setMenu(null)
  win.on('close', (event) => {
    if (!isQuitting) { event.preventDefault(); win?.hide() }
  })

  if (VITE_DEV_SERVER_URL) win.loadURL(VITE_DEV_SERVER_URL)
  else win.loadFile(path.join(RENDERER_DIST, 'index.html'))

  win.webContents.session.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(permission === 'media');
  });
}

// App Lifecycle
app.on('before-quit', () => { isQuitting = true })
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
  else if (win) { win.show(); win.focus() }
})
app.on('will-quit', () => { globalShortcut.unregisterAll() })

// ─── Application Bootstrap ──────────────────────────────────────────

app.whenReady().then(async () => {
  logger.info('[Main] Application ready. Initializing ServiceRegistry and core services...');
  const registry = ServiceRegistry.getInstance();

  try {
    // Synchronous/Fast initializations
    waService = new WhatsAppService()
    registry.registerService('waService', waService)
    
    memoryService = new MemoryService()
    registry.registerService('memoryService', memoryService)
    
    knowledgeService = new KnowledgeService()
    registry.registerService('knowledgeService', knowledgeService)
    
    monitoringService = new MonitoringService()
    registry.registerService('monitoringService', monitoringService)
    
    calendarService = new CalendarService()
    registry.registerService('calendarService', calendarService)
    
    gmailService = new GmailService(calendarService)
    driveService = new DriveService(calendarService)
    gchatService = new GChatService(calendarService)
    
    autoDevService = new AutoDevService(path.join(__dirname, '..'))
    selfLearnService = new SelfLearnService(path.join(__dirname, '..'))
    
    workflowEngine = new WorkflowEngine()
    crmService = new CRMService()
    
    transcriptWatcher = new DriveTranscriptWatcher(driveService, calendarService, workflowEngine, waService)
    proactiveService = new ProactiveService()
    proactiveService.setCalendarService(calendarService)
    proactiveService.setWhatsAppService(waService)

    calendarService.setConfig({
      google: {
        clientId: process.env.VITE_GOOGLE_OAUTH_CLIENT_ID || '',
        clientSecret: process.env.VITE_GOOGLE_OAUTH_CLIENT_SECRET || '',
      },
      microsoft: {
        clientId: process.env.VITE_MICROSOFT_CLIENT_ID || '',
      },
    })

    logger.info('[Main] Core services registered successfully.');
  } catch (err: any) {
    logger.error({ err }, '[Main] Fatal error during core service initialization');
  }

  // ─── Deferred/Safe Module Loading ─────────────────────────────────

  // 1. ShadowLoop (with Native Fallback)
  try {
    // @ts-ignore
    const { ShadowLoop } = await import('./shadow-loop')
    const shadowLoop = new ShadowLoop()
    registry.registerService('shadowLoop', shadowLoop)
    logger.info('[Main] ShadowLoop module loaded successfully.')

    ipcMain.handle('autodev:shadow-loop-compile', async (_event, sourceCode: string) => {
      return await shadowLoop.compileInMemory(sourceCode)
    })
  } catch (err: any) {
    logger.warn({ err }, '[Main] ShadowLoop module missing. Mounting NativeShadowLoop fallback.')
    const nativeShadowLoop = new NativeShadowLoop()
    registry.registerService('shadowLoop', nativeShadowLoop)
    ipcMain.handle('autodev:shadow-loop-compile', async (_event, sourceCode: string) => {
      return await nativeShadowLoop.compileInMemory(sourceCode)
    })
  }

  // ─── Setup and Boot ───────────────────────────────────────────────

  registerIPCHandlers()
  setupEventListeners()

  memoryService.init()
  registerMemoryHandlers(memoryService)
  knowledgeService.init()
  calendarService.loadConnections()

  registerComputerUseHandlers()
  registerMonitoringHandlers(monitoringService, () => win)
  registerCalendarHandlers(calendarService, () => win)
  registerGmailHandlers(gmailService, () => win)
  registerDriveHandlers(driveService, () => win)
  registerGChatHandlers(gchatService, () => win)
  registerAutoDevHandlers(autoDevService, selfLearnService, () => win)
  registerWorkflowHandlers(workflowEngine, crmService, () => workflowAIService, () => win, transcriptWatcher)

  setInterval(async () => {
    try {
      const breaches = await workflowEngine.checkSLABreaches()
      for (const breach of breaches) workflowEngine.emit('sla:breach', breach)
    } catch {}
  }, 60_000)

  // Poll for offline WhatsApp queue generated by standalone autodev
  setInterval(() => {
    try {
      const qtPath = path.join(app.getPath('userData'), '.autodev-data');
      const qPath = path.join(qtPath, 'whatsapp-queue.json');
      if (fs.existsSync(qPath) && waService.getStatus().connected) {
        const msgs = JSON.parse(fs.readFileSync(qPath, 'utf8'));
        fs.unlinkSync(qPath);
        for (const msg of msgs) {
            waService.sendText(`${msg.phone}@s.whatsapp.net`, msg.message).catch(() => {});
        }
      }
    } catch {}
  }, 5000);

  const envApiKey = process.env.VITE_GEMINI_API_KEY
  if (envApiKey && !autoDevService.isRunning()) {
    autoDevService.setApiKey(envApiKey)
    autoDevService.on('notify-whatsapp', ({ phone, message }: any) => {
      if (waService.getStatus().connected) {
        waService.sendText(`${phone}@s.whatsapp.net`, message).catch(() => {})
      }
    })
    autoDevService.start()
    logger.info('[AutoDev] Auto-initialized with env API key')
  }

  createTray()
  createWindow()

  await waService.init()
  await calendarService.init()
  await transcriptWatcher.init()

  const restoredConns = calendarService.getConnections()
  if (restoredConns.some(c => c.isActive)) {
    logger.info('[Main] Restored Google connections found — starting calendar polling')
    calendarService.startPolling()
    transcriptWatcher.start()
  }

  const shouldAuto = await waService.shouldAutoConnect()
  if (shouldAuto) {
    const savedKey = await waService.getSavedApiKey()
    if (savedKey) initWhatsAppAgent(savedKey)
    else logger.warn('[WhatsApp] No saved API key — agent will not process messages until key is set from UI')

    logger.info('[WhatsApp] Auto-connecting...')
    waService.connect().catch((err: any) => logger.error({ err }, '[WhatsApp] Auto-connect failed'))
  }

  globalShortcut.register('CommandOrControl+M', () => {
    if (!flowWin) createFlowWindow()
    else {
      if (flowWin.isVisible()) flowWin.hide()
      else {
        flowWin.show()
        flowWin.focus()
        flowWin.webContents.send('flow-window-shown')
      }
    }
  })
})
