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
  const mediaInputService = new modules.MediaInputService();
  const desktopContextService = new modules.DesktopContextService();
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
    mediaInputService,
    desktopContextService,
    skillWorkspaceService,
    desktopAgentService,
    updaterService,
    clipboardAssistant,
    taskScheduler,
    pathMemoryService,
    proactiveService,
    workspaceAutomationService,
    meetingWorkflowService,
    meetingPassiveDetectionService,
    workflowHubService,
    dailyBriefingService,
    telegramService,
    communicationHubService,
    sofliaLearningService,
  };
}
