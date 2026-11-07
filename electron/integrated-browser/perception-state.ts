import { randomUUID } from 'node:crypto';
import type { BrowserObservationSnapshot, BrowserObservationStatus } from './types';

export type BrowserPerceptionTarget = Readonly<{
  tabId: string;
  url: string;
  contents: object;
  documentToken: string;
  loadSequence: number;
  visualRevision: number;
  sessionGeneration: number;
  policyRevision: number;
  controlRevision: number;
}>;
export type BrowserVisualCapture = {
  tabId: string;
  url: string;
  capturedAt: string;
  screenshot: string;
  revision: number;
};
export type BrowserPerceptionLease = { target: BrowserPerceptionTarget; isCurrent: () => boolean };
type Cache<T> = { lease: BrowserPerceptionLease; value: T };
type Job<T> = { lease: BrowserPerceptionLease; promise: Promise<T | null> };
type Slot<T> = { job: Job<T> | null };
type ObservationContent = Omit<BrowserObservationSnapshot, 'id' | 'sequence'>;

function sameTarget(a: BrowserPerceptionTarget, b: BrowserPerceptionTarget): boolean {
  return a.tabId === b.tabId && a.url === b.url && a.contents === b.contents
    && a.documentToken === b.documentToken && a.loadSequence === b.loadSequence
    && a.visualRevision === b.visualRevision && a.sessionGeneration === b.sessionGeneration
    && a.policyRevision === b.policyRevision && a.controlRevision === b.controlRevision;
}

/** Propiedad efímera de percepción; no concede permisos ni cancela capturePage. */
export class BrowserPerceptionState {
  private active = true;
  private cycle = 0;
  private readonly targets = new Map<string, object>();
  private readonly visualSlot: Slot<BrowserVisualCapture> = { job: null };
  private readonly observationSlot: Slot<BrowserObservationSnapshot> = { job: null };
  private visualCache: Cache<BrowserVisualCapture> | null = null;
  private observationCache: Cache<BrowserObservationSnapshot> | null = null;
  private error: string | null = null;
  private sequence = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private timerRevision = 0;

  constructor(private readonly input: {
    isCurrent: (target: BrowserPerceptionTarget) => boolean;
    describeError: (error: unknown) => string;
  }) {}

  get enabled(): boolean { return this.active; }
  get timerPending(): boolean { return this.timer !== null; }
  get observing(): boolean { return this.observationSlot.job !== null; }

  guardCycle(): () => boolean {
    const cycle = this.cycle;
    return () => this.active && cycle === this.cycle;
  }

  acquire(source: BrowserPerceptionTarget): BrowserPerceptionLease {
    const target = { ...source };
    const cycle = this.cycle;
    let token = this.targets.get(target.tabId);
    if (!token) { token = {}; this.targets.set(target.tabId, token); }
    return { target, isCurrent: () => this.active && cycle === this.cycle
      && this.targets.get(target.tabId) === token && this.input.isCurrent(target) };
  }

  setEnabled(enabled: boolean): void {
    const changed = this.active !== enabled;
    this.active = enabled;
    this.error = null;
    if (changed || !enabled) { this.invalidate(); this.stopTimer(); }
  }

  reset(): void {
    this.invalidate(); this.stopTimer(); this.error = null;
    // El slot físico se conserva hasta settle: invalidar no crea paralelismo.
  }

  invalidate(tabId?: string): void {
    if (tabId === undefined) { this.cycle++; this.targets.clear(); }
    else this.targets.delete(tabId);
    this.invalidateDom(tabId);
    if (tabId === undefined || this.visualCache?.lease.target.tabId === tabId) this.visualCache = null;
  }

  invalidateDom(tabId?: string): void {
    if (tabId === undefined || this.observationCache?.lease.target.tabId === tabId) this.observationCache = null;
  }

  visual(target: BrowserPerceptionTarget): BrowserVisualCapture | null {
    const cached = this.visualCache;
    return cached?.lease.isCurrent() && sameTarget(cached.lease.target, target) ? cached.value : null;
  }

  observation(target: BrowserPerceptionTarget): BrowserObservationSnapshot | null {
    const cached = this.observationCache;
    return cached?.lease.isCurrent() && sameTarget(cached.lease.target, target) ? cached.value : null;
  }

  status(intervalMs: number): BrowserObservationStatus {
    return { enabled: this.active, capturing: this.observing || this.visualSlot.job !== null,
      intervalMs, lastCapturedAt: this.visualCache?.value.capturedAt ?? this.observationCache?.value.capturedAt ?? null,
      lastError: this.error };
  }

  captureVisual(lease: BrowserPerceptionLease, produce: () => Promise<BrowserVisualCapture | null>): Promise<BrowserVisualCapture | null> {
    return this.run(this.visualSlot, lease, produce, value => {
      this.visualCache = { lease, value }; return value;
    }, () => this.visual(lease.target));
  }

  captureObservation(lease: BrowserPerceptionLease, produce: () => Promise<ObservationContent | null>): Promise<BrowserObservationSnapshot | null> {
    return this.run(this.observationSlot, lease, produce, content => {
      const value = { ...content, id: randomUUID(), sequence: ++this.sequence };
      this.observationCache = { lease, value }; this.error = null; return value;
    }, () => this.observation(lease.target));
  }

  schedule(delayMs: number, capture: () => Promise<unknown>): void {
    if (!this.active) return;
    this.stopTimer();
    const revision = this.timerRevision;
    const cycle = this.cycle;
    this.timer = setTimeout(() => {
      if (revision !== this.timerRevision || !this.active) return;
      this.timer = null;
      void Promise.resolve().then(() => {
        if (this.active && cycle === this.cycle && revision === this.timerRevision) return capture();
      }).catch(error => {
        if (this.active && cycle === this.cycle && revision === this.timerRevision) this.error = this.input.describeError(error);
      });
    }, Math.max(0, delayMs));
    this.timer.unref?.();
  }

  stopTimer(): void {
    this.timerRevision++;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private async run<T, R>(slot: Slot<R>, lease: BrowserPerceptionLease, produce: () => Promise<T | null>,
    publish: (value: T) => R, fallback: () => R | null): Promise<R | null> {
    if (!lease.isCurrent()) return null;
    const previous = slot.job;
    if (previous) {
      if (previous.lease.isCurrent() && sameTarget(previous.lease.target, lease.target)) return previous.promise;
      await previous.promise;
      return this.run(slot, lease, produce, publish, fallback);
    }
    const job: Job<R> = { lease, promise: Promise.resolve(null) };
    // Instalar propietario antes de ejecutar callbacks incluso si fallan sin esperar.
    slot.job = job;
    job.promise = Promise.resolve().then(async () => {
      try {
        if (!lease.isCurrent()) return null;
        const result = await produce();
        if (!lease.isCurrent()) return null;
        return result === null ? null : publish(result);
      } catch (error) {
        if (!lease.isCurrent()) return null;
        this.error = this.input.describeError(error);
        return fallback();
      } finally {
        if (slot.job === job) slot.job = null;
      }
    });
    return job.promise;
  }
}
