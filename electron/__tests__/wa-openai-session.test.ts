import { expect, it, vi } from 'vitest';
import type OpenAI from 'openai';
import { createWhatsAppOpenAISession } from '../wa-agent/openai-session';
const call = (id: string, name = 'consultar') => ({ type: 'function_call', call_id: id, name, arguments: '{"consulta":"dato"}' });
const final = { status: 'completed', output: [], output_text: 'Resultado' };
function fixture() {
  const create = vi.fn().mockResolvedValue(final);
  const controller = new AbortController();
  const session = createWhatsAppOpenAISession({ client: { responses: { create } } as unknown as OpenAI,
    instructions: 'Instrucciones', tools: [{ type: 'function', name: 'consultar', parameters: { type: 'object' }, strict: false }],
    history: [{ role: 'model', parts: [{ text: 'Historial' }] }], signal: controller.signal });
  return { create, session, controller };
}
it('usa Luna, conserva razonamiento y empareja llamadas repetidas por orden', async () => {
  const { create, session } = fixture();
  const reasoning = { type: 'reasoning', id: 'r1', summary: [], encrypted_content: 'cifrado' };
  create.mockResolvedValueOnce({ status: 'completed', output: [reasoning, call('a'), call('b')], output_text: '' });
  const first = await session.sendMessage({ message: 'Consulta' });
  expect(first.candidates[0].content.parts).toHaveLength(2);
  await session.sendMessage({ message: [{ functionResponse: { name: 'consultar', response: { value: 1 } } }, { functionResponse: { name: 'consultar', response: { value: 2 } } }] });
  const params = create.mock.calls[1][0];
  expect(params).toMatchObject({ model: 'gpt-6-luna', store: false, include: ['reasoning.encrypted_content'] });
  expect(params.input).toContainEqual(reasoning);
  expect(params.input).toContainEqual({ type: 'function_call_output', call_id: 'a', output: '{"value":1}' });
  expect(params.input).toContainEqual({ type: 'function_call_output', call_id: 'b', output: '{"value":2}' });
  expect(params.input[0]).toEqual({ role: 'assistant', content: 'Historial' });
});
it('cierra una llamada bloqueada por la guarda antes de solicitar corrección', async () => {
  const { create, session } = fixture();
  create.mockResolvedValueOnce({ status: 'completed', output: [call('a')], output_text: '' });
  await session.sendMessage({ message: 'Consulta' });
  await session.sendMessage({ message: 'Primero verifica la evidencia local.' });
  expect(create.mock.calls[1][0].input).toContainEqual({ type: 'function_call_output', call_id: 'a', output: JSON.stringify({ error: 'La guarda local no ejecutó esta llamada.' }) });
});
it('convierte imágenes, PDF y texto sin perder el contenido', async () => {
  const { create, session } = fixture();
  await session.sendMessage({ message: [{ inlineData: { mimeType: 'image/png', data: 'imagen' } }, { inlineData: { mimeType: 'application/pdf', data: 'pdf' } }, { inlineData: { mimeType: 'text/plain', data: Buffer.from('contenido').toString('base64') } }] });
  expect(create.mock.calls[0][0].input[1].content).toEqual([
    { type: 'input_image', image_url: 'data:image/png;base64,imagen', detail: 'auto' },
    { type: 'input_file', file_data: 'data:application/pdf;base64,pdf', filename: 'adjunto.pdf' },
    { type: 'input_text', text: 'contenido' },
  ]);
});
it('rechaza herramientas fuera del catálogo, argumentos inválidos y respuestas incompletas', async () => {
  for (const output of [[call('x', 'shell_no_autorizado')], [{ ...call('x'), arguments: '[]' }]]) {
    const { create, session } = fixture(); create.mockResolvedValueOnce({ status: 'completed', output });
    await expect(session.sendMessage({ message: 'Consulta' })).rejects.toThrow();
  }
  const { create, session } = fixture(); create.mockResolvedValueOnce({ status: 'incomplete', output: [call('x')] });
  await expect(session.sendMessage({ message: 'Consulta' })).rejects.toThrow('no completó');
});
it('no hace llamadas tras cancelación ni acepta audio como entrada Responses', async () => {
  const { create, session, controller } = fixture();
  await expect(session.sendMessage({ message: [{ inlineData: { mimeType: 'audio/ogg', data: 'audio' } }] })).rejects.toThrow('Formato');
  controller.abort(); await expect(session.sendMessage({ message: 'Hola' })).rejects.toMatchObject({ name: 'AbortError' });
  expect(create).not.toHaveBeenCalled();
});
