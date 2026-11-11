import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateProviderImage } from '../image-generation/provider';
import { OPENAI_IMAGE_MODEL } from '../../src/shared/image-generation';

afterEach(() => vi.restoreAllMocks());
describe('Proveedor OpenAI de imágenes', () => {
  it('usa el endpoint oficial, el modelo de imagen y la señal nativa', async () => {
    const payload = { data: [{ b64_json: 'QUJD' }] };
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(payload), { headers: { 'content-type': 'application/json' } }));
    const signal = new AbortController().signal;
    expect(await generateProviderImage('clave-ficticia-main', 'prompt ficticio', signal)).toEqual(payload);
    const [url, init] = fetch.mock.calls[0];
    expect(String(url)).toBe('https://api.openai.com/v1/images/generations');
    expect(JSON.parse(String(init?.body))).toEqual({ model: OPENAI_IMAGE_MODEL, prompt: 'prompt ficticio', n: 1, output_format: 'png' });
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer clave-ficticia-main');
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });
  it('rechaza una señal revocada antes de iniciar HTTP', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch');
    const controller = new AbortController(); controller.abort();
    await expect(generateProviderImage('clave-ficticia-main', 'prompt ficticio', controller.signal)).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
});
