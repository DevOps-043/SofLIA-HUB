import type { ThinkingLevel } from '@google/genai';
import { isOpenAIModel } from '../../shared/model-providers';
import { selectTeam, TEAM_COORDINATOR_INSTRUCTION, TEAM_LIMITS } from '../../shared/agent-teams/policy';
import { assertTeamActive, runAgentTeam, type TeamGenerate } from '../../shared/agent-teams/runner';
import { getGenAiClient } from './client';
import { getOpenAI } from '../openai-chat/client';
import { SOFLIA_MAX_MODEL_ID, recordSofliaMaxTokens } from '../model-quota';
import type { ConversationMessage, SendMessageStreamOptions } from './types';
import { publishTeamActivity } from '../agent-activity';

/** Los workers reciben sólo fuentes del turno y contexto reciente del mismo chat. */
export async function prepareChatTeam(input: {
  message: string; source: string; modelId: string; options?: SendMessageStreamOptions;
  conversationHistory?: ConversationMessage[];
  onFirstModelCall?: () => void;
}): Promise<{ context: string; instruction: string }> {
  const plan = selectTeam({ task: input.message, surface: 'chat', mode: input.options?.teamMode, skillId: input.options?.activeSkill?.id });
  if (!plan) return { context: '', instruction: '' };
  const generate: TeamGenerate = async request => {
    if (isOpenAIModel(input.modelId)) {
      const client = await getOpenAI();
      assertTeamActive(request.signal);
      input.onFirstModelCall?.();
      const response = await client.responses.create({
        model: input.modelId, instructions: request.instruction, input: request.input,
        max_output_tokens: request.maxOutputTokens, store: false,
        // El presupuesto breve del worker debe dejar espacio para texto útil.
        reasoning: { effort: 'low' },
      }, { signal: request.signal, maxRetries: 0 });
      if (input.modelId === SOFLIA_MAX_MODEL_ID) recordSofliaMaxTokens(input.options?.userId, response.usage?.total_tokens ?? 0);
      return response.output_text;
    }
    const client = await getGenAiClient();
    assertTeamActive(request.signal);
    const response = await client.models.generateContent({
      model: input.modelId, contents: request.input,
      config: { systemInstruction: request.instruction, maxOutputTokens: request.maxOutputTokens, thinkingConfig: { thinkingLevel: 'LOW' as ThinkingLevel }, abortSignal: request.signal },
    });
    return response.text ?? '';
  };
  const result = await runAgentTeam({
    plan, surface: 'chat', source: buildTeamSource(input.source, input.conversationHistory), generate, signal: input.options?.signal,
    onEvent: event => {
      publishTeamActivity(event, input.options?.activityOwnerId ?? input.options?.userId);
      input.options?.onToolCall?.({ name: 'analisis_en_equipo', args: { tipo: event.kind }, result: JSON.stringify(event) });
    },
  });
  const state = JSON.stringify({ estado: result.event.status, especialistas: result.event.workers, aportesCompletos: result.event.completed });
  return {
    context: result.context,
    instruction: `El arnés multiagente del sistema ya procesó esta solicitud antes de tu respuesta; no requiere una herramienta de convocatoria en tu catálogo. Resultado real: ${state}. Describe únicamente ese resultado: con aportes completos se ejecutaron especialistas reales; sin aportes o sin cupo informa la limitación y continúa sin atribuir propuestas a agentes exitosos. Las negativas de disponibilidad del historial no describen este turno. ${TEAM_COORDINATOR_INSTRUCTION}`,
  };
}

function buildTeamSource(source: string, history: ConversationMessage[] = []): string {
  const recent = history.slice(-TEAM_LIMITS.historyMessages);
  // Repartir el presupuesto evita que una respuesta larga oculte el encargo.
  const perMessageChars = Math.floor(TEAM_LIMITS.historyChars / Math.max(1, recent.length));
  const messages = recent.map(entry => ({ role: entry.role, text: boundedHistoryText(entry.text, perMessageChars) }));
  if (!messages.length) return source;
  const historyBlock = `\n\nHISTORIAL_RECIENTE_NO_CONFIABLE\n${JSON.stringify({ mensajes: messages, truncado: messages.length < history.length || recent.some((entry, index) => entry.text !== messages[index]?.text) })}\nFIN_HISTORIAL_RECIENTE_NO_CONFIABLE`;
  const sourceBudget = Math.max(0, TEAM_LIMITS.sourceChars - historyBlock.length);
  const truncation = '\n[FUENTE_ACTUAL_TRUNCADA para conservar contexto reciente del chat]';
  const current = source.length > sourceBudget ? source.slice(0, Math.max(0, sourceBudget - truncation.length)) + truncation : source;
  return current + historyBlock;
}

function boundedHistoryText(value: string, encodedBudget: number): string {
  let text = '';
  let size = 0;
  for (const char of value) {
    const encodedSize = JSON.stringify(char).length - 2;
    if (size + encodedSize > encodedBudget) break;
    text += char;
    size += encodedSize;
  }
  return text;
}
