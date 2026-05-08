import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import type { WorkflowHubState } from './types';

export function getWorkflowHubStatePath(): string {
  return path.join(app.getPath('userData'), 'workflow-hub-state.json');
}

export function loadWorkflowHubState(): WorkflowHubState {
  const statePath = getWorkflowHubStatePath();
  if (!fs.existsSync(statePath)) {
    const emptyState: WorkflowHubState = { variants: [] };
    saveWorkflowHubState(emptyState);
    return emptyState;
  }

  const parsed = JSON.parse(fs.readFileSync(statePath, 'utf-8')) as Partial<WorkflowHubState>;
  return {
    variants: Array.isArray(parsed.variants) ? parsed.variants : [],
  };
}

export function saveWorkflowHubState(state: WorkflowHubState): void {
  const statePath = getWorkflowHubStatePath();
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf-8');
}
