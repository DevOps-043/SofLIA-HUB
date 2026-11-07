import { describe, expect, it, vi } from 'vitest';
import OpenAI from 'openai';
import { OpenAIAgentProvider } from '../agent-runtime/openai-provider';
import type { AgentInvocation } from '../agent-runtime/contracts';

const invocation = (): AgentInvocation => ({
  role: 'acuerdos', prompt: 'Transcripción de prueba', signal: new AbortController().signal,
  tools: [{ name: 'leer_transcripcion', description: 'Leer evidencia', inputSchema: { type: 'object', properties: {} } }],
  callTool: vi.fn(async () => 'Evidencia L1'),
});
function client() {
  const fetch = vi.fn<typeof globalThis.fetch>();
  const api = new OpenAI({ apiKey: 'credencial-ficticia-openai', fetch, maxRetries: 0 });
  return { fetch, provider: new OpenAIAgentProvider(async () => api) };
}
function response(output: unknown[]) {
  return new Response(JSON.stringify({ id: 'resp_ficticia', object: 'response', output, usage: { input_tokens: 2, output_tokens: 3, total_tokens: 5 } }),
    { headers: { 'content-type': 'application/json' } });
}
describe('Proveedor OpenAI del análisis en equipo', () => {
  it('encadena herramienta y evidencia con el call_id real y conserva tokens', async () => {
    const f = client();
    f.fetch.mockResolvedValueOnce(response([{ type: 'function_call', call_id: 'llamada-1', name: 'leer_transcripcion', arguments: '{}' }]))
      .mockResolvedValueOnce(response([{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'Acuerdo con evidencia L1', annotations: [] }] }]));
    const input = invocation();
    expect(await f.provider.execute(input)).toEqual({ text: 'Acuerdo con evidencia L1', inputTokens: 4, outputTokens: 6 });
    expect(input.callTool).toHaveBeenCalledWith('leer_transcripcion', {});
    const body = JSON.parse(String(f.fetch.mock.calls[1][1]?.body));
    expect(body).toMatchObject({ model: 'gpt-6-luna', store: false });
    expect(body.input).toContainEqual({ type: 'function_call_output', call_id: 'llamada-1', output: 'Evidencia L1' });
  });
  it('no inicia transporte ni herramientas si se revoca mientras obtiene cliente', async () => {
    const f = client();
    const controller = new AbortController();
    const provider = new OpenAIAgentProvider(async () => { controller.abort(); return new OpenAI({ apiKey: 'credencial-ficticia', fetch: f.fetch }); });
    const input = { ...invocation(), signal: controller.signal };
    await expect(provider.execute(input)).rejects.toThrow('interrumpida');
    expect(f.fetch).not.toHaveBeenCalled();
    expect(input.callTool).not.toHaveBeenCalled();
  });
  it('rechaza argumentos de herramienta malformados antes de ejecutar', async () => {
    const f = client();
    f.fetch.mockResolvedValueOnce(response([{ type: 'function_call', call_id: 'llamada-1', name: 'leer_transcripcion', arguments: '{' }]));
    const input = invocation();
    await expect(f.provider.execute(input)).rejects.toThrow('Argumentos');
    expect(input.callTool).not.toHaveBeenCalled();
  });
});
