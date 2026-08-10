export function createMainServices(modules: any) {
  const waService = new modules.WhatsAppService();
  const memoryService = new modules.MemoryService();
  const knowledgeService = new modules.KnowledgeService();
  const monitoringService = new modules.MonitoringService();
  const calendarService = new modules.CalendarService();
  const gmailService = new modules.GmailService(calendarService);
  const driveService = new modules.DriveService(calendarService);
  const gchatService = new modules.GChatService(calendarService);
  const integratedBrowserService = new modules.IntegratedBrowserService();
  const skillWorkspaceService = new modules.SkillWorkspaceService();
  const desktopAgentService = new modules.DesktopAgentService(integratedBrowserService);
  const updaterService = new modules.UpdaterService();
  const clipboardAssistant = new modules.ClipboardAIAssistant({ maxHistorySize: 100, pollingIntervalMs: 5000 });
  const taskScheduler = new modules.TaskScheduler();
  const pathMemoryService = new modules.PathMemoryService();
  const proactiveService = new modules.ProactiveService();
  const workspaceAutomationService = new modules.WorkspaceAutomationService({
    gmailService,
    calendarService,
    gchatService,
    driveService,
    desktopAgentService,
  });
  const meetingStore = new modules.MeetingStore();
  const meetingSourceService = new modules.MeetingSourceService(driveService);
  const meetingAIService = new modules.MeetingAIService();
  const meetingReviewService = new modules.MeetingReviewService();
  const meetingSyncService = new modules.MeetingSyncService(meetingStore);
  const meetingDetectionStore = new modules.MeetingDetectionStore();
  const meetingWorkflowService = new modules.MeetingWorkflowService(
    meetingStore,
    meetingSourceService,
    meetingAIService,
    meetingReviewService,
    meetingSyncService,
  );
  // SDO-AN: al aprobar minutas/acciones, el resultado aprobado se registra en
  // el Registro Operativo Gobernado (no bloqueante para el flujo de meetings).
  const sdoService = new modules.SdoService();
  meetingWorkflowService.setSdoAdapter({
    onAssetApproved: (detail: unknown, decidedByUserId: string) =>
      modules.registrarAprobacionAsset(sdoService, detail, decidedByUserId),
    onActionsApproved: (detail: unknown, decidedByUserId: string) =>
      modules.registrarAprobacionAcciones(sdoService, detail, decidedByUserId),
  });
  const meetingPassiveDetectionService = new modules.MeetingPassiveDetectionService(
    calendarService,
    gmailService,
    driveService,
    meetingWorkflowService,
    meetingDetectionStore,
  );
  const workflowHubService = new modules.WorkflowHubService({
    calendarService,
    gchatService,
    taskScheduler,
    workspaceAutomationService,
    meetingWorkflowService,
  });
  const dailyBriefingService = new modules.DailyBriefingService({
    enabled: false,
    schedule: '0 8 * * 1-5',
    ownerNumber: '',
    apiKey: '',
  }, waService);
  // Alertas de vigencia del SDO por WhatsApp: reutiliza el ownerNumber del
  // briefing diario (el duenio del Hub). Sin owner o sin conexion, solo log.
  sdoService.on('alerta-vigencia', (payload: { mensaje: string }) => {
    void (async () => {
      try {
        const ownerNumber = dailyBriefingService.getConfig?.()?.ownerNumber;
        if (!ownerNumber || !waService.isConnected?.()) {
          console.log('[SDO] Alerta de vigencia (sin canal WhatsApp configurado):\n' + payload.mensaje);
          return;
        }
        const jid = ownerNumber.includes('@') ? ownerNumber : `${ownerNumber.replace(/\D/g, '')}@s.whatsapp.net`;
        await waService.sendText(jid, payload.mensaje);
      } catch (error) {
        console.warn('[SDO] No pude enviar la alerta de vigencia por WhatsApp:', error);
      }
    })();
  });
  const telegramService = new modules.TelegramService();
  const communicationHubService = new modules.CommunicationHubService({
    waService,
    telegramService,
    remoteNodeService: modules.remoteNodeService,
  });
  const sofliaLearningService = new modules.SofliaLearningService();

  return {
    waService,
    memoryService,
    knowledgeService,
    monitoringService,
    calendarService,
    gmailService,
    driveService,
    gchatService,
    integratedBrowserService,
    skillWorkspaceService,
    desktopAgentService,
    updaterService,
    clipboardAssistant,
    taskScheduler,
    pathMemoryService,
    proactiveService,
    workspaceAutomationService,
    meetingWorkflowService,
    sdoService,
    meetingPassiveDetectionService,
    workflowHubService,
    dailyBriefingService,
    telegramService,
    communicationHubService,
    sofliaLearningService,
  };
}
