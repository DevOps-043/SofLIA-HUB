import { app, BrowserWindow, Tray, Menu, Notification, nativeImage, ipcMain, screen, globalShortcut } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import * as dotenv from 'dotenv'
import { extractProtocolArg, parseAppProtocolCommand, type MeetingTriggerPayload } from './app-protocol'
import {
  captureForegroundWindow,
  restoreFlowInsertTarget,
  type FlowInsertTarget,
} from './flow-window/native-window-target'
import { registerScreenCaptureHandlers } from './main/screen-capture-handlers'

type BootstrapGuard = typeof globalThis & {
  __SOFLIA_BOOTSTRAP_COMPLETE__?: boolean
}

type Step<T> = () => Promise<T> | T
const BACKGROUND_LAUNCH_ARG = '--background'

function logBootstrapError(context: string, error: unknown): void {
  if (error instanceof Error) {
    console.error(`[BOOT] ${context} failed: ${error.message}`)
    if (error.stack) {
      console.error(error.stack)
    }
    return
  }

  console.error(`[BOOT] ${context} failed:`, error)
}

async function runOptionalStep<T>(name: string, step: Step<T>): Promise<T | undefined> {
  try {
    return await step()
  } catch (error) {
    logBootstrapError(name, error)
    return undefined
  }
}

const bootstrapGuard = globalThis as BootstrapGuard
if (bootstrapGuard.__SOFLIA_BOOTSTRAP_COMPLETE__) {
  console.log(`[BOOT] Duplicate bootstrap avoided in PID ${process.pid}`)
} else {
  bootstrapGuard.__SOFLIA_BOOTSTRAP_COMPLETE__ = true

  const gotTheLock = app.requestSingleInstanceLock()
  if (!gotTheLock) {
    console.log(`[BOOT] Second instance blocked for PID ${process.pid}`)
    app.exit(0)
  } else {
    runBootstrap().catch((error) => logBootstrapError('runBootstrap', error))
  }
}

async function runBootstrap(): Promise<void> {
  const {
    registerComputerUseHandlers,
  } = await import('./computer-use-handlers')
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
  const { registerMeetingHandlers } = await import('./meeting-handlers')
  const { WorkspaceAutomationService } = await import('./workspace-automation-service')
  const { registerWorkspaceAutomationHandlers } = await import('./workspace-automation-handlers')
  const { WorkflowHubService } = await import('./workflow-hub-service')
  const { registerWorkflowHubHandlers } = await import('./workflow-hub-handlers')
  const { TelegramService } = await import('./telegram-service')
  const { registerTelegramHandlers } = await import('./telegram-handlers')
  const { MeetingStore } = await import('./meetings/meeting-store')
  const { MeetingSourceService } = await import('./meetings/meeting-source-service')
  const { MeetingAIService } = await import('./meetings/meeting-ai-service')
  const { MeetingReviewService } = await import('./meetings/meeting-review-service')
  const { MeetingSyncService } = await import('./meetings/meeting-sync-service')
  const { MeetingWorkflowService } = await import('./meetings/meeting-workflow-service')
  const { MeetingDetectionStore } = await import('./meetings/meeting-detection-store')
  const { MeetingPassiveDetectionService } = await import('./meetings/meeting-passive-detection-service')
  const { DailyBriefingService } = await import('./daily-briefing-service')
  const { backgroundHostService } = await import('./background-host-service')
  const { registerBackgroundHostHandlers } = await import('./background-host-handlers')
  const { remoteNodeService } = await import('./remote-node-service')
  const { registerRemoteNodeHandlers } = await import('./remote-node-handlers')
  const { dynamicToolService } = await import('./dynamic-tool-service')
  const { generateDailySummary } = await import('./summary-generator')
  await import('./agent-task-queue')

  const __dirname = path.dirname(fileURLToPath(import.meta.url))

  const envPaths = [
    path.join(__dirname, '..', '.env'),
    path.join(__dirname, '.env'),
  ]

  for (const envPath of envPaths) {
    if (!dotenv.config({ path: envPath }).error) {
      console.log(`[BOOT] Environment loaded from ${envPath}`)
      break
    }
  }

  process.env.APP_ROOT = path.join(__dirname, '..')
  const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL
  const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')
  process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
    ? path.join(process.env.APP_ROOT, 'public')
    : RENDERER_DIST

  // Disabled because BrowserWindow creation has been unstable in this project on Windows.
  // app.enableSandbox()

  const waService = new WhatsAppService()
  const memoryService = new MemoryService()
  const knowledgeService = new KnowledgeService()
  const monitoringService = new MonitoringService()
  const calendarService = new CalendarService()
  const gmailService = new GmailService(calendarService)
  const driveService = new DriveService(calendarService)
  const gchatService = new GChatService(calendarService)
  const desktopAgentService = new DesktopAgentService()
  const updaterService = new UpdaterService()
  const clipboardAssistant = new ClipboardAIAssistant({
    maxHistorySize: 100,
    pollingIntervalMs: 5000,
  })
  const taskScheduler = new TaskScheduler()
  const pathMemoryService = new PathMemoryService()
  const proactiveService = new ProactiveService()
  const workspaceAutomationService = new WorkspaceAutomationService({
    gmailService,
    calendarService,
    gchatService,
    driveService,
    desktopAgentService,
  })
  const meetingStore = new MeetingStore()
  const meetingSourceService = new MeetingSourceService(driveService)
  const meetingAIService = new MeetingAIService()
  const meetingReviewService = new MeetingReviewService()
  const meetingSyncService = new MeetingSyncService(meetingStore)
  const meetingDetectionStore = new MeetingDetectionStore()
  const meetingWorkflowService = new MeetingWorkflowService(
    meetingStore,
    meetingSourceService,
    meetingAIService,
    meetingReviewService,
    meetingSyncService,
  )
  const meetingPassiveDetectionService = new MeetingPassiveDetectionService(
    calendarService,
    gmailService,
    driveService,
    meetingWorkflowService,
    meetingDetectionStore,
  )
  const workflowHubService = new WorkflowHubService({
    calendarService,
    gchatService,
    taskScheduler,
    workspaceAutomationService,
    meetingWorkflowService,
  })
  const dailyBriefingService = new DailyBriefingService({
    enabled: false,
    schedule: '0 8 * * 1-5',
    ownerNumber: '',
    apiKey: '',
  }, waService)
  const telegramService = new TelegramService()

  let win: BrowserWindow | null = null
  let flowWin: BrowserWindow | null = null
  let tray: Tray | null = null
  let isQuitting = false
  let flowInsertTarget: FlowInsertTarget | null = null
  const startInBackground = process.argv.includes(BACKGROUND_LAUNCH_ARG)
  const initialProtocolCommand = parseAppProtocolCommand(extractProtocolArg(process.argv))
  const shouldShowInitialWindow = !startInBackground && initialProtocolCommand?.type !== 'meeting-trigger'
  let pendingShareLink: string | null = initialProtocolCommand?.type === 'share-link'
    ? initialProtocolCommand.shareLink
    : null
  let pendingMeetingTrigger: MeetingTriggerPayload | null = initialProtocolCommand?.type === 'meeting-trigger'
    ? initialProtocolCommand.payload
    : null
  let currentGeminiApiKey: string | null = process.env.VITE_GEMINI_API_KEY || null
  let waAgent: InstanceType<typeof WhatsAppAgent> | null = null
  let neuralOrganizer: InstanceType<typeof NeuralOrganizerAI> | null = null
  workspaceAutomationService.setApiKey(currentGeminiApiKey)

  proactiveService.setCalendarService(calendarService)
  proactiveService.setWhatsAppService(waService)
  meetingPassiveDetectionService.setWhatsAppService(waService)

  meetingPassiveDetectionService.on('meeting-detected', (payload: any) => {
    win?.webContents.send('meeting:detected', payload)

    if (Notification.isSupported()) {
      new Notification({
        title: 'Nueva reunion detectada',
        body: `${payload.meetingTitle || payload.sourceFileName || 'Reunion sin titulo'} lista para revision HITL en Meeting Ops.`,
      }).show()
    }
  })

  taskScheduler.on('task-triggered', (data: any) => {
    if (data?.executionMode === 'workflow' && data?.workflowId) {
      void workflowHubService.executeWorkflow({
        workflowId: data.workflowId,
        requestedBy: data.requestedBy || 'scheduler',
        input: data.workflowInput || {},
      }).then((detail) => {
        const phoneNumber = String(data.phoneNumber || '').replace(/\D/g, '')
        if (!phoneNumber || !waService.getStatus().connected) {
          return
        }
        const jid = `${phoneNumber}@s.whatsapp.net`
        const message = [
          `Workflow pasivo ejecutado: ${detail.workflowName}`,
          `Caso: ${detail.title}`,
          `Estado: ${detail.normalizedStatus}`,
          detail.summary ? `Resumen: ${detail.summary}` : '',
        ].filter(Boolean).join('\n')
        return waService.sendText(jid, message)
      }).catch((error) => {
        console.error('[Main] Passive workflow execution failed:', error)
      })
      return
    }

    if (!waAgent || !waService.getStatus().connected) {
      return
    }

    const jid = `${String(data.phoneNumber || '').replace(/\D/g, '')}@s.whatsapp.net`
    void waAgent.handleScheduledTaskTrigger(jid, data.phoneNumber, data)
  })

  calendarService.setConfig({
    google: {
      clientId: process.env.VITE_GOOGLE_OAUTH_CLIENT_ID || '',
      clientSecret: process.env.VITE_GOOGLE_OAUTH_CLIENT_SECRET || '',
    },
    microsoft: {
      clientId: process.env.VITE_MICROSOFT_CLIENT_ID || '',
    },
  })

  calendarService.on('work-start', (data: any) => {
    console.log('[Main] Calendar work-start -> auto-start monitoring')
    win?.webContents.send('calendar:work-start', data)
  })

  calendarService.on('work-end', (data: any) => {
    console.log('[Main] Calendar work-end -> auto-stop monitoring')
    win?.webContents.send('calendar:work-end', data)
  })

  calendarService.on('connected', (data: any) => {
    if (data?.provider === 'google') {
      void meetingPassiveDetectionService.runScanNow().catch((error) => {
        console.error('[Main] meetingPassiveDetectionService.runScanNow after Google connect failed:', error)
      })
    }
  })

  monitoringService.on('session-ended', async (data: any) => {
    const snapshots = data.allSnapshots?.length ? data.allSnapshots : data.pendingSnapshots
    if (!currentGeminiApiKey || !snapshots?.length) {
      return
    }

    try {
      const summary = await generateDailySummary(
        currentGeminiApiKey,
        snapshots.map((snapshot: any) => ({
          timestamp:
            typeof snapshot.timestamp === 'string'
              ? snapshot.timestamp
              : new Date(snapshot.timestamp).toISOString(),
          windowTitle: snapshot.windowTitle || '',
          processName: snapshot.processName || '',
          url: snapshot.url,
          idle: snapshot.idle || false,
          idleSeconds: snapshot.idleSeconds || 0,
          ocrText: snapshot.ocrText,
          durationSeconds: 30,
        })),
        {
          startedAt: new Date().toISOString(),
          triggerType: 'manual',
        },
      )

      win?.webContents.send('monitoring:summary-generated', {
        userId: data.userId,
        sessionId: data.sessionId,
        summary,
      })
    } catch (error) {
      logBootstrapError('monitoring session summary', error)
    }
  })

  waService.on('qr', (qr: string) => {
    win?.webContents.send('whatsapp:qr', qr)
  })

  waService.on('status', (status: any) => {
    win?.webContents.send('whatsapp:status', status)
  })

  async function rememberFlowInsertTarget(): Promise<void> {
    const target = await captureForegroundWindow(logBootstrapError)
    if (!target) {
      flowInsertTarget = null
      return
    }

    const normalizedTitle = target.title.toLowerCase()
    if (normalizedTitle.includes('soflia hub')) {
      flowInsertTarget = null
      return
    }

    flowInsertTarget = target
  }

  async function createFlowWindow(): Promise<void> {
    await rememberFlowInsertTarget()

    if (flowWin) {
      flowWin.showInactive()
      flowWin.webContents.send('flow-window-shown')
      return
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
      show: false,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        additionalArguments: ['--view-mode=flow'],
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
      },
    })

    flowWin.setAlwaysOnTop(true, 'screen-saver')

    const primaryDisplay = screen.getPrimaryDisplay()
    const { width, height } = primaryDisplay.workAreaSize
    flowWin.setPosition(Math.floor(width / 2 - 300), Math.floor(height - 480))

    if (VITE_DEV_SERVER_URL) {
      void flowWin.loadURL(`${VITE_DEV_SERVER_URL}?view=flow`)
    } else {
      void flowWin.loadFile(path.join(RENDERER_DIST, 'index.html'), {
        query: { view: 'flow' },
      })
    }

    flowWin.once('ready-to-show', () => {
      flowWin?.showInactive()
      flowWin?.webContents.send('flow-window-shown')
    })

    flowWin.on('closed', () => {
      flowWin = null
    })

    flowWin.webContents.session.setPermissionRequestHandler((_webContents, permission, callback) => {
      if (permission === 'media') {
        callback(true)
        return
      }

      callback(false)
    })
  }

  function registerFlowShortcut(): void {
    const accelerator = 'CommandOrControl+M'
    globalShortcut.unregister(accelerator)

    const registered = globalShortcut.register(accelerator, () => {
      void createFlowWindow()
    })

    if (!registered) {
      console.warn(`[BOOT] No se pudo registrar el atajo global ${accelerator}`)
      return
    }

    console.log(`[BOOT] Atajo global registrado: ${accelerator} -> modo voz`)
  }

  function createTray(): void {
    if (tray) {
      return
    }

    const iconPath = path.join(process.env.VITE_PUBLIC!, 'assets/icono.ico')
    let trayIcon = nativeImage.createEmpty()

    try {
      const loadedIcon = nativeImage.createFromPath(iconPath)
      trayIcon = loadedIcon.isEmpty() ? nativeImage.createEmpty() : loadedIcon
    } catch {
      trayIcon = nativeImage.createEmpty()
    }

    tray = new Tray(trayIcon)
    tray.setToolTip('SofLIA Hub Desktop')

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Abrir SofLIA Hub',
        click: () => {
          if (!win) {
            createWindow(true)
            return
          }

          win.show()
          win.focus()
        },
      },
      {
        label: 'Modo voz',
        click: () => {
          void createFlowWindow()
        },
      },
      { type: 'separator' },
      {
        label: 'Salir',
        click: () => {
          isQuitting = true
          app.quit()
        },
      },
    ])

    tray.setContextMenu(contextMenu)
    tray.on('click', () => {
      if (!win) {
        createWindow(true)
        return
      }

      if (!win.isVisible()) {
        win.show()
      }
      win.focus()
    })
  }

  function createWindow(showWindow = !startInBackground): void {
    if (win) {
      if (showWindow) {
        win.show()
        win.focus()
      }
      return
    }

    win = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 700,
      minHeight: 500,
      icon: path.join(process.env.VITE_PUBLIC!, 'assets/icono.ico'),
      show: showWindow,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
      },
    })

    win.setMenu(null)

    win.on('close', (event) => {
      if (!isQuitting) {
        event.preventDefault()
        win?.hide()
      }
    })

    win.on('closed', () => {
      win = null
    })

    if (VITE_DEV_SERVER_URL) {
      void win.loadURL(VITE_DEV_SERVER_URL)
    } else {
      void win.loadFile(path.join(RENDERER_DIST, 'index.html'))
    }

    win.webContents.session.setPermissionRequestHandler((_webContents, permission, callback) => {
      if (permission === 'media') {
        callback(true)
        return
      }

      callback(false)
    })
  }

  function routeShareLinkToRenderer(shareLink: string): void {
    pendingShareLink = shareLink

    if (!win) {
      createWindow(true)
      return
    }

    if (win.isMinimized()) {
      win.restore()
    }
    if (!win.isVisible()) {
      win.show()
    }
    win.focus()
    win.webContents.send('app:share-link', shareLink)
  }

  function routeMeetingTriggerToRenderer(payload: MeetingTriggerPayload): void {
    pendingMeetingTrigger = payload

    if (!win) {
      createWindow(false)
      return
    }

    win.webContents.send('app:meeting-trigger', payload)

    if (!Notification.isSupported()) {
      return
    }

    const title = payload.meetingTitle || payload.meetingCode || 'Reunion detectada'
    const body = payload.action === 'stop'
      ? `${title}: la extension marco el cierre de la reunion.`
      : `${title}: la extension activo el seguimiento de trazabilidad.`

    new Notification({
      title: 'Workflow de reuniones',
      body,
    }).show()
  }

  async function sendSummaryWhatsApp(phoneNumber: string, summaryText: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!waService.getStatus().connected) {
        return { success: false, error: 'WhatsApp no conectado' }
      }

      const cleanNumber = phoneNumber.replace(/[^0-9]/g, '')
      const jid = `${cleanNumber}@s.whatsapp.net`
      await waService.sendText(jid, summaryText)
      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { success: false, error: message }
    }
  }

  function initWhatsAppAgent(apiKey: string): void {
    memoryService.setApiKey(apiKey)
    workspaceAutomationService.setApiKey(apiKey)

    if (waAgent) {
      waAgent.updateApiKey(apiKey)
    } else {
      waAgent = new WhatsAppAgent(waService, apiKey, memoryService, knowledgeService)
      waService.on('message', ({ jid, senderNumber, text, isGroup, history }: any) => {
        void waAgent?.handleMessage(jid, senderNumber, text, isGroup, history)
      })
      waService.on('audio', ({ jid, senderNumber, buffer, isGroup, history }: any) => {
        void waAgent?.handleAudio(jid, senderNumber, buffer, isGroup, history)
      })
      waService.on('media', ({ jid, senderNumber, buffer, fileName, mimetype, text, isGroup, history }: any) => {
        void waAgent?.handleMedia(jid, senderNumber, buffer, fileName, mimetype, text, isGroup, history)
      })
    }

    waAgent.setGoogleServices(calendarService, gmailService, driveService, gchatService)
    waAgent.setWorkspaceAutomationService(workspaceAutomationService)
    waAgent.setWorkflowHubService(workflowHubService)
    waAgent.setDesktopAgentService(desktopAgentService)
    waAgent.setClipboardAssistant(clipboardAssistant)
    waAgent.setTaskScheduler(taskScheduler)
    waAgent.setMeetingWorkflowService(meetingWorkflowService)
    meetingWorkflowService.setApiKey(apiKey)

    currentGeminiApiKey = apiKey

    proactiveService.setApiKey(apiKey)
    if (!proactiveService.isRunning()) {
      proactiveService.start()
    }

    const status = waService.getStatus() as { allowedNumbers?: string[] }
    dailyBriefingService.updateConfig({
      apiKey,
      ownerNumber: dailyBriefingService.getConfig().ownerNumber || status.allowedNumbers?.[0] || '',
    })

    desktopAgentService.setApiKey(apiKey)
    clipboardAssistant.updateApiKey(apiKey)
    void clipboardAssistant.start()

    if (!neuralOrganizer) {
      neuralOrganizer = new NeuralOrganizerAI({
        apiKey,
        notifyCallback: async (message: string) => {
          if (!waService.getStatus().connected) {
            return
          }

          const allowedNumbers = (waService.getStatus() as { allowedNumbers?: string[] }).allowedNumbers || []
          for (const number of allowedNumbers) {
            const jid = `${number.replace(/\D/g, '')}@s.whatsapp.net`
            await waService.sendText(jid, message).catch(() => {})
          }
        },
      })
      waAgent.setNeuralOrganizer(neuralOrganizer)
    } else {
      neuralOrganizer.updateApiKey(apiKey)
    }
  }

  ipcMain.handle('monitoring:generate-summary', async (_event, activities: any[], sessionInfo: any) => {
    if (!currentGeminiApiKey) {
      return { success: false, error: 'API key not configured' }
    }

    try {
      const summary = await generateDailySummary(currentGeminiApiKey, activities, sessionInfo)
      return { success: true, summary }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })

  ipcMain.handle('monitoring:send-summary-whatsapp', async (_event, phoneNumber: string, summaryText: string) => {
    return sendSummaryWhatsApp(phoneNumber, summaryText)
  })

  registerScreenCaptureHandlers(logBootstrapError)

  ipcMain.on('flow-send-to-chat', (_event, text: string) => {
    if (!win) {
      createWindow(true)
    }

    if (!win) {
      return
    }

    if (!win.isVisible()) {
      win.show()
    }
    if (win.isMinimized()) {
      win.restore()
    }

    win.focus()
    win.webContents.send('flow-message-received', text)
  })

  ipcMain.handle('flow:insert-text', async (_event, text: string) => {
    const normalizedText = String(text || '').trim()
    if (!normalizedText) {
      return { success: false, error: 'No hay texto para insertar.' }
    }

    if (!flowInsertTarget?.handle) {
      return { success: false, code: 'NO_TARGET', error: 'No hay un campo activo listo para dictado.' }
    }

    try {
      flowWin?.hide()
      await new Promise((resolve) => setTimeout(resolve, 140))
      await restoreFlowInsertTarget(flowInsertTarget, logBootstrapError)
      await new Promise((resolve) => setTimeout(resolve, 120))
      await desktopAgentService.keyboardType(normalizedText)
      return { success: true }
    } catch (error) {
      flowWin?.showInactive()
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })

  ipcMain.on('close-flow', () => {
    flowWin?.hide()
  })

  ipcMain.handle('whatsapp:connect', async () => {
    try {
      await waService.connect()
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })

  ipcMain.handle('whatsapp:disconnect', async () => {
    try {
      await waService.disconnect()
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })

  ipcMain.handle('whatsapp:get-status', async () => waService.getStatus())

  ipcMain.handle('whatsapp:set-allowed-numbers', async (_event, numbers: string[]) => {
    try {
      await waService.setAllowedNumbers(numbers)
      if (numbers.length > 0) {
        dailyBriefingService.updateConfig({ ownerNumber: numbers[0] })
      }
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })

  ipcMain.handle('whatsapp:set-group-config', async (_event, config: any) => {
    try {
      await waService.setGroupConfig(config)
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })

  ipcMain.handle('whatsapp:set-api-key', async (_event, apiKey: string) => {
    initWhatsAppAgent(apiKey)
    await waService.saveApiKey(apiKey)
    return { success: true }
  })

  ipcMain.handle('proactive:get-config', async () => proactiveService.getConfig())

  ipcMain.handle('proactive:update-config', async (_event, updates: any) => {
    try {
      proactiveService.updateConfig(updates)
      if (updates.notifyPhone) {
        dailyBriefingService.updateConfig({ ownerNumber: updates.notifyPhone })
      }
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })

  ipcMain.handle('proactive:trigger-now', async (_event, phoneNumber?: string) => {
    return proactiveService.triggerNow(phoneNumber)
  })

  ipcMain.handle('proactive:get-status', async () => ({
    running: proactiveService.isRunning(),
    config: proactiveService.getConfig(),
  }))

  ipcMain.handle('app:get-pending-share-link', async () => {
    const nextShareLink = pendingShareLink
    pendingShareLink = null
    return nextShareLink
  })

  ipcMain.handle('app:get-pending-meeting-trigger', async () => {
    const nextMeetingTrigger = pendingMeetingTrigger
    pendingMeetingTrigger = null
    return nextMeetingTrigger
  })

  app.on('second-instance', (_event, commandLine) => {
    const protocolCommand = parseAppProtocolCommand(extractProtocolArg(commandLine))
    if (protocolCommand?.type === 'share-link') {
      routeShareLinkToRenderer(protocolCommand.shareLink)
      return
    }

    if (protocolCommand?.type === 'meeting-trigger') {
      routeMeetingTriggerToRenderer(protocolCommand.payload)
      return
    }

    if (!win) {
      createWindow(true)
      return
    }

    if (win.isMinimized()) {
      win.restore()
    }
    if (!win.isVisible()) {
      win.show()
    }
    win.focus()
  })

  app.on('before-quit', () => {
    console.log('[BOOT] before-quit')
    isQuitting = true
    globalShortcut.unregisterAll()
    pathMemoryService.stop()
    void clipboardAssistant.stop()
    proactiveService.stop()
    meetingPassiveDetectionService.stopPolling()
    if (tray) {
      tray.destroy()
      tray = null
    }
  })

  app.on('window-all-closed', () => {
    console.log('[BOOT] window-all-closed')
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow(true)
      return
    }

    if (win) {
      win.show()
      win.focus()
    }
  })

  app.on('browser-window-created', () => {
    console.log('[BOOT] Browser window created')
  })

  app.on('render-process-gone', (_event, _webContents, details) => {
    console.error(`[BOOT] render-process-gone: ${details.reason} (exitCode=${details.exitCode})`)
  })

  app.on('child-process-gone', (_event, details) => {
    console.error(`[BOOT] child-process-gone: ${details.type} (${details.reason})`)
  })

  await app.whenReady()
  console.log('[BOOT] App ready. Initializing subsystems...')
  app.setAsDefaultProtocolClient('soflia')

  MenuManager.setup()
  registerFlowShortcut()
  registerComputerUseHandlers()
  registerBackgroundHostHandlers(backgroundHostService)
  registerRemoteNodeHandlers()
  registerMonitoringHandlers(monitoringService, () => win)
  registerCalendarHandlers(calendarService, () => win)
  registerGmailHandlers(gmailService, () => win)
  registerDriveHandlers(driveService, () => win)
  registerGChatHandlers(gchatService, () => win)
  registerDesktopAgentHandlers(desktopAgentService)
  registerMemoryHandlers(memoryService)
  registerUpdaterHandlers(updaterService, () => win)
  registerMeetingHandlers(meetingWorkflowService)
  registerWorkspaceAutomationHandlers(workspaceAutomationService)
  registerWorkflowHubHandlers(workflowHubService)
  registerTelegramHandlers(telegramService)

  await runOptionalStep('memoryService.init', () => memoryService.init())
  await runOptionalStep('knowledgeService.init', () => knowledgeService.init())
  await runOptionalStep('meetingWorkflowService.init', () => Promise.resolve(meetingWorkflowService.init()))
  await runOptionalStep('workspaceAutomationService.init', () => Promise.resolve(workspaceAutomationService.init()))
  await runOptionalStep('workflowHubService.init', () => Promise.resolve(workflowHubService.init()))
  await runOptionalStep('meetingPassiveDetectionService.init', () => meetingPassiveDetectionService.init())
  await runOptionalStep('pathMemoryService.init', () => pathMemoryService.init())
  await runOptionalStep('pathMemoryService.start', () => pathMemoryService.start())
  await runOptionalStep('updaterService.init', () => updaterService.init())
  await runOptionalStep('taskScheduler.init', () => taskScheduler.init())
  await runOptionalStep('clipboardAssistant.init', () => clipboardAssistant.init())
  await runOptionalStep('dailyBriefingService.init', () => dailyBriefingService.init())
  await runOptionalStep('backgroundHostService.init', () => backgroundHostService.init())
  await runOptionalStep('remoteNodeService.init', () => remoteNodeService.initialize({ desktopAgent: desktopAgentService }))
  await runOptionalStep('telegramService.init', () => telegramService.init({
    workspaceAutomationService,
    workflowHubService,
    remoteNodeService,
  }))
  await runOptionalStep('dynamicToolService.init', () => dynamicToolService.initialize())
  await runOptionalStep('createWindow', () => createWindow(shouldShowInitialWindow))
  await runOptionalStep('createTray', () => createTray())

  if (currentGeminiApiKey) {
    await runOptionalStep('initWhatsAppAgent(.env)', () => initWhatsAppAgent(currentGeminiApiKey!))
  }

  await runOptionalStep('waService.init', () => waService.init())
  await runOptionalStep('calendarService.init', () => calendarService.init())
  await runOptionalStep('meetingPassiveDetectionService.startPolling', () => Promise.resolve(meetingPassiveDetectionService.startPolling()))

  const shouldAutoConnect = await runOptionalStep('waService.shouldAutoConnect', () => waService.shouldAutoConnect())
  if (shouldAutoConnect) {
    const savedKey = await runOptionalStep('waService.getSavedApiKey', () => waService.getSavedApiKey())
    if (savedKey) {
      await runOptionalStep('initWhatsAppAgent(saved)', () => initWhatsAppAgent(savedKey))
    }
    await runOptionalStep('waService.connect', () => waService.connect())
  }
}
