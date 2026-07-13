import { registerScreenCaptureHandlers } from './screen-capture-handlers';
import { logBootstrapError } from './bootstrap-steps';
import { recordDesktopTaskMemory } from '../memory/record-desktop-task';

export function registerPlatformHandlers(input: { modules: any; services: any; state: any }): void {
  const { modules, services, state } = input;
  registerScreenCaptureHandlers(logBootstrapError);
  modules.registerComputerUseHandlers();
  modules.registerBackgroundHostHandlers(modules.backgroundHostService);
  modules.registerRemoteNodeHandlers();
  modules.registerMonitoringHandlers(services.monitoringService, () => state.win);
  modules.registerCalendarHandlers(services.calendarService, () => state.win);
  modules.registerGmailHandlers(services.gmailService, () => state.win);
  modules.registerDriveHandlers(services.driveService, () => state.win);
  modules.registerGChatHandlers(services.gchatService, () => state.win);
  modules.registerDesktopAgentHandlers(services.desktopAgentService);
  // Skills ejecutables (Fase 3): el motor de ejecución con HITL es Workspace Automation.
  modules.registerMemoryHandlers(services.memoryService, {
    executeCustomTemplate: (payload: { templateId: string; input: Record<string, unknown> }) =>
      services.workspaceAutomationService.executeCustomTemplate(payload),
  });
  // Aprender de las tareas de escritorio: su resultado se guarda en la memoria
  // del usuario activo (mismo motor que chat/WhatsApp) para futuras mejoras.
  services.desktopAgentService.on('task-completed', (payload: unknown) =>
    recordDesktopTaskMemory(services.memoryService, payload as { task?: string; message?: string }, false));
  services.desktopAgentService.on('task-failed', (payload: unknown) =>
    recordDesktopTaskMemory(services.memoryService, payload as { task?: string; message?: string }, true));
  modules.registerUpdaterHandlers(services.updaterService, () => state.win);
  modules.registerMeetingHandlers(services.meetingWorkflowService);
  modules.registerWorkspaceAutomationHandlers(services.workspaceAutomationService);
  modules.registerWorkflowHubHandlers(services.workflowHubService);
  modules.registerTelegramHandlers(services.telegramService);
  modules.registerCommunicationHubHandlers(services.communicationHubService);
  modules.registerVoicePassiveHandlers(modules.pythonRuntimeService);
  modules.registerPythonToolsHandlers(modules.pythonToolsService);
  modules.registerOrbIpcHandlers({
    pythonRuntimeService: modules.pythonRuntimeService,
    getOrbWindow: () => state.orbWin,
    consumePendingWake: () => {
      const pending = state.pendingOrbWake === true;
      state.pendingOrbWake = false;
      return pending;
    },
  });
}

export async function initializeMainServices(input: {
  modules: any;
  services: any;
  state: any;
  controls: any;
  initWhatsAppAgent: (apiKey: string) => void;
  runOptionalStep: (name: string, fn: () => any) => Promise<any>;
  logBootstrapError: (scope: string, error: unknown) => void;
}): Promise<void> {
  const { modules, services, state, controls, initWhatsAppAgent, runOptionalStep } = input;
  await runOptionalStep('memoryService.init', () => services.memoryService.init());
  await runOptionalStep('knowledgeService.init', () => services.knowledgeService.init());
  await runOptionalStep('meetingWorkflowService.init', () => Promise.resolve(services.meetingWorkflowService.init()));
  await runOptionalStep('workspaceAutomationService.init', () => Promise.resolve(services.workspaceAutomationService.init()));
  await runOptionalStep('workflowHubService.init', () => Promise.resolve(services.workflowHubService.init()));
  await runOptionalStep('meetingPassiveDetectionService.init', () => services.meetingPassiveDetectionService.init());
  await runOptionalStep('pathMemoryService.init', () => services.pathMemoryService.init());
  await runOptionalStep('pathMemoryService.start', () => services.pathMemoryService.start());
  await runOptionalStep('updaterService.init', () => services.updaterService.init());
  await runOptionalStep('taskScheduler.init', () => services.taskScheduler.init());
  await runOptionalStep('clipboardAssistant.init', () => services.clipboardAssistant.init());
  await runOptionalStep('dailyBriefingService.init', () => services.dailyBriefingService.init());
  await runOptionalStep('communicationHubService.init', () => Promise.resolve(services.communicationHubService.init()));
  await runOptionalStep('waService.setCommunicationHubService', () => Promise.resolve(services.waService.setCommunicationHubService(services.communicationHubService)));
  await runOptionalStep('backgroundHostService.init', () => modules.backgroundHostService.init());
  await runOptionalStep('remoteNodeService.init', () => modules.remoteNodeService.initialize({ desktopAgent: services.desktopAgentService }));
  await runOptionalStep('telegramService.init', () => services.telegramService.init({
    workspaceAutomationService: services.workspaceAutomationService,
    workflowHubService: services.workflowHubService,
    remoteNodeService: modules.remoteNodeService,
    communicationHubService: services.communicationHubService,
  }));
  await runOptionalStep('sofliaLearningService.init', () => Promise.resolve(services.sofliaLearningService.init()));
  await runOptionalStep('dynamicToolService.init', () => modules.dynamicToolService.initialize());
  // Voz pasiva local (Vosk): al detectar la wake word se abre la orbe con
  // escucha automatica (pendingWake consumido por el renderer, sin race).
  modules.pythonRuntimeService.on('wake-word', () => {
    void runOptionalStep('orbWindow.wakeWord', () => controls.createOrbWindow(true));
  });
  await runOptionalStep('pythonRuntimeService.init', () => modules.pythonRuntimeService.init());
  await runOptionalStep('createWindow', () => controls.createWindow(state.shouldShowInitialWindow));
  await runOptionalStep('createTray', () => controls.createTray());
  if (state.currentGeminiApiKey) await runOptionalStep('initWhatsAppAgent(.env)', () => initWhatsAppAgent(state.currentGeminiApiKey));
  await runOptionalStep('waService.init', () => services.waService.init());
  await runOptionalStep('calendarService.init', () => services.calendarService.init());
  await runOptionalStep('meetingPassiveDetectionService.startPolling', () => Promise.resolve(services.meetingPassiveDetectionService.startPolling()));
  await tryAutoConnectWhatsApp({ services, initWhatsAppAgent, runOptionalStep });
}

async function tryAutoConnectWhatsApp(input: { services: any; initWhatsAppAgent: (apiKey: string) => void; runOptionalStep: (name: string, fn: () => any) => Promise<any> }): Promise<void> {
  const { services, initWhatsAppAgent, runOptionalStep } = input;
  const shouldAutoConnect = await runOptionalStep('waService.shouldAutoConnect', () => services.waService.shouldAutoConnect());
  if (!shouldAutoConnect) return;
  const savedKey = await runOptionalStep('waService.getSavedApiKey', () => services.waService.getSavedApiKey());
  if (savedKey) await runOptionalStep('initWhatsAppAgent(saved)', () => initWhatsAppAgent(savedKey));
  await runOptionalStep('waService.connect', () => services.waService.connect());
}
