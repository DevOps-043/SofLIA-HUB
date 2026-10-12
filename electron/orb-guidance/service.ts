import { EventEmitter } from 'node:events';
import { DeterministicActionError } from '../desktop-agent/action-errors';
import { initialGuidanceState, validGuidanceTarget, type GuidanceControl, type GuidanceRequest, type GuidanceState, type GuidanceTarget, type PracticeDefinition } from '../../src/shared/orb-guidance';

export type GuidancePresentation = { target: GuidanceTarget; instruction: string; signal?: AbortSignal; assertCurrent?: () => void; holdMs?: number };
export interface VisualGuidancePort {
  present(input: GuidancePresentation): Promise<void>;
  clear(): void;
  capture<T>(operation: () => Promise<T>): Promise<T>;
  wait(signal?: AbortSignal): Promise<void>;
  isPracticing?(): boolean;
  createGuard?(): () => void;
  input?<T>(operation: () => Promise<T>): Promise<T>;
}
export type GuidanceServiceOptions = {
  surfaces: { render(state: GuidanceState): Promise<void>; clear(): void; suspend?(): void; dismiss?(): void; capture<T>(operation: () => Promise<T>): Promise<T>; input?<T>(operation: () => Promise<T>): Promise<T> };
  authorized: () => boolean;
  locate: (text: string) => Promise<GuidanceTarget | null>;
};

function cancelled(): Error { return new DeterministicActionError('La indicación fue cancelada o cambió de contexto.'); }

export class OrbGuidanceService extends EventEmitter implements VisualGuidancePort {
  private state = initialGuidanceState();
  private definition: PracticeDefinition | null = null;
  private pending = new Set<() => void>();
  private expiry: ReturnType<typeof setTimeout> | null = null;
  private tracking: ReturnType<typeof setTimeout> | null = null;
  private checkRunning = false;
  private lifetime = 0;
  private practiceObservation = 0;
  private practiceOwner: (() => void) | null = null;
  private targetRequest = 0;
  private rendering: Promise<void> = Promise.resolve();

  constructor(private readonly options: GuidanceServiceOptions) { super(); }

  getState(): GuidanceState { return structuredClone(this.state); }
  isPracticing(): boolean { return this.definition !== null; }
  createGuard(): () => void {
    const lifetime = this.lifetime;
    return () => { if (lifetime !== this.lifetime || !this.options.authorized()) throw cancelled(); };
  }
  input<T>(operation: () => Promise<T>): Promise<T> { return this.options.surfaces.input?.(operation) ?? operation(); }

  async present(input: GuidancePresentation): Promise<void> {
    this.targetRequest++;
    input.assertCurrent?.();
    if (!this.options.authorized() || input.signal?.aborted) throw cancelled();
    if (!validGuidanceTarget(input.target)) throw new Error('El objetivo visual no es válido.');
    if (this.definition) throw new Error('Finaliza la práctica antes de iniciar Computer Use.');
    const lifetime = this.lifetime;
    const wasPaused = this.state.phase === 'paused';
    await this.waitForResume(input.signal);
    input.assertCurrent?.();
    if (wasPaused || lifetime !== this.lifetime || !this.options.authorized() || input.signal?.aborted) throw cancelled();
    this.cancelExpiry();
    this.update({ phase: 'presenting', target: input.target, instruction: input.instruction.slice(0, 300), message: null });
    this.renderState();
    await this.awaitRendering();
    await new Promise<void>(resolve => setTimeout(resolve, 180));
    await this.awaitRendering();
    input.assertCurrent?.();
    if (lifetime !== this.lifetime || this.state.target !== input.target || !this.options.authorized() || input.signal?.aborted) throw cancelled();
    // Las marcas no permanecen sobre un control después de cambiar la pantalla.
    this.expiry = setTimeout(() => {
      if (lifetime !== this.lifetime || this.state.target !== input.target) return;
      this.update({ target: null });
      (this.options.surfaces.suspend ?? this.options.surfaces.clear).call(this.options.surfaces);
    }, input.holdMs ?? 1500);
  }

  capture<T>(operation: () => Promise<T>): Promise<T> { return this.options.surfaces.capture(operation); }

  async wait(signal?: AbortSignal): Promise<void> {
    if (this.definition) throw cancelled();
    const lifetime = this.lifetime;
    const wasPaused = this.state.phase === 'paused';
    await this.waitForResume(signal);
    if (wasPaused || lifetime !== this.lifetime || !this.options.authorized() || signal?.aborted) throw cancelled();
  }

  control(control: GuidanceControl): void {
    if (control.action === 'stop') { this.clear(); return; }
    if (control.action === 'pause') {
      this.cancelExpiry();
      this.lifetime++;
      this.update({ phase: 'paused' });
      (this.options.surfaces.suspend ?? this.options.surfaces.clear).call(this.options.surfaces);
      return;
    }
    if (control.action === 'resume') {
      if (this.state.phase !== 'paused') return;
      this.update({ phase: this.definition ? 'practice' : 'idle', target: null });
      for (const release of [...this.pending]) release();
      if (this.definition) void this.refreshPractice();
      else this.options.surfaces.clear();
      return;
    }
    if (control.action === 'style') { if (this.state.style === control.style) return; this.update({ style: control.style }); }
    if (control.action === 'motion') { if (this.state.reducedMotion === control.reduced) return; this.update({ reducedMotion: control.reduced }); }
    if (this.state.target && this.state.phase !== 'paused') {
      const revision = this.state.revision;
      void this.renderState().catch(() => { if (revision === this.state.revision) this.clear(); });
    }
  }

  clear(): void {
    this.lifetime++;
    this.targetRequest++;
    this.practiceObservation++;
    this.cancelExpiry();
    if (this.tracking) clearTimeout(this.tracking);
    this.tracking = null;
    this.definition = null;
    this.practiceOwner = null;
    this.update({ phase: 'idle', instruction: '', target: null, practice: null, message: null });
    this.options.surfaces.clear();
    for (const release of [...this.pending]) release();
  }

  dismiss(): void {
    this.clear();
    this.options.surfaces.dismiss?.();
  }

  async startPractice(definition: PracticeDefinition, assertCurrent?: () => void): Promise<void> {
    assertCurrent?.();
    if (!this.options.authorized()) throw cancelled();
    this.clear();
    this.definition = definition;
    this.practiceOwner = assertCurrent ?? null;
    this.update({ phase: 'practice', practice: { title: definition.title, step: 1, total: definition.steps.length } });
    await this.renderState();
    await this.refreshPractice();
  }

  async showTarget(request: GuidanceRequest, assertCurrent?: () => void): Promise<void> {
    assertCurrent?.();
    if (!this.options.authorized() || this.definition) throw cancelled();
    const lifetime = this.lifetime;
    const requestId = ++this.targetRequest;
    const target = await this.options.locate(request.targetText);
    assertCurrent?.();
    if (requestId !== this.targetRequest || lifetime !== this.lifetime || !this.options.authorized()) throw cancelled();
    if (!target) throw new Error('No encuentro ese elemento en la pantalla actual.');
    if (request.style) this.control({ action: 'style', style: request.style });
    await this.present({ target, instruction: request.instruction, assertCurrent, holdMs: 8000 });
  }

  async checkPractice(): Promise<void> {
    this.practiceOwner?.();
    const practice = this.state.practice, definition = this.definition;
    if (!practice || !definition || this.state.phase === 'paused') throw new Error('No hay una práctica activa para comprobar.');
    if (this.checkRunning) throw new Error('La comprobación anterior sigue en curso.');
    this.checkRunning = true;
    this.practiceObservation++;
    if (this.tracking) clearTimeout(this.tracking);
    this.tracking = null;
    const lifetime = this.lifetime;
    this.update({ phase: 'verifying', target: null, message: null });
    (this.options.surfaces.suspend ?? this.options.surfaces.clear).call(this.options.surfaces);
    try {
      const result = await this.options.locate(definition.steps[practice.step - 1].expectedText);
      this.practiceOwner?.();
      if (lifetime !== this.lifetime || !this.options.authorized() || this.definition !== definition) return;
      if (!result) {
        this.update({ phase: 'practice', message: 'El resultado esperado aún no está visible. Completa el paso y vuelve a comprobar.' });
        await this.refreshPractice();
        return;
      }
      if (practice.step === practice.total) {
        this.definition = null;
        if (this.tracking) clearTimeout(this.tracking);
        this.tracking = null;
        this.update({ phase: 'complete', target: null, instruction: 'Práctica completada', message: 'Se comprobaron los resultados de todos los pasos.' });
        this.options.surfaces.clear();
        return;
      }
      this.update({ phase: 'practice', practice: { ...practice, step: practice.step + 1 }, message: null });
      await this.refreshPractice();
    } catch {
      if (lifetime === this.lifetime && this.definition === definition && this.options.authorized()) {
        try { this.practiceOwner?.(); } catch { this.clear(); return; }
        this.update({ phase: 'practice', target: null, message: 'No se pudo comprobar el resultado. Vuelve a intentarlo.' });
        await this.refreshPractice();
      }
    } finally { this.checkRunning = false; }
  }

  private async refreshPractice(): Promise<void> {
    if (this.tracking) clearTimeout(this.tracking);
    this.tracking = null;
    const definition = this.definition, step = this.state.practice?.step;
    if (!definition || !step || this.state.phase !== 'practice') return;
    const lifetime = this.lifetime;
    const observation = ++this.practiceObservation;
    try {
      this.practiceOwner?.();
      const entry = definition.steps[step - 1];
      const target = await this.options.locate(entry.targetText);
      if (observation !== this.practiceObservation || lifetime !== this.lifetime || definition !== this.definition || step !== this.state.practice?.step || this.state.phase !== 'practice' || !this.options.authorized()) return;
      this.practiceOwner?.();
      this.update({ target, instruction: entry.instruction,
        ...(target ? {} : { message: 'No encuentro el elemento. Abre la aplicación o muestra el control indicado.' }),
      });
      await this.renderState();
    } catch {
      if (observation === this.practiceObservation && lifetime === this.lifetime && definition === this.definition) {
        try { this.practiceOwner?.(); } catch { this.clear(); return; }
        this.update({ target: null, message: 'No se pudo localizar el elemento de la práctica.' });
        (this.options.surfaces.suspend ?? this.options.surfaces.clear).call(this.options.surfaces);
      }
    } finally {
      if (observation === this.practiceObservation && lifetime === this.lifetime && definition === this.definition && this.state.phase === 'practice') {
        this.tracking = setTimeout(() => { void this.refreshPractice(); }, 2500);
      }
    }
  }

  private update(changes: Partial<GuidanceState>): void {
    this.state = { ...this.state, ...changes, revision: this.state.revision + 1 };
    this.emit('state', this.getState());
  }

  private renderState(): Promise<void> {
    this.rendering = this.options.surfaces.render(this.getState());
    return this.rendering;
  }

  private async awaitRendering(): Promise<void> {
    for (;;) {
      const pending = this.rendering;
      try { await pending; }
      catch (error) { if (pending === this.rendering) throw error; }
      if (pending === this.rendering) return;
    }
  }

  private cancelExpiry(): void { if (this.expiry) clearTimeout(this.expiry); this.expiry = null; }

  private waitForResume(signal?: AbortSignal): Promise<void> {
    if (this.state.phase !== 'paused') return Promise.resolve();
    return new Promise((resolve, reject) => {
      const release = () => { this.pending.delete(release); signal?.removeEventListener('abort', abort); resolve(); };
      const abort = () => { this.pending.delete(release); signal?.removeEventListener('abort', abort); reject(cancelled()); };
      this.pending.add(release);
      signal?.addEventListener('abort', abort, { once: true });
      if (signal?.aborted) abort();
    });
  }
}
