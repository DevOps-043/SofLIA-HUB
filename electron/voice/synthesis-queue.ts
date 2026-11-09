export const VOICE_SYNTHESIS_CONCURRENCY = 4;
export const VOICE_SYNTHESIS_WAITING = 128;
export const VOICE_SYNTHESIS_QUEUE_MS = 30_000;

/** Conserva prefetch de frases, con espera acotada y cancelable antes de consumir cuota. */
export class VoiceSynthesisQueue {
  private active = 0;
  private readonly waiting: (() => void)[] = [];
  async run<T>(signal: AbortSignal, task: () => Promise<T>): Promise<T> {
    signal.throwIfAborted();
    if (this.active >= VOICE_SYNTHESIS_CONCURRENCY) {
      if (this.waiting.length >= VOICE_SYNTHESIS_WAITING) throw new Error('voice_busy');
      await new Promise<void>((resolve, reject) => {
        const finish = (error?: Error) => {
          const index = this.waiting.indexOf(ready); if (index < 0) return;
          this.waiting.splice(index, 1); clearTimeout(timer); signal.removeEventListener('abort', abort);
          if (error) reject(error); else { this.active++; resolve(); }
        };
        const ready = () => finish();
        const abort = () => finish(new Error('context_invalid'));
        const timer = setTimeout(() => finish(new Error('voice_busy')), VOICE_SYNTHESIS_QUEUE_MS);
        this.waiting.push(ready); signal.addEventListener('abort', abort, { once: true }); if (signal.aborted) abort();
      });
    } else this.active++;
    try { signal.throwIfAborted(); return await task(); }
    finally { this.active--; this.waiting[0]?.(); }
  }
}
