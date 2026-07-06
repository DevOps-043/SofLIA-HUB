import { resolveWhatsAppOwnerKey } from './whatsapp-owner';
import type { ToolExecutorContext } from '../whatsapp-tool-executor';
import type { AgentLoopState } from './agent-loop-types';

export function buildToolContext(state: AgentLoopState): ToolExecutorContext {
  return {
    waService: state.agent.waService,
    calendarService: state.agent.calendarService,
    gmailService: state.agent.gmailService,
    driveService: state.agent.driveService,
    gchatService: state.agent.gchatService,
    desktopAgent: state.agent.desktopAgent,
    clipboardAssistant: state.agent.clipboardAssistant,
    taskScheduler: state.agent.taskScheduler,
    neuralOrganizer: state.agent.neuralOrganizer,
    smartSearch: state.agent.smartSearch,
    memory: state.agent.memory,
    knowledge: state.agent.knowledge,
    communicationHub: state.agent.communicationHubService,
    workspaceAutomation: state.agent.workspaceAutomationService
      ? { executeCustomTemplate: (payload) => state.agent.workspaceAutomationService!.executeCustomTemplate(payload) }
      : null,
    ownerKey: resolveWhatsAppOwnerKey(state.senderNumber, state.isGroup),
    getGenAI: () => state.agent.getGenAI(),
    skipConfirmations: state.options.skipConfirmations === true,
    requestConfirmation: (jid, sender, tool, desc, args) =>
      state.requestConfirmation(jid, sender, tool, desc, args),
  };
}
