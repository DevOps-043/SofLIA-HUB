import { EventEmitter } from 'node:events';
import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import { AGENT_LIMITS } from '../../src/shared/agent-runtime';

export type RpcMessage = { id?: string | number; method?: string; params?: Record<string, unknown>; result?: unknown; error?: unknown };
export class CodexTransport extends EventEmitter {
  private buffer = '';
  private nextId = 1;
  private closed = false;
  private pending = new Map<number, { resolve(value: unknown): void; reject(error: Error): void; timer: ReturnType<typeof setTimeout> }>();
  constructor(private readonly child: ChildProcessWithoutNullStreams) {
    super();
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => this.receive(chunk));
    // Los diagnósticos del proveedor pueden contener datos: se consumen sin registrarlos.
    child.stderr.resume();
    child.stdin.on('error', () => this.close());
    child.on('error', () => this.close());
    child.on('exit', () => this.close());
  }
  private receive(chunk: string): void {
    if (this.closed) return;
    this.buffer += chunk;
    if (Buffer.byteLength(this.buffer) > AGENT_LIMITS.maxFrameBytes) return this.close();
    let end: number;
    while ((end = this.buffer.indexOf('\n')) >= 0) {
      const line = this.buffer.slice(0, end);
      this.buffer = this.buffer.slice(end + 1);
      if (!line.trim()) continue;
      try {
        const message: RpcMessage = JSON.parse(line);
        if (!message || typeof message !== 'object' || Array.isArray(message)) throw new Error();
        if (message.method) this.emit('message', message);
        else if (typeof message.id === 'number') {
          const request = this.pending.get(message.id);
          if (!request) continue;
          this.pending.delete(message.id);
          clearTimeout(request.timer);
          if (message.error) request.reject(new Error('Codex rechazó la solicitud. Comprueba versión, modelo y autenticación.'));
          else request.resolve(message.result);
        }
      } catch { this.close(); return; }
    }
  }
  send(message: RpcMessage): void {
    if (this.closed) throw new Error('La conexión con Codex está cerrada.');
    const serialized = JSON.stringify(message) + '\n';
    if (Buffer.byteLength(serialized) > AGENT_LIMITS.maxFrameBytes || this.child.stdin.writableLength > AGENT_LIMITS.maxFrameBytes) {
      this.close();
      throw new Error('Se excedió el límite del transporte.');
    }
    this.child.stdin.write(serialized);
  }
  request(method: string, params: Record<string, unknown>): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('Codex no respondió a tiempo.'));
        this.close();
      }, AGENT_LIMITS.rpcTimeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      try { this.send({ id, method, params }); }
      catch (error) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(error);
      }
    });
  }
  close(): void {
    if (this.closed) return;
    this.closed = true;
    for (const entry of this.pending.values()) {
      clearTimeout(entry.timer);
      entry.reject(new Error('La conexión con Codex terminó.'));
    }
    this.pending.clear();
    this.child.kill();
    this.emit('closed');
    this.removeAllListeners();
  }
}
