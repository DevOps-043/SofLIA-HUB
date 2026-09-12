export const SHUTDOWN_SAVE_TIMEOUT_MS = 5_000;

export type ShutdownKind = 'quit' | 'update';
export type ShutdownFailure = 'timeout' | 'save-failed';
export type ShutdownDecision = 'retry' | 'cancel' | 'proceed';

interface ShutdownGuardOptions {
  prepare: () => Promise<void>;
  approve: () => void;
  resume: () => void;
  decide: (failure: ShutdownFailure) => Promise<ShutdownDecision>;
}

/** Una única salida pendiente. No interpreta un timeout como guardado exitoso. */
export class ShutdownGuard {
  private pending: { kind: ShutdownKind; promise: Promise<boolean> } | null = null;
  private generation = 0;
  private quitApproved = false;
  private committed = false;

  constructor(private readonly options: ShutdownGuardOptions) {}

  consumeQuitApproval(): boolean {
    if (!this.quitApproved) return false;
    this.quitApproved = false;
    return true;
  }

  request(kind: ShutdownKind, proceed: () => void): Promise<boolean> {
    if (this.committed) return Promise.resolve(false);
    if (this.pending) return this.pending.kind === kind ? this.pending.promise : Promise.resolve(false);
    const generation = ++this.generation;
    const promise = this.prepareAndProceed(generation, proceed);
    const entry = { kind, promise };
    this.pending = entry;
    void promise.finally(() => { if (this.pending === entry) this.pending = null; }).catch(() => undefined);
    return promise;
  }

  cancel(): void {
    if (this.committed) return;
    this.generation += 1;
    this.quitApproved = false;
    this.pending = null;
    this.options.resume();
  }

  commit(): void { this.committed = true; }

  private async prepareAndProceed(generation: number, proceed: () => void): Promise<boolean> {
    let preparation: Promise<void> | null = null;
    try {
      while (generation === this.generation) {
        // Tras timeout se espera la misma E/S. Sólo un fallo ya resuelto permite
        // iniciar otra preparación; no acumular guardados concurrentes.
        if (!preparation) {
          const started = Promise.resolve().then(() => {
            // Cancelar en el mismo turno tampoco debe iniciar una E/S tardía.
            if (generation !== this.generation) return;
            return this.options.prepare();
          });
          preparation = started;
          void started.catch(() => { if (preparation === started) preparation = null; });
        }
        const outcome = await waitForSave(preparation);
        if (generation !== this.generation) return false;
        if (outcome !== 'saved') {
          const decision = await this.options.decide(outcome);
          if (generation !== this.generation) return false;
          if (decision === 'retry') continue;
          if (decision !== 'proceed') { this.cancel(); return false; }
        }
        this.quitApproved = true;
        this.options.approve();
        proceed();
        return true;
      }
    } catch {
      // Ni rutas locales ni mensajes de proveedores salen por el diálogo.
      if (generation === this.generation) this.cancel();
      return false;
    }
    return false;
  }
}

function waitForSave(preparation: Promise<void>): Promise<'saved' | ShutdownFailure> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve('timeout'), SHUTDOWN_SAVE_TIMEOUT_MS);
    void preparation.then(
      () => { clearTimeout(timeout); resolve('saved'); },
      () => { clearTimeout(timeout); resolve('save-failed'); },
    );
  });
}
