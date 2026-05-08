import type { MainRuntimeState } from './runtime-state';

export function createWhatsAppAgentInitializer(input: {
  modules: any;
  services: any;
  state: MainRuntimeState;
}) {
  const { modules, services, state } = input;

  return function initWhatsAppAgent(apiKey: string): void {
    services.memoryService.setApiKey(apiKey);
    services.workspaceAutomationService.setApiKey(apiKey);

    if (state.waAgent) {
      state.waAgent.updateApiKey(apiKey);
    } else {
      state.waAgent = new modules.WhatsAppAgent(
        services.waService,
        apiKey,
        services.memoryService,
        services.knowledgeService,
      );
      services.waService.on('message', ({ jid, senderNumber, text, isGroup, history }: any) => {
        void state.waAgent?.handleMessage(jid, senderNumber, text, isGroup, history);
      });
      services.waService.on('audio', ({ jid, senderNumber, buffer, isGroup, history }: any) => {
        void state.waAgent?.handleAudio(jid, senderNumber, buffer, isGroup, history);
      });
      services.waService.on('media', ({ jid, senderNumber, buffer, fileName, mimetype, text, isGroup, history }: any) => {
        void state.waAgent?.handleMedia(jid, senderNumber, buffer, fileName, mimetype, text, isGroup, history);
      });
    }

    state.waAgent.setGoogleServices(services.calendarService, services.gmailService, services.driveService, services.gchatService);
    state.waAgent.setWorkspaceAutomationService(services.workspaceAutomationService);
    state.waAgent.setWorkflowHubService(services.workflowHubService);
    state.waAgent.setDesktopAgentService(services.desktopAgentService);
    state.waAgent.setClipboardAssistant(services.clipboardAssistant);
    state.waAgent.setTaskScheduler(services.taskScheduler);
    state.waAgent.setMeetingWorkflowService(services.meetingWorkflowService);
    services.meetingWorkflowService.setApiKey(apiKey);
    state.currentGeminiApiKey = apiKey;

    startApiKeyBoundServices(apiKey, services, state, modules);
  };
}

function startApiKeyBoundServices(apiKey: string, services: any, state: MainRuntimeState, modules: any): void {
  services.proactiveService.setApiKey(apiKey);
  if (!services.proactiveService.isRunning()) services.proactiveService.start();
  const status = services.waService.getStatus() as { allowedNumbers?: string[] };
  services.dailyBriefingService.updateConfig({
    apiKey,
    ownerNumber: services.dailyBriefingService.getConfig().ownerNumber || status.allowedNumbers?.[0] || '',
  });
  services.desktopAgentService.setApiKey(apiKey);
  services.clipboardAssistant.updateApiKey(apiKey);
  void services.clipboardAssistant.start();

  if (!state.neuralOrganizer) {
    state.neuralOrganizer = new modules.NeuralOrganizerService({
      apiKey,
      notifyCallback: async (message: string) => notifyAllowedWhatsAppNumbers(services, message),
    });
    state.waAgent.setNeuralOrganizer(state.neuralOrganizer);
  } else {
    state.neuralOrganizer.updateApiKey(apiKey);
  }
}

async function notifyAllowedWhatsAppNumbers(services: any, message: string): Promise<void> {
  if (!services.waService.getStatus().connected) return;
  const allowedNumbers = (services.waService.getStatus() as { allowedNumbers?: string[] }).allowedNumbers || [];
  for (const number of allowedNumbers) {
    const jid = `${number.replace(/\D/g, '')}@s.whatsapp.net`;
    await services.waService.sendText(jid, message).catch(() => {});
  }
}
