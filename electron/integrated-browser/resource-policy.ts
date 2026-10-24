/** La política no conserva vistas nativas ni decide cómo destruirlas. */
export interface ResourceTab {
  id: string;
  lastActivatedAt: number;
}

interface ResourceLimits {
  maxLiveTabs: number;
  warmBackgroundTabs: number;
  coldGraceMs: number;
  hiddenGraceMs: number;
  retryMs: number;
}

interface ResourcePorts<T extends ResourceTab> {
  liveTabs(): T[];
  isLayoutProtected(tab: T): boolean;
  isPresented(tab: T): boolean;
  hasProtectedWork(tab: T): boolean;
  isParentUsable(): boolean;
  setThrottling(tab: T, allowed: boolean): void;
  retire(tab: T): void;
  changed(): void;
  periodicError(): void;
}

/** Comparte protección y LRU entre presión de vistas e inactividad. */
export class BrowserResourcePolicy<T extends ResourceTab> {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private generation = 0;
  private deadline = Number.POSITIVE_INFINITY;
  private retirementRevision = 0;

  constructor(private readonly ports: ResourcePorts<T>, private readonly limits: ResourceLimits) {}

  enforceBudget(): boolean {
    const generation = this.generation;
    const { changed, overBudget } = this.retireExcess();
    if (overBudget && generation === this.generation) this.schedule(this.limits.retryMs);
    return changed;
  }

  reconcile(now = Date.now()): boolean {
    this.stop();
    const generation = this.generation;
    const budget = this.retireExcess();
    const tabs = this.ports.liveTabs();
    const presented = new Set(tabs.filter(tab => this.ports.isPresented(tab)).map(tab => tab.id));
    const warm = new Set(tabs.filter(tab => !presented.has(tab.id))
      .sort((left, right) => right.lastActivatedAt - left.lastActivatedAt)
      .slice(0, this.limits.warmBackgroundTabs).map(tab => tab.id));
    const grace = this.ports.isParentUsable() ? this.limits.coldGraceMs : this.limits.hiddenGraceMs;
    let nextDelay = budget.overBudget ? this.limits.retryMs : Number.POSITIVE_INFINITY;
    let changed = budget.changed;

    for (const tab of tabs) {
      if (generation !== this.generation) return changed;
      this.ports.setThrottling(tab, !presented.has(tab.id));
      if (presented.has(tab.id) || warm.has(tab.id)) continue;
      const remaining = tab.lastActivatedAt + grace - now;
      if (remaining > 0) nextDelay = Math.min(nextDelay, remaining);
      else if (this.ports.hasProtectedWork(tab)) nextDelay = Math.min(nextDelay, this.limits.retryMs);
      else {
        this.retire(tab);
        changed = true;
      }
    }
    if (generation === this.generation && Number.isFinite(nextDelay)) this.schedule(nextDelay);
    return changed;
  }

  stop(): void {
    this.generation++;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.deadline = Number.POSITIVE_INFINITY;
  }

  private retireExcess(): { changed: boolean; overBudget: boolean } {
    const generation = this.generation;
    const tabs = this.ports.liveTabs();
    let excess = tabs.length - this.limits.maxLiveTabs;
    let changed = false;
    const candidates = tabs.filter(tab => !this.ports.isLayoutProtected(tab))
      .sort((left, right) => left.lastActivatedAt - right.lastActivatedAt);
    for (const tab of candidates) {
      if (excess <= 0 || generation !== this.generation) break;
      // Consultar justo antes de retirar: la actividad puede haber cambiado.
      if (this.ports.isLayoutProtected(tab) || this.ports.hasProtectedWork(tab)) continue;
      this.retire(tab);
      changed = true;
      excess--;
    }
    return { changed, overBudget: excess > 0 };
  }

  private schedule(delayMs: number): void {
    const delay = Math.max(1, delayMs);
    const deadline = Date.now() + delay;
    if (this.timer !== null && this.deadline <= deadline) return;
    this.stop();
    this.deadline = deadline;
    const generation = this.generation;
    this.timer = setTimeout(() => {
      if (generation !== this.generation) return;
      this.timer = null;
      this.deadline = Number.POSITIVE_INFINITY;
      // Reconcile invalida la generación al empezar; conservar la nueva para
      // que un stop durante una consulta nativa tampoco rearme el callback.
      const expectedGeneration = generation + 1;
      const retirementRevision = this.retirementRevision;
      try {
        this.reconcile();
      } catch {
        this.ports.periodicError();
        if (this.generation === expectedGeneration) this.schedule(this.limits.retryMs);
      }
      // Un fallo posterior de throttling no oculta retiradas ya completadas.
      if (retirementRevision !== this.retirementRevision) {
        try { this.ports.changed(); }
        catch {
          this.ports.periodicError();
          if (this.generation === expectedGeneration) this.schedule(this.limits.retryMs);
        }
      }
    }, delay);
    this.timer.unref?.();
  }

  private retire(tab: T): void {
    this.ports.retire(tab);
    this.retirementRevision++;
  }
}
