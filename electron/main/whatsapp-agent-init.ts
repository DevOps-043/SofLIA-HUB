import type { MainRuntimeState } from './runtime-state';

/**
 * Registra el fallo de un turno del agente en lugar de descartarlo.
 *
 * Estos manejadores se disparan desde un listener de eventos: una promesa
 * rechazada aqui no tiene dueno y desaparecia sin dejar rastro, que es como
 * un error de envio terminaba viendose como silencio del agente.
 */
function reportUnhandled(result: Promise<unknown> | undefined, stage: string): void {
  void Promise.resolve(result).catch((error) => {
    console.error(`[WhatsApp Agent] Turno fallido (${stage}):`, error);
  });
}

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
        reportUnhandled(state.waAgent?.handleMessage(jid, senderNumber, text, isGroup, history), 'mensaje de texto');
      });
      services.waService.on('audio', ({ jid, senderNumber, buffer, isGroup, history }: any) => {
        reportUnhandled(state.waAgent?.handleAudio(jid, senderNumber, buffer, isGroup, history), 'nota de voz');
      });
      services.waService.on('media', ({ jid, senderNumber, buffer, fileName, mimetype, text, isGroup, history }: any) => {
        reportUnhandled(state.waAgent?.handleMedia(jid, senderNumber, buffer, fileName, mimetype, text, isGroup, history), 'archivo');
      });
      // Baileys entrega la senalizacion de la llamada pero no su audio, asi que
      // el transporte ya la rechazo: aqui solo se reconduce al modo llamada.
      services.waService.on('call-offer', ({ jid, senderNumber }: any) => {
        reportUnhandled(state.waAgent?.handleIncomingCall(jid, senderNumber), 'llamada entrante');
      });
    }

    state.waAgent.setGoogleServices(services.calendarService, services.gmailService, services.driveService, services.gchatService);
    state.waAgent.setWorkspaceAutomationService(services.workspaceAutomationService);
    state.waAgent.setPassiveSkillsService(services.passiveSkillsService);
    state.waAgent.setCommunicationHubService(services.communicationHubService);
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
  const status = services.waService.getStatus() as { masterNumber?: string; allowedNumbers?: string[] };
  services.dailyBriefingService.updateConfig({
    apiKey,
    ownerNumber: services.dailyBriefingService.getConfig().ownerNumber || status.masterNumber || status.allowedNumbers?.[0] || '',
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
  const status = services.waService.getStatus() as { masterNumber?: string; allowedNumbers?: string[] };
  const recipients = Array.from(new Set([status.masterNumber, ...(status.allowedNumbers || [])].filter((value): value is string => Boolean(value))));
  for (const number of recipients) {
    const jid = `${number.replace(/\D/g, '')}@s.whatsapp.net`;
    await services.waService.sendText(jid, message).catch(() => {});
  }
}
