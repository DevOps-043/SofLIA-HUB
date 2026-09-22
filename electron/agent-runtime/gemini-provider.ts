import { GoogleGenAI, type Content } from '@google/genai';
import { SOFLIA_RUNTIME_MODEL } from '../../src/shared/soflia-runtime-model';
import { AGENT_LIMITS } from '../../src/shared/agent-runtime';
import { assertActive, type AgentInvocation, type AgentProvider } from './contracts';

export class GeminiAgentProvider implements AgentProvider {
  constructor(private readonly apiKey: string) {}
  async execute(input: AgentInvocation) {
    const ai = new GoogleGenAI({ apiKey: this.apiKey });
    const contents: Content[] = [{ role: 'user', parts: [{ text: input.prompt }] }];
    let inputTokens = 0;
    let outputTokens = 0;
    for (let round = 0; round < AGENT_LIMITS.maxCallsPerStep; round++) {
      assertActive(input.signal);
      const response = await ai.models.generateContent({
        model: SOFLIA_RUNTIME_MODEL, contents,
        config: {
          abortSignal: input.signal,
          maxOutputTokens: AGENT_LIMITS.maxOutputTokens,
          tools: [{ functionDeclarations: input.tools.map(tool => ({ name: tool.name, description: tool.description, parametersJsonSchema: tool.inputSchema })) }],
        },
      });
      assertActive(input.signal);
      inputTokens += response.usageMetadata?.promptTokenCount ?? 0;
      outputTokens += response.usageMetadata?.candidatesTokenCount ?? 0;
      const calls = response.functionCalls ?? [];
      if (!calls.length) return { text: response.text ?? '', inputTokens, outputTokens };
      const content = response.candidates?.[0]?.content;
      if (!content) throw new Error('Respuesta del proveedor sin contenido.');
      contents.push(content);
      const parts = [];
      for (const call of calls) {
        if (!call.name) throw new Error('Herramienta sin nombre.');
        const output = await input.callTool(call.name, call.args ?? {});
        parts.push({ functionResponse: { name: call.name, id: call.id, response: { output } } });
      }
      contents.push({ role: 'user', parts });
    }
    throw new Error('Se agotó el presupuesto de llamadas al modelo.');
  }
}
