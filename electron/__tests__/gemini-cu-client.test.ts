import type OpenAI from 'openai';
import { describe, expect, it, vi } from 'vitest';
import { createComputerUseClient } from '../desktop-agent/gemini-cu/client';
import { waitForCuResponse } from '../desktop-agent/gemini-cu/cancellable-wait';

const reply = (output_text = 'Listo', output: unknown[] = []) => ({ output_text, output });
const call = (call_id: string, name: string, args: Record<string, unknown>) => ({
  type: 'function_call', call_id, name,
  arguments: JSON.stringify({ intent: 'Prueba', safety_decision: { decision: 'allowed' }, ...args }),
});
function fixture(environment: 'ENVIRONMENT_BROWSER' | 'ENVIRONMENT_DESKTOP' = 'ENVIRONMENT_BROWSER') {
  const generate = vi.fn().mockResolvedValue(reply());
  const client = createComputerUseClient({ environment, teamMode: 'direct',
    createClient: async () => ({ responses: { create: generate } }) as unknown as OpenAI });
  return { client, generate };
}

describe('Cancelación del cliente Computer Use', () => {
  it('reanuda sobre la captura nueva conservando historial, herramientas, guardas y señal', async () => {
    const { client, generate } = fixture(); const abort = new AbortController();
    await client.iniciar('Abre Minecraft y ejecútalo en su última versión', 'inicial', undefined, abort.signal);
    await client.reanudar!('descarga-actual', 'El launcher sigue descargando.', abort.signal);
    expect(generate).toHaveBeenCalledTimes(2);
    const params = generate.mock.calls[1][0];
    expect(params.input).toHaveLength(2);
    expect(JSON.stringify(params.input[0])).toContain('última versión');
    expect(JSON.stringify(params.input[1])).toContain('descarga-actual');
    expect(generate.mock.calls[1][1]).toMatchObject({ signal: abort.signal });
    expect(params.tools).toContainEqual(expect.objectContaining({ name: 'click_at' }));
    expect(params.instructions).toContain('sin preguntar');
    abort.abort();
    await expect(client.reanudar!('tardía', 'Cargando.', abort.signal)).rejects.toThrow('Tarea cancelada.');
    expect(generate).toHaveBeenCalledTimes(2);
  });
  it('solo acepta continuidad explícita y nunca la activa junto con éxito', async () => {
    const { client, generate } = fixture();
    for (const [confirmed, canContinue, expected] of [[false, true, true], [false, 'true', false], [true, true, false], [false, undefined, false]]) {
      generate.mockResolvedValueOnce(reply(JSON.stringify({ confirmed, canContinue, reason: 'Observación.' })));
      expect(await client.verificar!('Tarea', 'imagen', 'Listo')).toMatchObject({ confirmed, canContinue: expected });
    }
    expect(generate.mock.calls[0][0]).not.toHaveProperty('tools');
  });
  it('cancela la escritura pendiente si abrir la aplicación falla y comunica las acciones omitidas', async () => {
    const { client, generate } = fixture('ENVIRONMENT_DESKTOP');
    generate.mockResolvedValueOnce(reply('', [
      call('abrir', 'open_application', { app_name: 'Bloc de notas' }),
      call('escribir', 'type_text_at', { x: 10, y: 10, text: 'nota' }),
    ]));
    expect((await client.iniciar('Escribe una nota', 'imagen')).functionCall?.id).toBe('abrir');
    expect((await client.continuar('abrir', 'open_application', 'imagen2', { error: 'No encontrada' })).functionCall).toBeNull();
    expect(generate.mock.calls[1][0].input).toContainEqual({
      type: 'function_call_output', call_id: 'escribir', output: expect.stringContaining('fallo previo'),
    });
  });
  it('rechaza acciones de otra superficie y coordenadas fuera de rango', async () => {
    const { client, generate } = fixture();
    generate.mockResolvedValueOnce(reply('', [call('1', 'open_application', { app_name: 'Bloc' })]));
    await expect(client.iniciar('Tarea', 'imagen')).rejects.toThrow('Acción no declarada');
    generate.mockResolvedValueOnce(reply('', [call('1', 'click_at', { x: -1, y: 0 })]));
    await expect(client.iniciar('Tarea', 'imagen')).rejects.toThrow();
  });
  it('la comprobación usa sólo la captura reciente, sin herramientas, y no acepta JSON inválido', async () => {
    const { client, generate } = fixture();
    generate.mockResolvedValueOnce(reply('{"confirmed":false,"reason":"Sólo se ve el chat"}'));
    expect(await client.verificar!('Abre Bloc de notas', 'captura-final', 'Listo')).toMatchObject({ confirmed: false });
    const params = generate.mock.calls[0][0];
    expect(params).toMatchObject({ text: { format: { type: 'json_object' } } });
    expect(params).not.toHaveProperty('tools');
    expect(JSON.stringify(params.input)).toContain('captura-final');
    generate.mockResolvedValueOnce(reply());
    expect(await client.verificar!('Tarea', 'imagen', 'Listo')).toMatchObject({ confirmed: false });
  });
  it('propaga la misma señal al SDK en inicio y continuación sin perder la configuración CU', async () => {
    const { client, generate } = fixture(); const abort = new AbortController();
    generate.mockResolvedValueOnce(reply('', [call('id', 'click_at', { x: 10, y: 10 })]));
    await client.iniciar('Tarea', 'imagen', {}, abort.signal);
    await expect(client.continuar('otro', 'click_at', 'imagen-2')).rejects.toThrow('acción pendiente');
    await client.continuar('id', 'click_at', 'imagen-2', {}, abort.signal);
    expect(generate).toHaveBeenCalledTimes(2);
    for (const [params, options] of generate.mock.calls) {
      expect(params).toMatchObject({ model: 'gpt-6-luna', store: false, parallel_tool_calls: false });
      expect(options.signal).toBe(abort.signal);
    }
    expect(generate.mock.calls[1][0].input).toContainEqual({ type: 'function_call_output', call_id: 'id', output: '{}' });
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
    await vi.waitFor(() => expect(generate).toHaveBeenCalledOnce());
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
