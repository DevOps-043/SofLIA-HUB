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
  it('cancela la escritura pendiente si abrir la aplicación falla y comunica las acciones omitidas', async () => {
    const generate = vi.fn().mockResolvedValueOnce({ functionCalls: [
      { id: 'abrir', name: 'open_application', args: { app_name: 'Bloc de notas' } },
      { id: 'escribir', name: 'type_text_at', args: { x: 10, y: 10, text: 'nota' } },
    ] }).mockResolvedValueOnce({ text: 'No pude abrir la aplicación' });
    const client = createComputerUseClient({ apiKey: 'test', model: 'test', environment: 'ENVIRONMENT_DESKTOP', teamMode: 'direct',
      loadSdk: () => ({ GoogleGenAI: class { models = { generateContent: generate }; }, createPartFromFunctionResponse: (id, name, response) => ({ functionResponse: { id, name, response } }) }),
    });
    expect((await client.iniciar('Escribe una nota', 'imagen')).functionCall?.id).toBe('abrir');
    const turn = await client.continuar('abrir', 'open_application', 'imagen2', { error: 'No encontrada' });
    expect(turn.functionCall).toBeNull();
    expect(generate).toHaveBeenCalledTimes(2);
    const responses = generate.mock.calls[1][0].contents.slice(1).flatMap((content: { parts: unknown[] }) => content.parts);
    expect(responses).toEqual([
      { functionResponse: { id: 'abrir', name: 'open_application', response: { error: 'No encontrada' } } },
      { functionResponse: { id: 'escribir', name: 'type_text_at', response: { error: 'Acción no ejecutada por fallo previo en el lote.' } } },
    ]);
  });
  it('conserva todas las acciones de una respuesta y espera sus resultados antes de consultar de nuevo', async () => {
    const generate = vi.fn().mockResolvedValueOnce({ functionCalls: [{ id: '1', name: 'click', args: { x: 10, y: 10 } }, { id: '2', name: 'type', args: { text: 'nota' } }] }).mockResolvedValueOnce({ text: 'Listo' });
    const client = createComputerUseClient({ apiKey: 'test', model: 'test', environment: 'ENVIRONMENT_DESKTOP', teamMode: 'direct',
      loadSdk: () => ({ GoogleGenAI: class { models = { generateContent: generate }; }, createPartFromFunctionResponse: (id, name, response) => ({ functionResponse: { id, name, response } }) }),
    });
    expect((await client.iniciar('Escribe una nota', 'imagen')).functionCall?.id).toBe('1');
    expect((await client.continuar('1', 'click', 'imagen2', {})).functionCall?.id).toBe('2');
    expect(generate).toHaveBeenCalledTimes(1);
    expect((await client.continuar('2', 'type', 'imagen3', {})).functionCall).toBeNull();
    expect(generate).toHaveBeenCalledTimes(2);
  });
  it('la comprobación usa sólo la captura reciente, sin herramientas, y no acepta JSON inválido', async () => {
    const { client, generate } = fixture();
    generate.mockResolvedValueOnce({ text: '{"confirmed":false,"reason":"Sólo se ve el chat"}' });
    expect(await client.verificar!('Abre Bloc de notas', 'captura-final', 'Listo')).toMatchObject({ confirmed: false });
    const params = generate.mock.calls[0][0];
    expect(params.config).toMatchObject({ tools: [], responseMimeType: 'application/json' });
    expect(JSON.stringify(params.contents)).toContain('captura-final');
    generate.mockResolvedValueOnce({ text: 'Listo' });
    expect(await client.verificar!('Tarea', 'imagen', 'Listo')).toMatchObject({ confirmed: false });
  });
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
