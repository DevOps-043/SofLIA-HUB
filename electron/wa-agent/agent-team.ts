import { selectTeam, TEAM_COORDINATOR_INSTRUCTION } from '../../src/shared/agent-teams/policy';
import { assertTeamActive, runAgentTeam } from '../../src/shared/agent-teams/runner';
import type { AgentLoopRequest } from './agent-loop-types';
import { WA_MODEL } from './constants';
import type OpenAI from 'openai';

export async function prepareWhatsAppTeam(request: AgentLoopRequest, turnClient?: OpenAI): Promise<string> {
  const plan = selectTeam({ task: request.userMessage, surface: 'whatsapp', mode: request.options.teamMode });
  if (!plan) return '';
  const result = await runAgentTeam({
    plan, surface: 'whatsapp', source: request.userMessage, signal: request.options.signal,
    // No copiar memoria ni historial de grupos a los especialistas.
    generate: async worker => {
      assertTeamActive(worker.signal);
      const client = turnClient ?? await request.agent.getOpenAIClient();
      assertTeamActive(worker.signal);
      const response = await client.responses.create({
        model: WA_MODEL, input: worker.input, instructions: worker.instruction,
        max_output_tokens: worker.maxOutputTokens, reasoning: { effort: 'none' }, store: false,
      }, { signal: worker.signal, maxRetries: 0 });
      return response.status === 'completed' ? response.output_text : '';

    },
    onEvent: event => console.info('[Equipo WhatsApp]', JSON.stringify(event)),
  });
  return result.context;
}

export { TEAM_COORDINATOR_INSTRUCTION };
