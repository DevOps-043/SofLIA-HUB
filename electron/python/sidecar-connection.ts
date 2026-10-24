import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import { BoundedNdjson } from './ndjson';

export const SIDECAR_MAX_LINE_BYTES = 64 * 1024 * 1024;
export const SIDECAR_MAX_WRITE_BYTES = 8 * 1024 * 1024;
export const SIDECAR_MAX_PENDING = 64;
export class SidecarConnectionError extends Error {
  constructor(readonly code: string, message: string) { super(message); this.name = 'SidecarConnectionError'; }
}
export function sidecarLaunchError(error: unknown): SidecarConnectionError {
  const value = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
  const code = typeof value === 'string' && ['ENOENT', 'EACCES', 'EPERM', 'EIO'].includes(value) ? ` (${value})` : '';
  return new SidecarConnectionError('SIDECAR_START_FAILED', `No se pudo lanzar el sidecar Python${code}.`);
}
export const sidecarStopError = () => new SidecarConnectionError('SIDECAR_STOP_UNCONFIRMED', 'No se confirmó el cierre del sidecar Python. Espera su cierre o reinicia la app.');
interface Pending { resolve(value: Record<string, unknown>): void; reject(error: Error): void; timer: ReturnType<typeof setTimeout> }
interface Options {
  protocol: number;
  readyTimeoutMs: number;
  onMessage(message: Record<string, unknown>): void;
  onClosed(error: SidecarConnectionError, intentional: boolean): void;
}
const stopped = () => new SidecarConnectionError('SIDECAR_STOPPED', 'La operación del sidecar Python fue cancelada.');
/** Cada instancia posee un único hijo; nunca transfiere pendientes ni eventos. */
export class SidecarConnection {
  private state: 'new' | 'starting' | 'ready' | 'closed' = 'new';
  private closing = false;
  private nextId = 1;
  private readonly pending = new Map<number, Pending>();
  private readonly framing = new BoundedNdjson(SIDECAR_MAX_LINE_BYTES);
  private readyTimer?: ReturnType<typeof setTimeout>;
  private resolveReady!: () => void;
  private rejectReady!: (error: Error) => void;
  private readonly ready: Promise<void>;
  private stopPromise: Promise<void> | null = null;
  private killing = false;
  private terminated = false;
  private resolveClosed!: () => void;
  readonly closed: Promise<void>;
  constructor(readonly process: ChildProcessWithoutNullStreams, private readonly options: Options) {
    this.ready = new Promise<void>((resolve, reject) => { this.resolveReady = resolve; this.rejectReady = reject; });
    this.closed = new Promise<void>(resolve => { this.resolveClosed = resolve; });
    // Puede cerrarse antes de que un consumidor llegue a esperar startup.
    void this.ready.catch(() => {});
  }
  get running(): boolean { return this.state !== 'closed'; }
  start(): Promise<void> {
    if (this.state === 'closed') return Promise.reject(stopped());
    if (this.state !== 'new') return this.ready;
    this.state = 'starting';
    const proc = this.process;
    proc.stdout.on('data', this.onData); proc.stderr.on('data', this.drainStderr);
    proc.on('error', this.onError); proc.on('exit', this.onExit); proc.on('close', this.onClose);
    proc.stdin.on('error', this.onStreamError); proc.stdout.on('error', this.onStreamError); proc.stderr.on('error', this.onStreamError);
    this.readyTimer = setTimeout(() => this.fail(new SidecarConnectionError('SIDECAR_READY_TIMEOUT', 'Timeout esperando ready del sidecar Python.')), this.options.readyTimeoutMs);
    return this.ready;
  }
  request(cmd: string, params: Record<string, unknown>, timeoutMs: number): Promise<Record<string, unknown>> {
    return this.writeRequest(cmd, params, timeoutMs, false);
  }
  notify(cmd: string, params: Record<string, unknown>): boolean {
    try {
      if (this.state !== 'ready' || this.closing) return false;
      const payload = this.payload({ cmd, params }); this.assertCapacity(payload);
      this.process.stdin.write(payload, error => { if (error) this.onStreamError(); });
      // write(false) ya aceptó el chunk: no inducir una repetición del audio.
      return true;
    } catch (error) { if (!(error instanceof SidecarConnectionError)) this.onStreamError(); return false; }
  }
  stop(): Promise<void> {
    if (this.terminated) return Promise.resolve();
    if (this.stopPromise) return this.stopPromise;
    this.closing = true; this.rejectPending(stopped());
    const operation = (async () => {
      try { if (this.state === 'ready') await this.writeRequest('shutdown', {}, 2000, true); }
      catch { /* El cierre no depende de recibir un ack antes de matar el hijo. */ }
      this.finish(stopped(), true); const failure = this.kill(); if (failure) throw failure;
    })();
    this.stopPromise = operation; return operation;
  }
  private writeRequest(cmd: string, params: Record<string, unknown>, timeoutMs: number, shutdown: boolean): Promise<Record<string, unknown>> {
    try {
      if (this.state !== 'ready' || this.closing && !shutdown) throw stopped();
      if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 300_000 || !Number.isSafeInteger(this.nextId)) {
        throw new SidecarConnectionError('SIDECAR_INVALID_REQUEST', 'Plazo o identificador de petición Python inválido.');
      }
      if (this.pending.size >= SIDECAR_MAX_PENDING) throw new SidecarConnectionError('SIDECAR_BUSY', 'Hay demasiadas peticiones Python pendientes.');
      const id = this.nextId++; const payload = this.payload({ id, cmd, params }); this.assertCapacity(payload);
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { this.pending.delete(id); reject(new SidecarConnectionError('TIMEOUT', 'El sidecar Python no respondió a tiempo.')); }, timeoutMs);
        this.pending.set(id, { resolve, reject, timer });
        try { this.process.stdin.write(payload, error => { if (error) this.onStreamError(); }); }
        catch { this.onStreamError(); }
      });
    } catch (error) { return Promise.reject(error); }
  }
  private payload(value: { cmd: string; params: Record<string, unknown>; id?: number }): string {
    if (typeof value.cmd !== 'string' || !/^[a-z][a-z0-9_]{0,127}$/u.test(value.cmd)) throw new SidecarConnectionError('SIDECAR_INVALID_REQUEST', 'Comando Python inválido.');
    let payload: string;
    try { payload = JSON.stringify(value) + '\n'; }
    catch { throw new SidecarConnectionError('SIDECAR_INVALID_REQUEST', 'Payload Python no serializable.'); }
    if (Buffer.byteLength(payload) > SIDECAR_MAX_WRITE_BYTES) throw new SidecarConnectionError('SIDECAR_PAYLOAD_TOO_LARGE', 'La petición Python supera el límite permitido.');
    return payload;
  }
  private assertCapacity(payload: string): void {
    const input = this.process.stdin;
    if (input.destroyed || !input.writable || input.writableLength + Buffer.byteLength(payload) > SIDECAR_MAX_WRITE_BYTES) {
      throw new SidecarConnectionError('SIDECAR_BUSY', 'El transporte Python no puede aceptar más datos.');
    }
  }
  private readonly onData = (chunk: Buffer | string) => {
    if (this.state === 'closed') return;
    try { this.framing.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk), text => this.message(text)); }
    catch { this.fail(new SidecarConnectionError('SIDECAR_PROTOCOL_ERROR', 'El sidecar Python emitió un mensaje incompatible.')); }
  };
  private message(text: string): boolean {
    const message: unknown = JSON.parse(text);
    if (!message || typeof message !== 'object' || Array.isArray(message)) throw new Error('Mensaje no estructurado.');
    const data = message as Record<string, unknown>;
    if (this.state === 'starting') {
      if (data.event !== 'ready' || data.protocol !== this.options.protocol || 'id' in data) throw new Error('Ready incompatible.');
      this.state = 'ready'; clearTimeout(this.readyTimer); this.resolveReady(); this.options.onMessage(data); return !this.closing;
    }
    if (this.state !== 'ready') return false;
    if ('id' in data) {
      if (!Number.isSafeInteger(data.id) || Number(data.id) <= 0 || typeof data.ok !== 'boolean' || 'event' in data) throw new Error('Respuesta incompatible.');
      const pending = this.pending.get(Number(data.id));
      if (pending) { this.pending.delete(Number(data.id)); clearTimeout(pending.timer); pending.resolve(data); }
    } else {
      if (typeof data.event !== 'string' || !data.event || data.event.length > 128 || data.event === 'ready') throw new Error('Evento incompatible.');
      if (!this.closing) this.options.onMessage(data);
    }
    return this.state === 'ready';
  }
  private readonly drainStderr = () => { /* Drenar sin conservar texto ni transcripciones. */ };
  private readonly onStreamError = () => this.fail(new SidecarConnectionError('SIDECAR_WRITE_FAILED', 'Falló el transporte del sidecar Python.'));
  private readonly onError = (error: NodeJS.ErrnoException) => {
    // Un spawn sin PID no llegó a crear un hijo que pueda requerir kill.
    if (this.state === 'starting' && !this.process.pid) { this.finish(sidecarLaunchError(error), this.closing); return; }
    this.fail(sidecarLaunchError(error));
  };
  private readonly onExit = () => this.finish(new SidecarConnectionError('SIDECAR_CRASHED', 'El sidecar Python finalizó inesperadamente.'), this.closing);
  private readonly onClose = () => {
    this.terminated = true; this.resolveClosed();
    this.onExit(); const proc = this.process;
    proc.removeListener('error', this.onError); proc.removeListener('exit', this.onExit); proc.removeListener('close', this.onClose);
    proc.stdin.removeListener('error', this.onStreamError); proc.stdout.removeListener('error', this.onStreamError); proc.stderr.removeListener('error', this.onStreamError);
  };
  private fail(error: SidecarConnectionError): void {
    if (this.state === 'closed' || this.killing) return;
    const failure = this.kill(); this.finish(failure ?? error, this.closing);
  }
  private kill(): SidecarConnectionError | null {
    if (this.terminated || this.process.killed || typeof this.process.exitCode === 'number') return null;
    this.killing = true;
    try { return this.process.kill() ? null : sidecarStopError(); }
    catch { return sidecarStopError(); }
    finally { this.killing = false; }
  }
  private rejectPending(error: Error): void {
    for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.reject(error); }
    this.pending.clear();
  }
  private finish(error: SidecarConnectionError, intentional: boolean): void {
    if (this.state === 'closed') return;
    this.state = 'closed'; this.closing = true; clearTimeout(this.readyTimer); this.rejectReady(error); this.rejectPending(error); this.framing.clear();
    this.process.stdout.removeListener('data', this.onData); this.process.stderr.removeListener('data', this.drainStderr);
    this.options.onClosed(error, intentional);
  }
}
