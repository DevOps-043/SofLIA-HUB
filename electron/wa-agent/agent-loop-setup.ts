import { WA_MODEL } from './constants';
import { prepareWhatsAppConversationHistory } from './conversation-history';
import { buildWhatsAppAgentPromptContext } from './system-prompt-context';
import { buildWhatsAppToolDeclarations } from './tool-declarations';
import { classifyEvidenceRequirement, detectActionRequest } from '../whatsapp-prompts';
import type { AgentLoopRequest, AgentLoopState } from './agent-loop-types';

export async function createAgentLoopState(request: AgentLoopRequest): Promise<AgentLoopState | string> {
  const promptContext = await buildWhatsAppAgentPromptContext({
    calendarService: request.agent.calendarService,
    whatsappConfig: request.agent.waService.config,
    memory: request.agent.memory,
    knowledge: request.agent.knowledge,
    jid: request.jid,
    senderNumber: request.senderNumber,
    userMessage: request.userMessage,
    isGroup: request.isGroup,
    groupPassiveHistory: request.groupPassiveHistory,
  });
  if (promptContext.sensitiveBlockResponse) return promptContext.sensitiveBlockResponse;

  const evidenceRequirement = classifyEvidenceRequirement(request.userMessage);
  const systemPrompt = appendEvidenceDirective(promptContext.systemPrompt, evidenceRequirement);
  const model = request.agent.getGenAI().getGenerativeModel({
    model: WA_MODEL,
    systemInstruction: systemPrompt,
    tools: [await buildWhatsAppToolDeclarations({
      isGroup: request.isGroup,
      senderNumber: request.senderNumber,
      whatsappConfig: request.agent.waService.config,
    }) as any],
  });
  const historyCopy = prepareWhatsAppConversationHistory({
    conversations: request.conversations,
    sessionKey: promptContext.sessionKey,
    userMessage: request.userMessage,
    loadPersistedHistory: () => request.agent.memory.getConversationHistory(promptContext.sessionKey, 30),
  });
  const chatSession = startChatSafely(model, historyCopy, request.conversations, promptContext.sessionKey);
  const response = await sendInitialMessage(chatSession, request);

  return {
    ...request,
    chatSession,
    response,
    sessionKey: promptContext.sessionKey,
    historyCopy,
    requirements: buildRequirements(evidenceRequirement),
    evidence: { local: false, visual: false, remote: false },
    isActionRequest: detectActionRequest(request.userMessage),
    toolLoopTrace: [],
    loopGuardInterventions: 0,
  };
}

function startChatSafely(model: any, history: any[], conversations: Map<string, any[]>, sessionKey: string) {
  try {
    return model.startChat({ history, generationConfig: { maxOutputTokens: 4096 } });
  } catch (error: any) {
    console.warn(`[WhatsApp Agent] Corrupted history for ${sessionKey}, resetting:`, error.message);
    conversations.set(sessionKey, []);
    return model.startChat({ history: [], generationConfig: { maxOutputTokens: 4096 } });
  }
}

async function sendInitialMessage(chatSession: any, request: AgentLoopRequest) {
  const prefix = request.inlineMediaParts.length === 0 && detectActionRequest(request.userMessage)
    ? '[INSTRUCCION DEL SISTEMA: El usuario solicita una ACCION NUEVA. DEBES usar herramientas para ejecutarla AHORA.]\n\n'
    : '';
  const effectiveMessage = prefix + request.userMessage;
  const message = request.inlineMediaParts.length > 0
    ? [...request.inlineMediaParts, effectiveMessage]
    : effectiveMessage;
  try {
    return await chatSession.sendMessage(message);
  } catch (error: any) {
    if (!String(error.message || '').match(/history|content|400/i)) throw error;
    console.warn('[WhatsApp Agent] Retrying sendMessage with empty history');
    const freshSession = chatSession.model?.startChat?.({ history: [], generationConfig: { maxOutputTokens: 4096 } }) || chatSession;
    return freshSession.sendMessage(message);
  }
}

function buildRequirements(requirement: string) {
  return {
    local: ['local', 'local_then_remote', 'local_visual', 'local_visual_then_remote'].includes(requirement),
    visual: ['local_visual', 'local_visual_then_remote'].includes(requirement),
    remote: ['remote', 'local_then_remote', 'local_visual_then_remote'].includes(requirement),
  };
}

function appendEvidenceDirective(systemPrompt: string, requirement: string): string {
  if (requirement === 'none') return systemPrompt;
  return `${systemPrompt}\n\nVALIDACION DE EVIDENCIA: requirement="${requirement}". Reune evidencia del entorno correcto antes de concluir. Si se pide revisar una app local, pantalla o ventana, usa evidencia visual real; shell, Git o web no sustituyen esa inspeccion.`;
}
