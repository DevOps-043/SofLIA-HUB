import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import { CodexTransport } from '../codex-runtime/transport';
import { isolatedEnvironment } from '../codex-runtime/configuration';
import { AGENT_LIMITS } from '../../src/shared/agent-runtime';
function child() {
  return Object.assign(new EventEmitter(), { stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough(), kill: vi.fn() });
}
describe('Transporte Codex', () => {
  it('correlaciona respuestas fragmentadas y notificaciones', async () => {
    const process = child();
    const transport = new CodexTransport(process as unknown as ChildProcessWithoutNullStreams);
    const messages = vi.fn();
    transport.on('message', messages);
    const result = transport.request('initialize', {});
    process.stdout.write('{"id":1,"res');
    process.stdout.write('ult":{"ready":true}}\n{"method":"turn/completed","params":{}}\n');
    expect(await result).toEqual({ ready: true });
    expect(messages).toHaveBeenCalledTimes(1);
    transport.close();
  });
  it('rechaza todas las solicitudes si el proceso termina', async () => {
    const process = child();
    const transport = new CodexTransport(process as unknown as ChildProcessWithoutNullStreams);
    const a = transport.request('a', {});
    const b = transport.request('b', {});
    process.emit('exit', 1);
    expect((await Promise.allSettled([a, b])).every(value => value.status === 'rejected')).toBe(true);
    expect(process.kill).toHaveBeenCalledTimes(1);
  });
  it('cierra ante JSON inválido o buffer excesivo', () => {
    const process = child();
    const transport = new CodexTransport(process as unknown as ChildProcessWithoutNullStreams);
    process.stdout.write('x'.repeat(AGENT_LIMITS.maxFrameBytes + 1));
    expect(process.kill).toHaveBeenCalledTimes(1);
    expect(() => transport.send({ method: 'a' })).toThrow();
  });
  it('no hereda secretos genéricos ni el hogar personal de Codex', () => {
    vi.stubEnv('SOFLIA_PRIVATE_TOKEN', 'señuelo');
    vi.stubEnv('CODEX_HOME', 'hogar-personal');
    const env = isolatedEnvironment('aislado');
    expect(env.SOFLIA_PRIVATE_TOKEN).toBeUndefined();
    expect(env.CODEX_HOME).toBe('aislado');
    expect(env.HOME).toBe('aislado');
    vi.unstubAllEnvs();
  });
});
