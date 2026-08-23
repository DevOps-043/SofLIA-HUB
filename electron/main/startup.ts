import { registerScreenCaptureHandlers } from './screen-capture-handlers';
import { logBootstrapError } from './bootstrap-steps';
import { bindBrowserProfileToSession } from './browser-session-scope';
import { recordDesktopTaskMemory } from '../memory/record-desktop-task';
import { transcribeChannelAudio } from '../wa-agent/audio-transcription';
import { registerProjectHubHandlers } from '../project-hub-handlers';
import { getProjectHubApiService } from '../project-hub';

type StartupWindowControls = {
  createOrbWindow: (wake?: boolean) => Promise<void>;
  orbAnnouncements: import('./orb-announcements').OrbAnnouncements;
};

type OptionalStepRunner = <T>(name: string, fn: () => T | Promise<T>) => Promise<T>;

type WhatsAppStartupServices = {
  waService: {
    shouldAutoConnect: () => Promise<boolean>;
    getSavedApiKey: () => Promise<string | null>;
    connect: () => Promise<unknown>;
  };
};

export function registerPlatformHandlers(input: { modules: any; services: any; state: any; controls: StartupWindowControls }): void {
  const { modules, services, state, controls } = input;
  registerScreenCaptureHandlers(logBootstrapError);
  modules.registerComputerUseHandlers();
  modules.registerBackgroundHostHandlers(modules.backgroundHostService);
  modules.registerRemoteNodeHandlers();
  modules.registerMonitoringHandlers(services.monitoringService, () => state.win);
  modules.registerCalendarHandlers(services.calendarService, () => state.win);
  modules.registerGmailHandlers(services.gmailService, () => state.win);
  modules.registerDriveHandlers(services.driveService, () => state.win);
  modules.registerGChatHandlers(services.gchatService, () => state.win);
  modules.registerIntegratedBrowserHandlers(services.integratedBrowserService, () => state.win);
  registerProjectHubHandlers(getProjectHubApiService(), () => state.win);
  // El navegador integrado sigue al usuario con sesion: cada cuenta tiene su
  // propio perfil (cookies, historial, contrasenas, permisos y extensiones) y al
  // cerrar sesion se derriba la navegacion en curso.
  bindBrowserProfileToSession(services.integratedBrowserService);
  // Contexto de aplicaciones abiertas: el chat lee lo que el usuario ya tiene
  // delante. Solo se registra si la capacidad esta activa.
  modules.registerDesktopContextHandlers(services.desktopContextService, () => state.win);
  // Espacio de trabajo de Skills y protocolo local de presentaciones. El
  // protocolo se registra aqui (post `app.ready`); el ESQUEMA se declara
  // antes de ready en el bootstrap, que es donde Electron lo exige.
  // El agente de WhatsApp entra por su propia cadena de comandos y no recibe
  // servicios por inyeccion: comparte esta instancia para no abrir un segundo
  // indice sobre el mismo directorio.
  modules.setSkillWorkspaceService(services.skillWorkspaceService);
  modules.registerSkillWorkspaceHandlers(services.skillWorkspaceService, () => state.win);
  modules.registerPresentationProtocolHandler(services.skillWorkspaceService);
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
  // Transcripcion de reuniones en vivo: audio del renderer -> sidecar Python
  // (faster-whisper) -> pipeline de meetings existente para la minuta.
  modules.registerMeetingLiveHandlers(
    modules.createMeetingLiveService(modules.pythonRuntimeService),
    services.meetingWorkflowService,
  );
  modules.registerWorkspaceAutomationHandlers(services.workspaceAutomationService);
  modules.registerPassiveSkillsHandlers(services.passiveSkillsService);
  modules.registerTelegramHandlers(services.telegramService);
  modules.registerCommunicationHubHandlers(services.communicationHubService);
  modules.registerVoicePassiveHandlers(modules.pythonRuntimeService);
  modules.registerPythonToolsHandlers(modules.pythonToolsService);
  modules.registerOrbIpcHandlers({
    pythonRuntimeService: modules.pythonRuntimeService,
    getOrbWindow: () => state.orbWin,
    getMainWindow: () => state.win,
    showOrbWindow: () => controls.createOrbWindow(false),
    consumePendingWake: () => {
      const pending = state.pendingOrbWake === true;
      state.pendingOrbWake = false;
      return pending;
    },
    announcements: controls.orbAnnouncements,
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
    remoteNodeService: modules.remoteNodeService,
    communicationHubService: services.communicationHubService,
    // Telegram ofrece Skills; quien las ejecuta es el mismo bucle de agente que
    // atiende WhatsApp, que es el unico que corre en main sin ventana abierta.
    // El chat se identifica con un jid sintetico para que su historial quede
    // separado del de cualquier conversacion de WhatsApp.
    runSkillTurn: ({ chatId, prompt, isGroup }: { chatId: string; prompt: string; isGroup: boolean }) => {
      if (!state.waAgent) return Promise.resolve('El agente todavia no esta listo. Intentalo en unos segundos.');
      return state.waAgent.runSkillTurn(`telegram:${chatId}`, `telegram:${chatId}`, prompt, isGroup);
    },
    // Telegram transporta el audio; con que se transcribe lo decide el arranque,
    // igual que quien ejecuta las Skills.
    transcribeAudio: (audio: Buffer, mimetype: string) => {
      if (!state.waAgent) return Promise.resolve('');
      return transcribeChannelAudio(state.waAgent.getGenAI(), audio, mimetype);
    },
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

async function tryAutoConnectWhatsApp(input: { services: WhatsAppStartupServices; initWhatsAppAgent: (apiKey: string) => void; runOptionalStep: OptionalStepRunner }): Promise<void> {
  const { services, initWhatsAppAgent, runOptionalStep } = input;
  const shouldAutoConnect = await runOptionalStep('waService.shouldAutoConnect', () => services.waService.shouldAutoConnect());
  if (!shouldAutoConnect) return;
  const savedKey = await runOptionalStep('waService.getSavedApiKey', () => services.waService.getSavedApiKey());
  if (savedKey) await runOptionalStep('initWhatsAppAgent(saved)', () => initWhatsAppAgent(savedKey));
  await runOptionalStep('waService.connect', () => services.waService.connect());
}
