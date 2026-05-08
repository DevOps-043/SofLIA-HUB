import type { WorkspaceAutomationService } from '../../workspace-automation-service.ts';
import crypto from 'node:crypto';
import type { WorkflowRunRecord } from '../types';

export async function approveRun(this: WorkspaceAutomationService, runId: string, decidedBy: string, comment?: string | null): Promise<WorkflowRunRecord> {
    const run = this.getMutableRun(runId);
    if (run.status !== 'needs_approval') {
      throw new Error('Ese workflow ya no esta esperando aprobacion.');
    }

    run.approvals.push({
      id: crypto.randomUUID(),
      decision: 'approved',
      decidedBy,
      comment: comment?.trim() || null,
      createdAt: new Date().toISOString(),
    });
    this.appendLog(run, 'info', `Aprobado por ${decidedBy}.`);

    let failedActions = 0;
    for (const action of run.actions) {
      if (action.status !== 'pending') {
        continue;
      }

      try {
        action.result = await this.executeAction(action);
        action.status = 'executed';
        action.error = null;
        this.appendLog(run, 'info', `Accion ejecutada: ${action.title}.`);
      } catch (error: any) {
        action.status = 'failed';
        action.error = error?.message || String(error);
        failedActions += 1;
        this.appendLog(run, 'error', `Accion fallida (${action.title}): ${action.error}`);
      }
    }

    run.status = failedActions > 0 ? 'failed' : 'completed';
    run.updatedAt = new Date().toISOString();
    this.persistAndEmit(run);
    return structuredClone(run);
  }
