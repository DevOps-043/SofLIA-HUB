import type { BrowserSessionSnapshot } from './platform-types';
import type { BrowserSessionStore } from './session-store';

interface SessionShutdownContext {
  scopeId: string;
  prepare?(): Promise<void>;
  assertCurrent(): void;
  buildSnapshot(): BrowserSessionSnapshot | null;
  canRetryLastSnapshot(): boolean;
  afterSave(): Promise<void>;
}

/** Coordina autosave y cierre; los datos y el perfil pertenecen al servicio. */
export class BrowserSessionCheckpoint {
  private committed = false;
  private flushing = false;
  private revision = 0;
  private lastSave: Promise<void> = Promise.resolve();
  private lastSaveFailed = false;
  private lastSnapshot: { scopeId: string; snapshot: BrowserSessionSnapshot } | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly store: Pick<BrowserSessionStore, 'save'>,
    private readonly onAutosaveError: (error: unknown) => void,
  ) {}

  get isCommitted(): boolean { return this.committed; }
  get isFlushing(): boolean { return this.flushing; }

  attachWindow(): void { this.committed = false; }

  queue(scopeId: string, buildSnapshot: () => BrowserSessionSnapshot | null): void {
    if (this.committed || this.flushing) return;
    this.cancelScheduledSave();
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.persist(scopeId, buildSnapshot).catch(this.onAutosaveError);
    }, 250);
    this.timer.unref?.();
  }

  cancelScheduledSave(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  persist(scopeId: string, buildSnapshot: () => BrowserSessionSnapshot | null): Promise<void> {
    if (this.committed) return Promise.resolve();
    const snapshot = buildSnapshot();
    return snapshot ? this.saveSnapshot(scopeId, snapshot) : Promise.resolve();
  }

  /** Espera la última escritura, reintenta fallos propios y estabiliza el cierre. */
  async flush(context: SessionShutdownContext): Promise<void> {
    const revision = this.revision;
    const assertCurrent = () => {
      if (revision !== this.revision) throw new Error('La sesión cambió durante el cierre.');
      context.assertCurrent();
    };
    this.flushing = true;
    this.cancelScheduledSave();
    if (context.prepare) await context.prepare();
    assertCurrent();
    const previous = this.lastSnapshot;
    if (context.canRetryLastSnapshot() && this.lastSaveFailed && previous?.scopeId === context.scopeId) {
      await this.saveSnapshot(context.scopeId, previous.snapshot);
    } else await this.persist(context.scopeId, context.buildSnapshot);
    // Incluye una escritura iniciada antes de desmontar las últimas vistas.
    await this.lastSave;
    assertCurrent();
    while (true) {
      const current = context.buildSnapshot();
      const saved = this.lastSnapshot?.snapshot;
      // savedAt cambia aunque las pestañas y su disposición sean idénticas.
      if (!current || !saved || JSON.stringify({ ...current, savedAt: '' }) === JSON.stringify({ ...saved, savedAt: '' })) break;
      await this.saveSnapshot(context.scopeId, current);
      assertCurrent();
    }
    await context.afterSave();
    assertCurrent();
  }

  commit(): void {
    this.committed = true;
    this.cancelScheduledSave();
  }

  resume(): void {
    this.revision++;
    this.flushing = false;
    this.committed = false;
  }

  /** Se invoca después de drenar el perfil saliente, sin reabrir el cierre. */
  resetProfile(): void {
    this.cancelScheduledSave();
    this.lastSave = Promise.resolve();
    this.lastSaveFailed = false;
    this.lastSnapshot = null;
  }

  saveSnapshot(scopeId: string, snapshot: BrowserSessionSnapshot): Promise<void> {
    const saving = this.store.save(snapshot);
    this.lastSnapshot = { scopeId, snapshot };
    this.lastSaveFailed = false;
    this.lastSave = saving;
    // Conservar el rechazo para la barrera sin dejar una promesa huérfana.
    void saving.catch(() => { if (this.lastSave === saving) this.lastSaveFailed = true; });
    return saving;
  }
}
