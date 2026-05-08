import type { WorkspaceAutomationService } from '../../workspace-automation-service.ts';
import crypto from 'node:crypto';
import type { WorkflowRunRecord } from '../types';

export function rejectRun(this: WorkspaceAutomationService, runId: string, decidedBy: string, comment?: string | null): WorkflowRunRecord {
    const run = this.getMutableRun(runId);
    if (run.status !== 'needs_approval') {
      throw new Error('Ese workflow ya no esta esperando aprobacion.');
    }

    run.approvals.push({
      id: crypto.randomUUID(),
      decision: 'rejected',
      decidedBy,
      comment: comment?.trim() || null,
      createdAt: new Date().toISOString(),
    });
    run.status = 'rejected';
    run.updatedAt = new Date().toISOString();
    for (const action of run.actions) {
      if (action.status === 'pending') {
        action.status = 'skipped';
      }
    }
    this.appendLog(run, 'info', `Workflow rechazado por ${decidedBy}.`);
    this.persistAndEmit(run);
    return structuredClone(run);
  }
