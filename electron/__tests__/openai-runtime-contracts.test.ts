import { describe, expect, it, vi } from 'vitest';
import { validateOpenAIRequest, openaiSnapshot, openaiRuntimeId } from '../../src/shared/openai-runtime';
import { createMainProcessEnvDefines, createPreloadEnvDefines, createPublicEnvDefines } from '../../config/vite/env-defines.mjs';
const body = { model: 'gpt-6-luna', input: 'prueba', stream: true };
describe('Contrato cerrado de inferencia OpenAI', () => {
  it('conserva el payload de herramientas del producto y lo copia', () => {
    const input = { ...body, tools: [{ type: 'function', name: 'prueba', parameters: { type: 'object' }, strict: false }, { type: 'web_search' }, { type: 'file_search', vector_store_ids: ['ficticio'] }], reasoning: { effort: 'max' }, max_output_tokens: 32768, tool_choice: 'auto' };
    const parsed = validateOpenAIRequest(input); expect(parsed).toEqual(input); expect(parsed).not.toBe(input);
  });
  it.each([
    { ...body, apiKey: 'clave-ficticia' }, { ...body, headers: {} }, { ...body, baseURL: 'https://ajeno.invalid' },
    { ...body, model: '../modelo' }, { ...body, input: {} }, { ...body, max_output_tokens: 32769 }, { ...body, stream: 'true' },
    { ...body, tools: [{ type: 'computer' }] }, { ...body, tools: [{ type: 'mcp', server_url: 'https://ajeno.invalid' }] },
    { ...body, tools: [{ type: 'web_search', apiKey: 'secreto-ficticio' }] }, { ...body, reasoning: { effort: 'high', hidden: true } },
    { ...body, reasoning: { effort: ['high'] } }, { ...body, tool_choice: ['auto'] }, { ...body, tools: [{ type: ['web_search'] }] },
  ])('rechaza capacidades/contratos ajenos %#', input => expect(() => validateOpenAIRequest(input)).toThrow());
  it('no evalúa getters ni acepta ciclos/prototipos', () => {
    const getter = vi.fn(); expect(() => validateOpenAIRequest(Object.defineProperty({ ...body }, 'model', { get: getter }))).toThrow(); expect(getter).not.toHaveBeenCalled();
    const cycle: { x?: unknown } = {}; cycle.x = cycle; expect(() => openaiSnapshot(cycle)).toThrow(); expect(() => openaiSnapshot(new Date())).toThrow();
  });
  it('cuota de bytes cuenta UTF-8 y estructura', () => { expect(() => openaiSnapshot({ text: '😀😀' }, 12)).toThrow(); expect(openaiSnapshot({ text: 'a' }, 12)).toEqual({ text: 'a' }); });
  it.each(['', '../id', 'x'.repeat(129), 4, null])('rechaza ID inválido %#', id => expect(() => openaiRuntimeId(id)).toThrow());
  it('el entorno OpenAI sólo llega a main; conserva flags públicos de Vite', () => {
    const env = { VITE_OPENAI_API_KEY: 'centinela-ficticio-openai', VITE_GEMINI_API_KEY: 'centinela-ficticio-retirado', VITE_SUPABASE_URL: 'https://prueba.invalid', ELEVENLABS_API_KEY: 'centinela-ficticio-voz' };
    const publicDefines = createPublicEnvDefines(env);
    expect(JSON.stringify(publicDefines)).not.toMatch(/centinela-ficticio-openai|centinela-ficticio-retirado|centinela-ficticio-voz/);
    expect(publicDefines).toEqual({ 'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL) });
    expect(JSON.stringify(createPreloadEnvDefines(env))).not.toContain(env.VITE_OPENAI_API_KEY);
    expect(JSON.stringify(createPreloadEnvDefines(env))).not.toContain(env.VITE_GEMINI_API_KEY);
    expect(JSON.stringify(createMainProcessEnvDefines(env))).toContain(env.VITE_OPENAI_API_KEY);
  });
});
