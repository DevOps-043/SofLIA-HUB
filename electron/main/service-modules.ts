export async function loadMainServiceModules() {
  const { IntegratedBrowserService } = await import('../integrated-browser');
  const { registerIntegratedBrowserHandlers } = await import('../integrated-browser-handlers');
  const { DesktopContextService } = await import('../desktop-context/service');
  const { registerDesktopContextHandlers } = await import('../desktop-context-handlers');
  const { registerComputerUseHandlers } = await import('../computer-use-handlers');
  const { SkillWorkspaceService } = await import('../skill-workspace/service');
  const { registerSkillWorkspaceHandlers } = await import('../skill-workspace-handlers');
  const { registerPresentationProtocolHandler } = await import('../skill-workspace/protocol');
  const { setSkillWorkspaceService } = await import('../skill-workspace/shared-instance');
  const { WhatsAppService } = await import('../whatsapp-service');
  const { WhatsAppAgent } = await import('../whatsapp-agent');
  const { MonitoringService } = await import('../monitoring-service');
  const { registerMonitoringHandlers } = await import('../monitoring-handlers');
  const { CalendarService } = await import('../calendar-service');
  const { registerCalendarHandlers } = await import('../calendar-handlers');
  const { GmailService } = await import('../gmail-service');
  const { registerGmailHandlers } = await import('../gmail-handlers');
  const { DriveService } = await import('../drive-service');
  const { registerDriveHandlers } = await import('../drive-handlers');
  const { GChatService } = await import('../gchat-service');
  const { registerGChatHandlers } = await import('../gchat-handlers');
  const { ProactiveService } = await import('../proactive-service');
  const { DesktopAgentService } = await import('../desktop-agent-service');
  const { registerDesktopAgentHandlers } = await import('../desktop-agent-handlers');
  const { MemoryService } = await import('../memory-service');
  const { registerMemoryHandlers } = await import('../memory-handlers');
  const { KnowledgeService } = await import('../knowledge-service');
  const { UpdaterService } = await import('../updater-service');
  const { registerUpdaterHandlers } = await import('../updater-handlers');
  const { ClipboardAIAssistant } = await import('../clipboard-ai-assistant');
  const { TaskScheduler } = await import('../task-scheduler');
  const { NeuralOrganizerService } = await import('../neural-organizer');
  const { PathMemoryService } = await import('../path-memory-service');
  const { MenuManager } = await import('../menu-manager');
  const { registerMeetingHandlers } = await import('../meeting-handlers');
  const { createMeetingLiveService, registerMeetingLiveHandlers } = await import('../meeting-live-handlers');
  const { WorkspaceAutomationService } = await import('../workspace-automation-service');
  const { registerWorkspaceAutomationHandlers } = await import('../workspace-automation-handlers');
  const { PassiveSkillsService } = await import('../passive-skills/service');
  const { registerPassiveSkillsHandlers } = await import('../passive-skills-handlers');
  const { TelegramService } = await import('../telegram-service');
  const { registerTelegramHandlers } = await import('../telegram-handlers');
  const { CommunicationHubService } = await import('../communication-hub/service');
  const { registerCommunicationHubHandlers } = await import('../communication-hub-handlers');
  const { SofliaLearningService } = await import('../soflia-learning-service');
  const { MeetingStore } = await import('../meetings/meeting-store');
  const { MeetingSourceService } = await import('../meetings/meeting-source-service');
  const { MeetingAIService } = await import('../meetings/meeting-ai-service');
  const { MeetingReviewService } = await import('../meetings/meeting-review-service');
  const { MeetingSyncService } = await import('../meetings/meeting-sync-service');
  const { MeetingWorkflowService } = await import('../meetings/meeting-workflow-service');
  const { MeetingDetectionStore } = await import('../meetings/meeting-detection-store');
  const { MeetingPassiveDetectionService } = await import('../meetings/meeting-passive-detection-service');
  const { DailyBriefingService } = await import('../daily-briefing-service');
  const { backgroundHostService } = await import('../background-host-service');
  const { registerBackgroundHostHandlers } = await import('../background-host-handlers');
  const { remoteNodeService } = await import('../remote-node-service');
  const { registerRemoteNodeHandlers } = await import('../remote-node-handlers');
  const { dynamicToolService } = await import('../dynamic-tool-service');
  const { pythonRuntimeService } = await import('../python-runtime-service');
  const { registerVoicePassiveHandlers } = await import('../voice-passive-handlers');
  const { registerOrbIpcHandlers } = await import('../orb-ipc-handlers');
  const { pythonToolsService } = await import('../python-tools-service');
  const { registerPythonToolsHandlers } = await import('../python-tools-handlers');
  const { generateDailySummary } = await import('../summary-generator');
  await import('../agent-task-queue');

  return {
    IntegratedBrowserService, registerIntegratedBrowserHandlers,
    DesktopContextService, registerDesktopContextHandlers,
    SkillWorkspaceService, registerSkillWorkspaceHandlers, registerPresentationProtocolHandler,
    setSkillWorkspaceService,
    registerComputerUseHandlers, WhatsAppService, WhatsAppAgent, MonitoringService, registerMonitoringHandlers,
    CalendarService, registerCalendarHandlers, GmailService, registerGmailHandlers, DriveService, registerDriveHandlers,
    GChatService, registerGChatHandlers, ProactiveService, DesktopAgentService, registerDesktopAgentHandlers,
    MemoryService, registerMemoryHandlers, KnowledgeService, UpdaterService, registerUpdaterHandlers,
    ClipboardAIAssistant, TaskScheduler, NeuralOrganizerService, PathMemoryService, MenuManager,
    registerMeetingHandlers, createMeetingLiveService, registerMeetingLiveHandlers,
    WorkspaceAutomationService, registerWorkspaceAutomationHandlers,
    PassiveSkillsService, registerPassiveSkillsHandlers, TelegramService, registerTelegramHandlers,
    CommunicationHubService, registerCommunicationHubHandlers,
    SofliaLearningService,
    MeetingStore, MeetingSourceService, MeetingAIService, MeetingReviewService, MeetingSyncService,
    MeetingWorkflowService, MeetingDetectionStore, MeetingPassiveDetectionService, DailyBriefingService,
    backgroundHostService, registerBackgroundHostHandlers, remoteNodeService, registerRemoteNodeHandlers,
    dynamicToolService, pythonRuntimeService, registerVoicePassiveHandlers, registerOrbIpcHandlers,
    pythonToolsService, registerPythonToolsHandlers, generateDailySummary,
  };
}
