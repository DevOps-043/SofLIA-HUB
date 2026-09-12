import { describe, expect, it, vi } from 'vitest';
import { createComputerUseClient } from '../desktop-agent/gemini-cu/client';
import { waitForCuResponse } from '../desktop-agent/gemini-cu/cancellable-wait';

function fixture() {
  const generate = vi.fn<(params: { config?: Record<string, unknown>; contents: unknown[] }) => Promise<{ text: string }>>().mockResolvedValue({ text: 'Listo' });
  const client = createComputerUseClient({
    apiKey: 'clave-de-prueba', model: 'modelo-de-prueba', environment: 'ENVIRONMENT_BROWSER',
    loadSdk: () => ({ GoogleGenAI: class { models = { generateContent: generate }; }, createPartFromFunctionResponse: (_id, _name, response) => ({ functionResponse: response }) }),
  });
  return { client, generate };
}

describe('Cancelación del cliente Computer Use', () => {
  it('propaga la misma señal al SDK en inicio y continuación sin perder la configuración CU', async () => {
    const { client, generate } = fixture(); const abort = new AbortController();
    await client.iniciar('Tarea', 'imagen', {}, abort.signal);
    await client.continuar('id', 'click', 'imagen-2', {}, abort.signal);
    expect(generate).toHaveBeenCalledTimes(2);
    for (const [params] of generate.mock.calls) expect(params.config).toMatchObject({ abortSignal: abort.signal, tools: [{ computerUse: { environment: 'ENVIRONMENT_BROWSER' } }] });
    expect(generate.mock.calls[0][0].contents).toHaveLength(1);
    expect(generate.mock.calls[1][0].contents).toHaveLength(2);
  });

  it('no llama al SDK cuando ya se canceló ni publica el motivo privado', async () => {
    const { client, generate } = fixture(); const abort = new AbortController(); abort.abort('secreto');
    await expect(client.iniciar('Tarea', 'imagen', {}, abort.signal)).rejects.toThrow('Tarea cancelada.');
    await expect(client.continuar('id', 'click', 'imagen', {}, abort.signal)).rejects.toThrow('Tarea cancelada.');
    expect(generate).not.toHaveBeenCalled();
  });

  it('termina localmente aunque el SDK ignore la señal y absorbe un error tardío', async () => {
    const { client, generate } = fixture(); const abort = new AbortController();
    let fail!: (error: Error) => void;
    generate.mockImplementationOnce(() => new Promise((_resolve, reject) => { fail = reject; }));
    const result = client.iniciar('Tarea', 'imagen', {}, abort.signal);
    abort.abort(); await expect(result).rejects.toThrow('Tarea cancelada.');
    fail(new Error('error privado tardío')); await Promise.resolve();
    expect(generate).toHaveBeenCalledOnce();
  });

  it('elimina el listener al terminar o fallar, incluso ante error síncrono', async () => {
    const abort = new AbortController(); const remove = vi.spyOn(abort.signal, 'removeEventListener');
    expect(await waitForCuResponse(async () => 1, abort.signal)).toBe(1);
    await expect(waitForCuResponse(async () => { throw new Error('fallo'); }, abort.signal)).rejects.toThrow('fallo');
    await expect(waitForCuResponse(() => { throw new Error('síncrono'); }, abort.signal)).rejects.toThrow('síncrono');
    expect(remove).toHaveBeenCalledTimes(3);
  });
});
