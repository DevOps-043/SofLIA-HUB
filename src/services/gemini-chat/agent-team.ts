import { isOpenAIModel } from '../../shared/model-providers';
import { selectTeam, TEAM_COORDINATOR_INSTRUCTION } from '../../shared/agent-teams/policy';
import { assertTeamActive, runAgentTeam, type TeamGenerate } from '../../shared/agent-teams/runner';
import { getGenAiClient } from './client';
import { getOpenAI } from '../openai-chat/client';
import { SOFLIA_MAX_MODEL_ID, recordSofliaMaxTokens } from '../model-quota';
import { resolveOpenAIReasoningEffort } from '../openai-chat/reasoning';
import type { SendMessageStreamOptions } from './types';
import { publishTeamActivity } from '../agent-activity';

/** Los workers no reciben el catálogo de herramientas, memoria ni historial. */
export async function prepareChatTeam(input: {
  message: string; source: string; modelId: string; options?: SendMessageStreamOptions;
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
        reasoning: { effort: resolveOpenAIReasoningEffort({ selected: input.options?.thinking?.level }) },
      }, { signal: request.signal, maxRetries: 0 });
      if (input.modelId === SOFLIA_MAX_MODEL_ID) recordSofliaMaxTokens(input.options?.userId, response.usage?.total_tokens ?? 0);
      return response.output_text;
    }
    const client = await getGenAiClient();
    assertTeamActive(request.signal);
    const response = await client.models.generateContent({
      model: input.modelId, contents: request.input,
      config: { systemInstruction: request.instruction, maxOutputTokens: request.maxOutputTokens, abortSignal: request.signal },
    });
    return response.text ?? '';
  };
  const result = await runAgentTeam({
    plan, surface: 'chat', source: input.source, generate, signal: input.options?.signal,
    onEvent: event => {
      publishTeamActivity(event, input.options?.userId);
      input.options?.onToolCall?.({ name: 'analisis_en_equipo', args: { tipo: event.kind }, result: JSON.stringify(event) });
    },
  });
  return { context: result.context, instruction: result.context ? TEAM_COORDINATOR_INSTRUCTION : '' };
}
