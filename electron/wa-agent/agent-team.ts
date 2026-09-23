import { selectTeam, TEAM_COORDINATOR_INSTRUCTION } from '../../src/shared/agent-teams/policy';
import { assertTeamActive, runAgentTeam } from '../../src/shared/agent-teams/runner';
import type { AgentLoopRequest } from './agent-loop-types';
import { WA_MODEL } from './constants';

export async function prepareWhatsAppTeam(request: AgentLoopRequest): Promise<string> {
  const plan = selectTeam({ task: request.userMessage, surface: 'whatsapp', mode: request.options.teamMode });
  if (!plan) return '';
  const result = await runAgentTeam({
    plan, surface: 'whatsapp', source: request.userMessage, signal: request.options.signal,
    // No copiar memoria ni historial de grupos a los especialistas.
    generate: async worker => {
      assertTeamActive(worker.signal);
      const response = await request.agent.getGenAiClient().models.generateContent({
        model: WA_MODEL, contents: worker.input,
        config: { systemInstruction: worker.instruction, maxOutputTokens: worker.maxOutputTokens, abortSignal: worker.signal },
      });
      return response.text ?? '';
    },
    onEvent: event => console.info('[Equipo WhatsApp]', JSON.stringify(event)),
  });
  return result.context;
}

export { TEAM_COORDINATOR_INSTRUCTION };
