import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateFlow } from '../flow-inference/provider';
import { SOFLIA_DEFAULT_MODEL } from '../../src/shared/soflia-runtime-model';
import { FLOW_ORCHESTRATOR_PROMPT, FLOW_RESPONSE_FALLBACK_PROMPT } from '../../src/prompts/flow';

afterEach(() => vi.restoreAllMocks());
describe('Proveedor OpenAI de Flow', () => {
  it.each(['analysis', 'fallback'] as const)('conserva prompt y captura para %s en Responses', async kind => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ object: 'response',
      output: [{ type: 'message', content: [{ type: 'output_text', text: 'respuesta' }] }] }), { headers: { 'content-type': 'application/json' } }));
    expect(await generateFlow('clave-ficticia', { kind, text: 'prueba', image: 'QUJD' }, new AbortController().signal)).toBe('respuesta');
    const [url, init] = fetch.mock.calls[0];
    expect(String(url)).toBe('https://api.openai.com/v1/responses');
    const body = JSON.parse(String(init?.body));
    expect(body).toMatchObject({ model: SOFLIA_DEFAULT_MODEL, store: false, instructions: kind === 'analysis' ? FLOW_ORCHESTRATOR_PROMPT : FLOW_RESPONSE_FALLBACK_PROMPT });
    expect(body.input[0].content).toContainEqual({ type: 'input_image', image_url: 'data:image/png;base64,QUJD', detail: 'auto' });
    if (kind === 'analysis') expect(body.text).toEqual({ format: { type: 'json_object' } });
  });
  it('envía el audio como fichero multipart y conserva el JSON de transcripción', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async url => {
      if (String(url) === 'data:,') return new Response('');
      return new Response(JSON.stringify({ text: 'Transcripción ficticia' }), { headers: { 'content-type': 'application/json' } });
    });
    expect(await generateFlow('clave-ficticia', { kind: 'transcription', audio: 'QUJD', mimeType: 'audio/webm;codecs=opus' }, new AbortController().signal)).toBe('{"transcript":"Transcripción ficticia"}');
    const call = fetch.mock.calls.find(([url]) => String(url) === 'https://api.openai.com/v1/audio/transcriptions');
    expect(call).toBeDefined();
    const [, init] = call!;
    const form = init?.body as FormData;
    expect(form.get('model')).toBe('gpt-transcribe');
    const file = form.get('file') as File;
    expect(file.name).toBe('grabacion.webm');
    expect(file.type).toBe('audio/webm');
    expect(await file.text()).toBe('ABC');
  });
});
