import type OpenAI from 'openai';
import type { ResponseInputItem } from 'openai/resources/responses/responses';
import { SOFLIA_DEFAULT_MODEL } from '../../src/shared/soflia-runtime-model';
import { AGENT_LIMITS } from '../../src/shared/agent-runtime';
import { getSessionOpenAIClient } from '../ai-provider/session-client';
import { assertActive, type AgentInvocation, type AgentProvider } from './contracts';

export class OpenAIAgentProvider implements AgentProvider {
  constructor(private readonly client: () => Promise<OpenAI> = getSessionOpenAIClient) {}
  async execute(input: AgentInvocation) {
    assertActive(input.signal);
    const client = await this.client();
    assertActive(input.signal);
    const history: ResponseInputItem[] = [{ role: 'user', content: input.prompt }];
    let inputTokens = 0;
    let outputTokens = 0;
    for (let round = 0; round < AGENT_LIMITS.maxCallsPerStep; round++) {
      assertActive(input.signal);
      const response = await client.responses.create({
        model: SOFLIA_DEFAULT_MODEL,
        input: history,
        store: false,
        max_output_tokens: AGENT_LIMITS.maxOutputTokens,
        reasoning: { effort: 'low' },
        tools: input.tools.map(tool => ({ type: 'function', name: tool.name,
          description: tool.description, parameters: tool.inputSchema, strict: false })),
      }, { signal: input.signal, maxRetries: 0 });
      assertActive(input.signal);
      inputTokens += response.usage?.input_tokens ?? 0;
      outputTokens += response.usage?.output_tokens ?? 0;
      const calls = response.output.filter(item => item.type === 'function_call');
      if (!calls.length) return { text: response.output_text, inputTokens, outputTokens };
      history.push(...response.output.filter(item => item.type === 'message' || item.type === 'reasoning' || item.type === 'function_call'));
      for (const call of calls) {
        assertActive(input.signal);
        let args: unknown;
        try { args = JSON.parse(call.arguments); } catch { throw new Error('Argumentos de herramienta no válidos.'); }
        const output = await input.callTool(call.name, args);
        assertActive(input.signal);
        history.push({ type: 'function_call_output', call_id: call.call_id, output });
      }
    }
    throw new Error('Se agotó el presupuesto de llamadas al modelo.');
  }
}
