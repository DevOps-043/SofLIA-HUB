import { WA_MODEL, WA_MODEL_FALLBACKS } from './constants';
import { prepareWhatsAppConversationHistory } from './conversation-history';
import { buildWhatsAppAgentPromptContext } from './system-prompt-context';
import { buildWhatsAppToolDeclarations } from './tool-declarations';
import { isModelAvailabilityError } from './agent-errors';
import { classifyEvidenceRequirement, detectActionRequest } from '../whatsapp-prompts';
import type { AgentLoopRequest, AgentLoopState } from './agent-loop-types';

export async function createAgentLoopState(request: AgentLoopRequest): Promise<AgentLoopState | string> {
  if (!String(request.agent.apiKey || '').trim()) {
    throw new Error('API key de Gemini no configurada para WhatsApp.');
  }

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
  const tools = [await buildWhatsAppToolDeclarations({
    isGroup: request.isGroup,
    senderNumber: request.senderNumber,
    whatsappConfig: request.agent.waService.config,
  }) as any];
  const historyCopy = prepareWhatsAppConversationHistory({
    conversations: request.conversations,
    sessionKey: promptContext.sessionKey,
    userMessage: request.userMessage,
    loadPersistedHistory: () => request.agent.memory.getConversationHistory(promptContext.sessionKey, 30),
  });
  const modelConversation = await createModelConversation({
    request,
    systemPrompt,
    tools,
    historyCopy,
    sessionKey: promptContext.sessionKey,
  });

  return {
    ...request,
    chatSession: modelConversation.chatSession,
    response: modelConversation.response,
    sessionKey: promptContext.sessionKey,
    historyCopy,
    requirements: buildRequirements(evidenceRequirement),
    evidence: { local: false, visual: false, remote: false },
    isActionRequest: detectActionRequest(request.userMessage),
    toolLoopTrace: [],
    loopGuardInterventions: 0,
  };
}

async function createModelConversation(input: {
  request: AgentLoopRequest;
  systemPrompt: string;
  tools: any[];
  historyCopy: any[];
  sessionKey: string;
}) {
  let lastModelError: unknown = null;
  for (const modelName of getWhatsAppModelCandidates()) {
    try {
      const model = input.request.agent.getGenAI().getGenerativeModel({
        model: modelName,
        systemInstruction: input.systemPrompt,
        tools: input.tools,
      });
      const chatSession = startChatSafely(model, input.historyCopy, input.request.conversations, input.sessionKey);
      const initial = await sendInitialMessage(model, chatSession, input.request, input.request.conversations, input.sessionKey);
      if (modelName !== WA_MODEL) {
        console.warn(`[WhatsApp Agent] Using Gemini fallback model "${modelName}" for WhatsApp.`);
      }
      return initial;
    } catch (error) {
      if (!isModelAvailabilityError(error)) throw error;
      lastModelError = error;
      console.warn(`[WhatsApp Agent] Gemini model "${modelName}" unavailable for WhatsApp. Trying fallback if available.`);
    }
  }
  throw lastModelError || new Error('No hay modelos Gemini disponibles para WhatsApp.');
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

async function sendInitialMessage(
  model: any,
  chatSession: any,
  request: AgentLoopRequest,
  conversations: Map<string, any[]>,
  sessionKey: string,
) {
  const prefix = request.inlineMediaParts.length === 0 && detectActionRequest(request.userMessage)
    ? '[INSTRUCCION DEL SISTEMA: El usuario solicita una ACCION NUEVA. DEBES usar herramientas para ejecutarla AHORA.]\n\n'
    : '';
  const effectiveMessage = prefix + request.userMessage;
  const message = request.inlineMediaParts.length > 0
    ? [...request.inlineMediaParts, effectiveMessage]
    : effectiveMessage;
  try {
    return { chatSession, response: await chatSession.sendMessage(message) };
  } catch (error: any) {
    if (!isRecoverableHistoryError(error)) throw error;
    console.warn('[WhatsApp Agent] Retrying sendMessage with empty history');
    conversations.set(sessionKey, []);
    const freshSession = model.startChat({ history: [], generationConfig: { maxOutputTokens: 4096 } });
    return { chatSession: freshSession, response: await freshSession.sendMessage(message) };
  }
}

function getWhatsAppModelCandidates(): string[] {
  const configured = [
    process.env.VITE_WHATSAPP_GEMINI_MODEL,
    process.env.WHATSAPP_GEMINI_MODEL,
    WA_MODEL,
    ...WA_MODEL_FALLBACKS,
  ].filter((value): value is string => Boolean(value?.trim()));
  return Array.from(new Set(configured.map((value) => value.trim())));
}

function isRecoverableHistoryError(error: any): boolean {
  const message = String(error?.message || error || '').toLowerCase();
  if (isModelAvailabilityError(error)) return false;
  return (
    message.includes('history')
    || message.includes('contents')
    || message.includes('content')
    || message.includes('parts')
    || message.includes('role')
  ) && (
    message.includes('400')
    || message.includes('invalid')
    || message.includes('bad request')
  );
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
