import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type OpenAI from 'openai';
import { mailboxFixture } from './gmail-mailbox/fixtures';
import { executeGoogleTool } from '../whatsapp-executors/google-executors';
import type { ToolExecutorContext } from '../whatsapp-executors/types';
import { handleToolCallAgentResponse } from '../wa-agent/agent-loop-tools';
import type { AgentLoopState } from '../wa-agent/agent-loop-types';
import { createWhatsAppOpenAISession } from '../wa-agent/openai-session';
import { executeToolsAndTrackEvidence } from '../wa-agent/agent-loop-tool-execution';

vi.mock('../whatsapp-prompts', () => ({ formatForWhatsApp: (text: string) => text }));
vi.mock('../wa-agent/agent-loop-tool-execution', () => ({ executeToolsAndTrackEvidence: vi.fn() }));
let root: string;
beforeEach(async () => { vi.clearAllMocks(); root = await fs.mkdtemp(path.join(os.tmpdir(), 'soflia-runtime-feedback-')); });
afterEach(async () => { vi.restoreAllMocks(); await fs.rm(root, { recursive: true, force: true }); });

async function setup(twoCalls = false) {
  const fx = mailboxFixture(root, 3);
  const output = { type: 'function_call', call_id: 'modificar-uno', name: 'gmail_modify_labels',
    arguments: JSON.stringify({ message_id: 'msg-0', remove_labels: ['Work_1'] }) };
  const outputs = [output, ...(twoCalls ? [{ ...output, call_id: 'modificar-dos', arguments: JSON.stringify({ message_id: 'msg-1', add_labels: ['Nueva'] }) }] : [])];
  const create = vi.fn().mockResolvedValue({ status: 'completed', output: [], output_text: 'Listo' });
  create.mockResolvedValueOnce({ status: 'completed', output: outputs, output_text: '' });
  const session = createWhatsAppOpenAISession({ client: { responses: { create } } as unknown as OpenAI,
    instructions: 'Modifica sólo el mensaje solicitado.', history: [],
    tools: [{ type: 'function', name: output.name, parameters: { type: 'object' }, strict: false }] });
  const first = await session.sendMessage({ message: twoCalls ? 'Quita Trabajo del primero y añade Nueva al segundo.' : 'Quita Trabajo sólo del mensaje indicado.' });
  const state = { agent: { gmailService: fx.service }, chatSession: session,
    options: {}, isActionRequest: true, isGroup: false, toolLoopTrace: [], loopGuardInterventions: 0,
    requirements: { local: false, visual: false, remote: false }, evidence: { local: false, visual: false, remote: false },
  } as unknown as AgentLoopState;
  const ctx = { gmailService: fx.service } as unknown as ToolExecutorContext;
  const execute = vi.mocked(executeToolsAndTrackEvidence);
  execute.mockImplementation(async () => {
    const responses = [];
    let last: Awaited<ReturnType<typeof executeGoogleTool>> = null;
    for (const item of outputs) {
      last = await executeGoogleTool(item.name, JSON.parse(item.arguments), ctx);
      if (!last) throw new Error('El ejecutor no devolvió su resultado.');
      responses.push(last.response);
    }
    return { functionResponses: { ...last, responses },
      responseSummary: [{ name: output.name, success: true }], responseSignature: 'respuesta-ficticia' };
  });
  return { fx, state, create, calls: first.candidates[0].content.parts, execute, ctx };
}

describe('Feedback Gmail desde ejecutor real hasta Responses', () => {
  it('modificar un mensaje no lee ni ordena vaciar los demás de la etiqueta', async () => {
    const { fx, state, create, calls } = await setup();
    const read = vi.spyOn(fx.service, 'getMessages');
    expect(await handleToolCallAgentResponse(state, calls)).toEqual({ done: false });
    expect(fx.current.get('msg-0')).toEqual(['INBOX']);
    expect(fx.current.get('msg-1')).toEqual(['INBOX', 'Work_1']);
    expect(read).not.toHaveBeenCalled(); expect(fx.modify).toHaveBeenCalledOnce();
    const sent = create.mock.calls[1][0].input as Array<Record<string, unknown>>;
    const results = sent.filter(item => item.type === 'function_call_output');
    expect(results).toHaveLength(1); expect(results[0].call_id).toBe('modificar-uno');
    expect(JSON.parse(String(results[0].output))).toMatchObject({ success: true, effectsConfirmed: 1 });
    expect(sent.filter(item => item.role === 'user')).toHaveLength(1);
    expect(JSON.stringify(sent)).not.toContain('DEBES continuar');
  });
  it('cambiar de cuenta después del resultado no provoca una consulta a la cuenta nueva', async () => {
    const { fx, state, calls, execute, ctx } = await setup(); const read = vi.spyOn(fx.service, 'getMessages');
    execute.mockImplementationOnce(async () => {
      const result = await executeGoogleTool('gmail_modify_labels', { message_id: 'msg-0', remove_labels: ['Work_1'] }, ctx);
      if (!result) throw new Error('Resultado faltante.');
      fx.calendar.contextRevision++; fx.calendar.userId = 'usuario-B';
      fx.calendar.connections.set('google', { ...fx.calendar.connections.get('google')!, userId: 'usuario-B', email: 'b@example.test' });
      return { functionResponses: { ...result, responses: [result.response] }, responseSummary: [], responseSignature: 'cambio' };
    });
    await handleToolCallAgentResponse(state, calls);
    expect(read).not.toHaveBeenCalled(); expect(fx.acquire).toHaveBeenCalledOnce();
  });
  it.each([
    { success: false, partial: true, uncertain: true, recoveryRequired: true, effectsConfirmed: 1, error: 'Revisa Gmail' },
    { success: false, cancelled: true, effectsConfirmed: 0 },
  ])('conserva el resultado del servicio sin añadir órdenes: %j', async result => {
    const { fx, state, create, calls } = await setup();
    vi.spyOn(fx.service, 'modifyLabels').mockResolvedValueOnce(result);
    await handleToolCallAgentResponse(state, calls);
    const items = create.mock.calls[1][0].input as Array<{ type?: string; output?: string }>;
    const outputs = items.filter(item => item.type === 'function_call_output'); expect(outputs).toHaveLength(1);
    expect(JSON.parse(outputs[0].output!)).toEqual(result); expect(fx.list).not.toHaveBeenCalled();
  });
  it('una llamada no solicitada sigue detenida por la guarda de intención', async () => {
    const { fx, state, calls, execute } = await setup(); state.isActionRequest = false;
    expect(await handleToolCallAgentResponse(state, calls)).toEqual({ done: false });
    expect(execute).not.toHaveBeenCalled(); expect(fx.modify).not.toHaveBeenCalled();
  });
  it('dos modificaciones conservan orden y call_id sin una tercera respuesta de verificación', async () => {
    const { fx, state, create, calls } = await setup(true);
    const read = vi.spyOn(fx.service, 'getMessages');
    await handleToolCallAgentResponse(state, calls);
    const items = create.mock.calls[1][0].input as Array<{ type?: string; call_id?: string; output?: string }>;
    const outputs = items.filter(item => item.type === 'function_call_output');
    expect(outputs.map(item => item.call_id)).toEqual(['modificar-uno', 'modificar-dos']);
    expect(JSON.parse(outputs[0].output!)).toMatchObject({ effectsConfirmed: 1 });
    expect(JSON.parse(outputs[1].output!)).toMatchObject({ effectsConfirmed: 2, labelsCreated: [{ name: 'Nueva' }] });
    expect(read).not.toHaveBeenCalled(); expect(fx.modify).toHaveBeenCalledTimes(2);
  });
});
