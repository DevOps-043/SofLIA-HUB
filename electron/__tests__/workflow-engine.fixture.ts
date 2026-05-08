export type WorkflowState =
  | 'AWAITING_DATA'
  | 'PROCESSING_PROPOSAL'
  | 'AWAITING_APPROVAL'
  | 'GENERATING_PRESENTATION'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'TIMED_OUT';

interface WorkflowTransition {
  from: WorkflowState;
  to: WorkflowState;
  requiresApproval?: boolean;
}

export const PRESENTATION_TRANSITIONS: WorkflowTransition[] = [
  { from: 'AWAITING_DATA', to: 'PROCESSING_PROPOSAL' },
  { from: 'PROCESSING_PROPOSAL', to: 'AWAITING_APPROVAL' },
  { from: 'AWAITING_APPROVAL', to: 'GENERATING_PRESENTATION', requiresApproval: true },
  { from: 'GENERATING_PRESENTATION', to: 'COMPLETED' },
];

export class WorkflowEngine {
  private state: WorkflowState;
  private readonly transitions: WorkflowTransition[];
  private readonly traceId: string;
  private readonly idempotencyKeys = new Set<string>();
  private readonly approvals = new Map<string, boolean>();
  private readonly timeoutMs: number;
  private readonly startedAt: number;

  constructor(opts: { initialState: WorkflowState; transitions: WorkflowTransition[]; traceId: string; timeoutMs?: number }) {
    this.state = opts.initialState;
    this.transitions = opts.transitions;
    this.traceId = opts.traceId;
    this.timeoutMs = opts.timeoutMs || 0;
    this.startedAt = Date.now();
  }

  getState(): WorkflowState {
    return this.state;
  }

  getTraceId(): string {
    return this.traceId;
  }

  isTimedOut(): boolean {
    return this.timeoutMs > 0 && Date.now() - this.startedAt > this.timeoutMs;
  }

  approve(transitionKey: string): void {
    this.approvals.set(transitionKey, true);
  }

  transition(to: WorkflowState, idempotencyKey?: string): { success: boolean; error?: string } {
    if (this.isTimedOut()) {
      this.state = 'TIMED_OUT';
      return { success: false, error: 'Workflow timed out' };
    }
    if (idempotencyKey && this.idempotencyKeys.has(idempotencyKey)) return { success: true };

    const transition = this.transitions.find((item) => item.from === this.state && item.to === to);
    if (!transition) return { success: false, error: `Invalid transition from ${this.state} to ${to}` };
    if (transition.requiresApproval) {
      const key = `${transition.from}->${transition.to}`;
      if (!this.approvals.get(key)) return { success: false, error: `Transition ${key} requires human approval (HITL)` };
    }

    this.state = to;
    if (idempotencyKey) this.idempotencyKeys.add(idempotencyKey);
    return { success: true };
  }

  cancel(): void {
    this.state = 'CANCELLED';
  }
}
