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

      const logBootstrapError = (step: string, err: unknown) => {
        if (err instanceof Error) {
          console.error(`[BOOT] ${step} failed:`, err.stack || err.message)
          return
        }
        console.error(`[BOOT] ${step} failed:`, err)
      }

      const runOptionalStep = async <T>(step: string, fn: () => Promise<T> | T): Promise<T | undefined> => {
        try {
          return await fn()
        } catch (err) {
          logBootstrapError(step, err)
          return undefined
        }
      }

      const initWhatsAppAgent = (apiKey: string) => {
        memoryService.setApiKey(apiKey)
        if (!waAgent) {
          waAgent = new WhatsAppAgent(waService, apiKey, memoryService, knowledgeService)
          waAgent.setSelfLearnService(selfLearnService)
          waService.on('message', (d: any) => {
            selfLearnService.analyzeUserMessage(d.text, 'whatsapp', { jid: d.jid, senderNumber: d.senderNumber })
            waAgent.handleMessage(d.jid, d.senderNumber, d.text, d.isGroup, d.history)
          })
          waService.on('audio', (d: any) => waAgent.handleAudio(d.jid, d.senderNumber, d.buffer, d.isGroup, d.history))
          waService.on('media', (d: any) => waAgent.handleMedia(d.jid, d.senderNumber, d.buffer, d.fileName, d.mimetype, d.text, d.isGroup, d.history))
        } else {
          waAgent.updateApiKey(apiKey)
        }
        waAgent.setGoogleServices(calendarService, gmailService, driveService, gchatService)
        waAgent.setAutoDevService(autoDevService)
        waAgent.setDesktopAgentService(desktopAgentService)
        waAgent.setClipboardAssistant(clipboardAssistant)
        waAgent.setTaskScheduler(taskScheduler)
        proactiveService.setApiKey(apiKey)
        if (!proactiveService.isRunning()) proactiveService.start()
        autoDevService.setApiKey(apiKey)
        desktopAgentService.setApiKey(apiKey)
        clipboardAssistant.updateApiKey(apiKey)
        clipboardAssistant.start()
        if (!neuralOrganizer) {
          neuralOrganizer = new NeuralOrganizerAI({
            apiKey,
            notifyCallback: async (msg: string) => {
              const numbers = (waService.getStatus() as any).allowedNumbers || []
              for (const num of numbers) waService.sendText(`${num.replace(/\D/g, '')}@s.whatsapp.net`, msg).catch(() => {})
            }
          })
          waAgent.setNeuralOrganizer(neuralOrganizer)
        } else neuralOrganizer.updateApiKey(apiKey)
        if (!autoDevService.isRunning()) autoDevService.start()
      }

      const createWindow = async () => {
        console.log('[BOOT] Creating main window...')
        const iconPath = path.join(process.env.VITE_PUBLIC, 'assets', 'icono.ico');
        
        if (process.platform === 'win32') {
          app.setAppUserModelId('com.pulsehub.sofliahub');
        }

        win = new BrowserWindow({
          width: 1200, height: 800,
          title: 'SofLIA Hub',
          icon: iconPath,
          webPreferences: { 
            preload: path.join(__dirname, 'preload.mjs'), 
            sandbox: false, 
            contextIsolation: true, 
            nodeIntegration: false 
          }
        })
        win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
          if (!isMainFrame) return
          console.error(`[BOOT] Renderer failed to load (${errorCode}): ${errorDescription} | ${validatedURL}`)
        })
        win.webContents.on('render-process-gone', (_event, details) => {
          console.error(`[BOOT] Renderer process gone: ${details.reason} (exitCode=${details.exitCode})`)
        })
        win.on('closed', () => {
          win = null
          console.log('[BOOT] Main window closed')
        })
        win.on('close', (e) => { if (!isQuitting) { e.preventDefault(); win?.hide(); } })
        if (VITE_DEV_SERVER_URL) {
          await win.loadURL(VITE_DEV_SERVER_URL)
        } else {
          await win.loadFile(path.join(process.env.APP_ROOT, 'dist', 'index.html'))
        }
        console.log('[BOOT] Main window loaded')
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
