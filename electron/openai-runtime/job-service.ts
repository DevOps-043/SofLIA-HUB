import type { Response, ResponseStreamEvent } from 'openai/resources/responses/responses';
import { OPENAI_RUNTIME_LIMITS as limits, objectValue, openaiFailure, openaiSnapshot, type NativeOpenAIFailure, type NativeOpenAIRead, type NativeOpenAIReply, type NativeOpenAIRequest } from '../../src/shared/openai-runtime';
import { publicOpenAIError } from './provider-errors';
import type { OpenAIProvider, OpenAIScope } from './types';
import { createLogger } from '../utils/logger';
const log = createLogger('ia-openai');

interface Job {
  id: string; scope: OpenAIScope; controller: AbortController; ready: Promise<void>; started: number;
  response?: Response; iterator?: AsyncIterator<ResponseStreamEvent>; failure?: NativeOpenAIFailure;
  cursor: number; last?: { requested: number; reply: NativeOpenAIReply<NativeOpenAIRead> };
  reading: boolean; cancelled: boolean; finished: boolean; bytes: number; closing?: Promise<void>;
  readTask?: Promise<NativeOpenAIReply<NativeOpenAIRead>>; iteratorClosed?: Promise<void>;
  hard?: ReturnType<typeof setTimeout>; idle?: ReturnType<typeof setTimeout>; revoke(): void;
}

/** Demanda de lectura y cuota física separadas de los registros retenidos para replay. */
export class OpenAIJobService {
  private readonly jobs = new Map<string, Job>();
  private readonly physical = new Set<Job>();
  constructor(private readonly provider: OpenAIProvider) {}

  start(scope: OpenAIScope, id: string, body: NativeOpenAIRequest, maxRetries: number): NativeOpenAIReply<{ requestId: string }> {
    scope.authority.assert();
    const key = scope.id + ':' + id;
    if (this.jobs.has(key) || this.jobs.size >= limits.retainedJobs || this.physical.size >= limits.physicalJobs) return openaiFailure('BUSY');
    const controller = new AbortController();
    const job: Job = { id, scope, controller, started: Date.now(), ready: Promise.resolve(), cursor: 0, reading: false, cancelled: false, finished: false, bytes: 0, revoke: () => { this.stop(job); } };
    this.jobs.set(key, job); this.physical.add(job);
    scope.authority.signal.addEventListener('abort', job.revoke, { once: true });
    job.hard = setTimeout(job.revoke, limits.requestMs); job.hard.unref?.(); this.idle(job);
    job.ready = Promise.resolve().then(async () => {
      this.assert(job);
      const result = await this.provider(scope, body, controller.signal, maxRetries);
      if (body.stream === true) {
        if (!result || !(Symbol.asyncIterator in result)) throw new Error('El proveedor no devolvió un stream.');
        job.iterator = result[Symbol.asyncIterator]();
        this.assert(job);
      } else {
        this.assert(job);
        const snapshot = openaiSnapshot(result, limits.eventBytes);
        if (!objectValue(snapshot) || typeof snapshot.output_text !== 'string') throw new Error('Respuesta de inferencia no válida.');
        if (snapshot.status === 'failed' || snapshot.error !== undefined && snapshot.error !== null) job.failure = publicOpenAIError(snapshot.error);
        else job.response = snapshot as unknown as Response;
        job.finished = true; this.release(job);
      }
    }).catch(error => {
      job.failure = job.cancelled || controller.signal.aborted ? openaiFailure('CANCELLED') : publicOpenAIError(error);
      job.finished = true;
      if (!job.iterator) this.release(job); else this.stop(job);
    });
    if (scope.authority.signal.aborted) this.stop(job);
    return { success: true, requestId: id };
  }

  async pull(scope: OpenAIScope, id: string, cursor: number): Promise<NativeOpenAIReply<NativeOpenAIRead>> {
    scope.authority.assert();
    const job = this.jobs.get(scope.id + ':' + id);
    if (!job || job.scope !== scope) return openaiFailure('IPC_DENIED');
    if (job.cancelled) return openaiFailure('CANCELLED');
    if (job.last?.requested === cursor) return job.last.reply;
    if (job.reading || cursor !== job.cursor) return openaiFailure('BUSY');
    job.reading = true; if (job.idle) clearTimeout(job.idle);
    const read = (async (): Promise<NativeOpenAIReply<NativeOpenAIRead>> => {
      await job.ready; this.assert(job);
      if (job.failure) return job.failure;
      if (job.response) return { success: true, kind: 'response', response: job.response, cursor: ++job.cursor };
      if (job.finished) return { success: true, kind: 'done', cursor: ++job.cursor };
      if (!job.iterator) throw new Error('Stream no disponible.');
      const next = await job.iterator.next(); this.assert(job);
      if (next.done) {
        job.finished = true; await this.closeIterator(job); this.release(job);
        return { success: true, kind: 'done', cursor: ++job.cursor };
      }
      const event = openaiSnapshot(next.value, limits.eventBytes);
      if (!objectValue(event) || typeof event.type !== 'string') throw new Error('Evento de inferencia no válido.');
      job.bytes += Buffer.byteLength(JSON.stringify(event));
      if (job.bytes > limits.streamBytes) throw new Error('Stream de inferencia excesivo.');
      if (event.type === 'error' || event.type === 'response.failed' || objectValue(event.response) && (event.response.status === 'failed' || event.response.error !== undefined && event.response.error !== null)) {
        const detail = objectValue(event.response) && objectValue(event.response.error) ? event.response.error : event;
        job.failure = publicOpenAIError(detail); return job.failure;
      }
      return { success: true, kind: 'event', event: event as unknown as ResponseStreamEvent, cursor: ++job.cursor };
    })();
    job.readTask = read;
    const signal = job.controller.signal;
    let onAbort!: () => void;
    const aborted = new Promise<NativeOpenAIFailure>(resolve => { onAbort = () => resolve(openaiFailure('CANCELLED')); signal.addEventListener('abort', onAbort, { once: true }); if (signal.aborted) onAbort(); });
    try {
      const reply = await Promise.race([read, aborted]);
      scope.authority.assert();
      if (job.cancelled) return openaiFailure('CANCELLED');
      if (!reply.success) { this.stop(job); return reply; }
      job.last = { requested: cursor, reply }; return reply;
    } catch (error) {
      const failure = job.cancelled || signal.aborted ? openaiFailure('CANCELLED') : publicOpenAIError(error);
      this.stop(job); return failure;
    } finally {
      signal.removeEventListener('abort', onAbort);
      // Una lectura abandonada conserva exclusión hasta concluir el next físico.
      void read.finally(() => { job.reading = false; if (!job.cancelled) this.idle(job); }).catch(() => undefined);
    }
  }

  cancel(scope: OpenAIScope, id: string): boolean {
    scope.authority.assert(); const job = this.jobs.get(scope.id + ':' + id);
    if (!job || job.scope !== scope) return false;
    this.stop(job); return true;
  }
  cancelScope(scope: OpenAIScope): void { for (const job of this.jobs.values()) if (job.scope === scope) this.stop(job); }

  private assert(job: Job): void {
    job.scope.authority.assert();
    if (job.cancelled || job.controller.signal.aborted) throw new Error('Generación cancelada.');
  }
  private idle(job: Job): void {
    if (job.idle) clearTimeout(job.idle);
    job.idle = setTimeout(job.revoke, limits.idleMs); job.idle.unref?.();
  }
  private release(job: Job): void {
    if (this.physical.delete(job)) log.info({ durationMs: Date.now() - job.started, cancelled: job.cancelled, failed: Boolean(job.failure), bytes: job.bytes }, 'Generación OpenAI finalizada en el proceso nativo.');
    if (job.hard) clearTimeout(job.hard);
  }
  private async closeIterator(job: Job): Promise<void> {
    if (!job.iteratorClosed) job.iteratorClosed = Promise.resolve().then(async () => { if (job.iterator?.return) await job.iterator.return(); });
    await job.iteratorClosed;
  }
  private stop(job: Job): void {
    if (job.cancelled) return;
    job.cancelled = true; job.controller.abort();
    if (job.hard) clearTimeout(job.hard); if (job.idle) clearTimeout(job.idle);
    job.scope.authority.signal.removeEventListener('abort', job.revoke);
    job.closing = (async () => {
      try { await job.ready; await job.readTask?.catch(() => undefined); await this.closeIterator(job); }
      finally { this.release(job); if (this.jobs.get(job.scope.id + ':' + job.id) === job) this.jobs.delete(job.scope.id + ':' + job.id); }
    })();
    void job.closing.catch(() => undefined);
  }
}
