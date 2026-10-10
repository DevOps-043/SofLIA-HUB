import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { CodexAgentProvider } from '../codex-runtime';
const fake = vi.hoisted(() => ({ mode: 'ok', messages: [] as Array<Record<string, unknown>>, killed: 0 }));
vi.mock('../codex-runtime/configuration', () => ({
  prepareCodexHome: vi.fn(async () => {}),
  verifyCodexExecutable: vi.fn(async () => ({ executable: '/codex', version: 'codex-cli test' })),
  isolatedEnvironment: () => ({ CODEX_HOME: '/isolated' }),
}));
vi.mock('node:child_process', () => ({
  spawn: vi.fn(() => {
    const child = Object.assign(new EventEmitter(), {
      stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough(),
      kill: () => { fake.killed++; return true; },
    });
    const send = (message: unknown) => child.stdout.write(JSON.stringify(message) + '\n');
    child.stdin.on('data', chunk => {
      const message = JSON.parse(chunk.toString());
      fake.messages.push(message);
      queueMicrotask(() => {
        if (message.method === 'initialize' || message.method === 'account/login/start') send({ id: message.id, result: {} });
        if (message.method === 'thread/start') send({ id: message.id, result: { thread: { id: 'thread1', environments: fake.mode === 'unsafe' ? [{ environmentId: 'local' }] : [] }, instructionSources: [] } });
        if (message.method === 'mcpServerStatus/list') send({ id: message.id, result: { data: fake.mode === 'mcp' ? [{ name: 'ajeno' }] : [], nextCursor: null } });
        if (message.method === 'turn/start') {
          send({ id: message.id, result: { turn: { id: 'turn1' } } });
          if (fake.mode !== 'hang') send({ id: 'tool1', method: 'item/tool/call', params: { threadId: 'thread1', turnId: 'turn1', tool: fake.mode === 'forbidden' ? 'exec_command' : 'leer_transcripcion', arguments: {}, namespace: null } });
        }
        if (message.id === 'tool1' && message.result) {
          send({ method: 'item/completed', params: { threadId: 'thread1', item: { type: 'agentMessage', text: 'Minuta con evidencia L1.' } } });
          send({ method: 'turn/completed', params: { threadId: 'thread1', turn: { id: 'turn1', status: 'completed' } } });
        }
      });
    });
    return child;
  }),
}));
const tools = [{ name: 'leer_transcripcion', description: 'Fuente', inputSchema: { type: 'object', properties: {} } }];
describe('Proveedor Codex acotado', () => {
  beforeEach(() => { fake.mode = 'ok'; fake.messages = []; fake.killed = 0; });
  it('negocia aislamiento antes de ejecutar herramientas y recoge el resultado', async () => {
    const provider = new CodexAgentProvider({ executable: '/codex', version: 'codex-cli test' }, '/isolated', 'clave-prueba');
    const callTool = vi.fn(async () => 'fuente de prueba');
    const result = await provider.execute({ role: 'acuerdos', prompt: 'Analiza', tools, signal: new AbortController().signal, callTool });
    expect(result.text).toContain('L1');
    expect(callTool).toHaveBeenCalledWith('leer_transcripcion', {});
    expect(fake.messages.find(message => message.method === 'thread/start')?.params).toMatchObject({ environments: [], ephemeral: true, sandbox: 'read-only' });
    expect(fake.killed).toBe(1);
  });
  it('no envía un turno si el servidor conserva entornos locales', async () => {
    fake.mode = 'unsafe';
    const provider = new CodexAgentProvider({ executable: '/codex', version: 'codex-cli test' }, '/isolated', 'clave-prueba');
    await expect(provider.execute({ role: 'acuerdos', prompt: 'Privado', tools, signal: new AbortController().signal, callTool: vi.fn() })).rejects.toThrow('aislado');
    expect(fake.messages.some(message => message.method === 'turn/start')).toBe(false);
  });
  it('rechaza herramientas fuera del catálogo antes del dispatcher', async () => {
    fake.mode = 'forbidden';
    const callTool = vi.fn();
    const provider = new CodexAgentProvider({ executable: '/codex', version: 'codex-cli test' }, '/isolated', 'clave-prueba');
    await expect(provider.execute({ role: 'acuerdos', prompt: 'Analiza', tools, signal: new AbortController().signal, callTool })).rejects.toThrow();
    expect(callTool).not.toHaveBeenCalled();
  });
  it('no entrega contenido a un proceso con conectores heredados', async () => {
    fake.mode = 'mcp';
    const provider = new CodexAgentProvider({ executable: '/codex', version: 'codex-cli test' }, '/isolated', 'clave-prueba');
    await expect(provider.execute({ role: 'acuerdos', prompt: 'Privado', tools, signal: new AbortController().signal, callTool: vi.fn() })).rejects.toThrow('conectores');
    expect(fake.messages.some(message => message.method === 'turn/start')).toBe(false);
  });
  it('cierra el proceso al cancelar y no deja promesas pendientes', async () => {
    fake.mode = 'hang';
    const controller = new AbortController();
    const provider = new CodexAgentProvider({ executable: '/codex', version: 'codex-cli test' }, '/isolated', 'clave-prueba');
    const promise = provider.execute({ role: 'acuerdos', prompt: 'Analiza', tools, signal: controller.signal, callTool: vi.fn() });
    await vi.waitFor(() => expect(fake.messages.some(message => message.method === 'turn/start')).toBe(true));
    controller.abort();
    await expect(promise).rejects.toThrow();
    expect(fake.killed).toBe(1);
  });
});
