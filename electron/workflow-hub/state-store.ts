import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { mirrorHubStateFile, restoreHubStateFile, type HubStateRestoreResult } from '../hub-state-store';
import type { WorkflowHubState } from './types';

const HUB_STATE_SERVICE_NAME = 'workflow-hub';

export function getWorkflowHubStatePath(): string {
  return path.join(app.getPath('userData'), 'workflow-hub-state.json');
}

/**
 * Sincroniza el archivo local con la base del Hub: los workflows sobreviven
 * a un formateo o cambio de maquina. Si devuelve 'restaurado', el llamador
 * debe recargar su estado desde el archivo.
 */
export function restoreWorkflowHubStateFromHub(): Promise<HubStateRestoreResult> {
  return restoreHubStateFile(HUB_STATE_SERVICE_NAME, getWorkflowHubStatePath());
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
  mirrorHubStateFile(HUB_STATE_SERVICE_NAME, statePath);
}
