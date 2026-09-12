import type { BrowserAgentControlAction, BrowserAgentTaskState } from '../../src/shared/browser-agent-control';
import { assertCuNotAborted } from './gemini-cu/execution-guard';

/** Puerto exclusivamente main: el renderer sólo recibe instantáneas y comandos cerrados. */
export interface BrowserCuControlPort {
  snapshot(): BrowserAgentTaskState;
  command(action: BrowserAgentControlAction): void;
  subscribe(listener: () => void): () => void;
}

export class BrowserCuSupervisor implements BrowserCuControlPort {
  private status: BrowserAgentTaskState['status'] = 'starting';
  private currentStep = 0;
  private revision = 0;
  private phase: AbortController | null = null;
  private wake: (() => void) | null = null;
  private listeners = new Set<() => void>();
  private finished = false;
  private readonly onAbort = () => {
    this.phase?.abort();
    this.wake?.();
    this.setStatus('stopping');
  };

  constructor(readonly taskId: string, readonly maxSteps: number, private readonly root: AbortController) {
    root.signal.addEventListener('abort', this.onAbort, { once: true });
    if (root.signal.aborted) this.onAbort();
  }
  get signal(): AbortSignal { return this.root.signal; }
  get pauseRequested(): boolean { return this.status === 'pausing'; }
  snapshot(): BrowserAgentTaskState { return { taskId: this.taskId, revision: this.revision, status: this.status, currentStep: this.currentStep, maxSteps: this.maxSteps }; }
  subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  private setStatus(status: BrowserAgentTaskState['status']): void {
    if (this.status === status) return;
    this.status = status;
    this.revision += 1;
    for (const listener of this.listeners) listener();
  }
  step(step: number): void {
    this.currentStep = step;
    for (const listener of this.listeners) listener();
  }
  command(action: BrowserAgentControlAction): void {
    if (this.finished) throw new Error('La tarea ya terminó.');
    if (action === 'stop' || action === 'take-control') { this.root.abort(); return; }
    assertCuNotAborted(this.signal);
    if (action === 'pause' && this.status === 'executing') {
      this.setStatus('pausing');
      this.phase?.abort();
    } else if (action === 'resume' && this.status === 'paused') {
      this.setStatus('executing');
      this.wake?.();
    } else throw new Error('El estado de la tarea cambió. Revisa sus controles.');
  }
  beginPhase(): AbortSignal {
    assertCuNotAborted(this.signal);
    this.phase = new AbortController();
    this.setStatus('executing');
    return this.phase.signal;
  }
  /** Sólo se invoca después de drenar la operación nativa; nunca antes. */
  async waitForResume(): Promise<void> {
    assertCuNotAborted(this.signal);
    this.phase = null;
    await new Promise<void>(resolve => {
      this.wake = resolve;
      this.setStatus('paused');
    });
    this.wake = null;
    assertCuNotAborted(this.signal);
  }
  finish(): void {
    this.finished = true;
    this.root.abort();
    this.root.signal.removeEventListener('abort', this.onAbort);
    this.phase?.abort();
    this.wake?.();
    this.wake = null;
    this.listeners.clear();
  }
}
