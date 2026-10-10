import { createWhatsAppOpenAISession } from './openai-session';
import { toOpenAITools } from '../../src/services/openai-chat/tool-schema';
import { prepareWhatsAppConversationHistory } from './conversation-history';
import { buildWhatsAppAgentPromptContext } from './system-prompt-context';
import { buildWhatsAppToolDeclarations } from './tool-declarations';
import { isModelAvailabilityError } from './agent-errors';
import { classifyEvidenceRequirement, detectActionRequest } from '../whatsapp-prompts';
import type { AgentLoopRequest, AgentLoopState } from './agent-loop-types';
import { prepareWhatsAppTeam, TEAM_COORDINATOR_INSTRUCTION } from './agent-team';
import { assertTeamActive } from '../../src/shared/agent-teams/runner';
import type OpenAI from 'openai';

export async function createAgentLoopState(request: AgentLoopRequest): Promise<AgentLoopState | string> {
  const client: OpenAI = await request.agent.getOpenAIClient();
  assertTeamActive(request.options.signal);
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
  let systemPrompt = appendEvidenceDirective(promptContext.systemPrompt, evidenceRequirement);
  const tools = [await buildWhatsAppToolDeclarations({
    isGroup: request.isGroup,
    senderNumber: request.senderNumber,
    whatsappConfig: request.agent.waService.config,
    communicationHub: request.agent.communicationHubService,
  }) as any];
  const historyCopy = prepareWhatsAppConversationHistory({
    conversations: request.conversations,
    sessionKey: promptContext.sessionKey,
    userMessage: request.userMessage,
    loadPersistedHistory: () => request.agent.memory.getConversationHistory(promptContext.sessionKey, 30),
  });
  const teamContext = await prepareWhatsAppTeam(request, client);
  assertTeamActive(request.options.signal);
  if (teamContext) systemPrompt += `\n\n${TEAM_COORDINATOR_INSTRUCTION}`;
  const modelConversation = await createModelConversation({
    client,
    request,
    teamContext,
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
  client: OpenAI;
  teamContext: string;
  request: AgentLoopRequest;
  systemPrompt: string;
  tools: any[];
  historyCopy: any[];
  sessionKey: string;
}) {
  const client = input.client;
  assertTeamActive(input.request.options.signal);
  const createSession = (history: any[]) => createWhatsAppOpenAISession({
    client, instructions: input.systemPrompt, tools: toOpenAITools(input.tools), history,
    signal: input.request.options.signal,
  });
  const chatSession = startChatSafely(createSession, input.historyCopy, input.request.conversations, input.sessionKey);
  return sendInitialMessage(createSession, chatSession, input.request, input.request.conversations, input.sessionKey, input.teamContext);
}

type CreateSession = (history: any[]) => any;

function startChatSafely(
  createSession: CreateSession,
  history: any[],
  conversations: Map<string, any[]>,
  sessionKey: string,
) {
  try {
    return createSession(history);
  } catch (error: any) {
    console.warn(`[WhatsApp Agent] Corrupted history for ${sessionKey}, resetting:`, error.message);
    conversations.set(sessionKey, []);
    return createSession([]);
  }
}

async function sendInitialMessage(
  createSession: CreateSession,
  chatSession: any,
  request: AgentLoopRequest,
  conversations: Map<string, any[]>,
  sessionKey: string,
  teamContext: string,
) {
  const prefix = request.inlineMediaParts.length === 0 && detectActionRequest(request.userMessage)
    ? '[INSTRUCCION DEL SISTEMA: El usuario solicita una ACCION NUEVA. DEBES usar herramientas para ejecutarla AHORA.]\n\n'
    : '';
  const effectiveMessage = prefix + request.userMessage + (teamContext ? `\n\n${teamContext}` : '');
  const message = request.inlineMediaParts.length > 0
    ? [...request.inlineMediaParts, { text: effectiveMessage }]
    : effectiveMessage;
  try {
    return { chatSession, response: await chatSession.sendMessage({ message }) };
  } catch (error: any) {
    if (!isRecoverableHistoryError(error)) throw error;
    console.warn('[WhatsApp Agent] Retrying sendMessage with empty history');
    conversations.set(sessionKey, []);
    const freshSession = createSession([]);
    return { chatSession: freshSession, response: await freshSession.sendMessage({ message }) };
  }
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
