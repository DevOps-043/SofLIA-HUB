import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PowerShellWorker } from '../desktop-agent/native-worker/powershell-worker';
import { WORKER_RESPONSE_SENTINEL } from '../desktop-agent/native-worker/worker-protocol';

/**
 * Proceso hijo falso: expone stdin (capturable), stdout (inyectable) y emite
 * eventos como un ChildProcess real, sin tocar PowerShell.
 */
class FakeChild extends EventEmitter {
  stdin = { write: vi.fn(), end: vi.fn() };
  stdout = new PassThrough();
  kill = vi.fn();

  emitStdoutLine(text: string): void {
    this.stdout.write(`${text}\n`);
  }
}

function buildWorker(overrides: { requestTimeoutMs?: number } = {}) {
  const children: FakeChild[] = [];
  const spawn = vi.fn(() => {
    const child = new FakeChild();
    children.push(child);
    return child as any;
  });
  const worker = new PowerShellWorker({
    spawn,
    scriptPath: 'C:/fake/worker.ps1', // evita escribir a disco
    requestTimeoutMs: overrides.requestTimeoutMs ?? 12000,
  });
  return { worker, spawn, children };
}

afterEach(() => vi.useRealTimers());

describe('PowerShellWorker: protocolo', () => {
  it('PW-001: correlaciona respuesta por id y filtra el ruido de PowerShell', async () => {
    const { worker, children, spawn } = buildWorker();
    const promise = worker.send({ cmd: 'ping' });

    expect(spawn).toHaveBeenCalledOnce();
    const child = children[0];
    // Ruido antes de la respuesta real: debe ignorarse (sin centinela).
    child.emitStdoutLine('PS C:\\> cargando modulos...');
    child.emitStdoutLine(`${WORKER_RESPONSE_SENTINEL}{"id":1,"ok":true,"cmd":"ping","pong":true}`);

    const response = await promise;
    expect(response).toMatchObject({ id: 1, ok: true, pong: true });

    // La peticion se escribio como una linea JSON por stdin.
    const written = child.stdin.write.mock.calls[0][0] as string;
    expect(JSON.parse(written.trim())).toMatchObject({ id: 1, cmd: 'ping' });
  });

  it('PW-002: dos peticiones concurrentes se resuelven por su id', async () => {
    const { worker, children } = buildWorker();
    const p1 = worker.send({ cmd: 'ping' });
    const p2 = worker.send({ cmd: 'locateByText', sparseThreshold: 8, wakeDelayMs: 0, maxElements: 50 });
    const child = children[0];

    // Responder en orden inverso: la correlacion por id no debe confundirse.
    child.emitStdoutLine(`${WORKER_RESPONSE_SENTINEL}{"id":2,"ok":true,"cmd":"locateByText","elements":[],"scanned":7}`);
    child.emitStdoutLine(`${WORKER_RESPONSE_SENTINEL}{"id":1,"ok":true,"cmd":"ping","pong":true}`);

    await expect(p2).resolves.toMatchObject({ id: 2, cmd: 'locateByText', scanned: 7 });
    await expect(p1).resolves.toMatchObject({ id: 1, pong: true });
  });

  it('PW-003: una peticion sin respuesta expira por timeout', async () => {
    vi.useFakeTimers();
    const { worker } = buildWorker({ requestTimeoutMs: 500 });
    const promise = worker.send({ cmd: 'ping' });
    const assertion = expect(promise).rejects.toThrow(/excedió 500ms/);
    await vi.advanceTimersByTimeAsync(600);
    await assertion;
  });

  it('PW-004: si el proceso muere, se rechazan las pendientes y el siguiente send relanza', async () => {
    const { worker, children, spawn } = buildWorker();
    const promise = worker.send({ cmd: 'ping' });
    children[0].emit('exit');
    await expect(promise).rejects.toThrow(/se cerró inesperadamente/);

    // El siguiente envio arranca un proceso nuevo.
    const promise2 = worker.send({ cmd: 'ping' });
    expect(spawn).toHaveBeenCalledTimes(2);
    children[1].emitStdoutLine(`${WORKER_RESPONSE_SENTINEL}{"id":2,"ok":true,"cmd":"ping","pong":true}`);
    await expect(promise2).resolves.toMatchObject({ pong: true });
  });

  it('PW-005: dispose mata el proceso y rechaza envios posteriores', async () => {
    const { worker, children } = buildWorker();
    void worker.send({ cmd: 'ping' }).catch(() => {});
    worker.dispose();
    expect(children[0].kill).toHaveBeenCalled();
    await expect(worker.send({ cmd: 'ping' })).rejects.toThrow(/liberado/);
  });
});
