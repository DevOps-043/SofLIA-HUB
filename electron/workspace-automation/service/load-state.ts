import type { WorkspaceAutomationService } from '../../workspace-automation-service.ts';
import fs from 'node:fs';
import type { WorkflowState } from '../types';

export function loadState(this: WorkspaceAutomationService): void {
    try {
      const statePath = this.getStatePath();
      if (!fs.existsSync(statePath)) {
        this.saveState();
        return;
      }

      const parsed = JSON.parse(fs.readFileSync(statePath, 'utf-8')) as Partial<WorkflowState>;
      this.state = {
        runs: Array.isArray(parsed.runs) ? parsed.runs : [],
        templates: Array.isArray(parsed.templates) ? parsed.templates : [],
      };
    } catch (error) {
      console.error('[WorkspaceAutomationService] No se pudo cargar el estado:', error);
      this.state = { runs: [], templates: [] };
      this.saveState();
    }
  }
