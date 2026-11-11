import { afterEach, describe, expect, it, vi } from 'vitest';
import { nativeOpenAIProvider } from '../openai-runtime/provider';
import type { OpenAIScope } from '../openai-runtime/types';
import { validateOpenAIRequest } from '../../src/shared/openai-runtime';
const scope: OpenAIScope = { id: 'ficticio', sender: {}, frame: {}, userId: 'usuario', authority: { assert: () => {}, signal: new AbortController().signal, key: async () => 'sk-centinela-totalmente-ficticio', dispose: () => {} } };
afterEach(() => vi.unstubAllGlobals());
describe('SDK OpenAI instalado con transporte HTTP ficticio', () => {
  it('usa clave sólo en main y conserva output_text/uso reales del SDK', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ id: 'resp_ficticia', object: 'response', status: 'completed', output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'respuesta comprobada', annotations: [] }] }], usage: { total_tokens: 17 } }), { headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetch);
    const result = await nativeOpenAIProvider(scope, validateOpenAIRequest({ model: 'gpt-6-luna', input: 'prueba' }), new AbortController().signal, 0);
    expect(result).toMatchObject({ output_text: 'respuesta comprobada', usage: { total_tokens: 17 } });
    const [url, options] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(String(url)).toBe('https://api.openai.com/v1/responses'); expect(new Headers(options.headers).get('authorization')).toBe('Bearer sk-centinela-totalmente-ficticio');
  });
  it('conserva stream SSE real sin servidor o claves reales', async () => {
    const events = [{ type: 'response.output_text.delta', delta: 'hola', sequence_number: 1 }, { type: 'response.completed', response: { usage: { total_tokens: 3 } }, sequence_number: 2 }];
    vi.stubGlobal('fetch', vi.fn(async () => new Response(events.map(event => `data: ${JSON.stringify(event)}\n\n`).join('') + 'data: [DONE]\n\n', { headers: { 'content-type': 'text/event-stream' } })));
    const result = await nativeOpenAIProvider(scope, validateOpenAIRequest({ model: 'gpt-6-luna', input: 'prueba', stream: true }), new AbortController().signal, 0);
    expect(Symbol.asyncIterator in result).toBe(true);
    const received = []; for await (const event of result as AsyncIterable<unknown>) received.push(event);
    expect(received).toEqual(events);
  });
});
