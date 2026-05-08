import type { WorkspaceAutomationService } from '../../workspace-automation-service.ts';
import path from 'node:path';
import { app } from 'electron';

export function getStatePath(this: WorkspaceAutomationService): string {
    return path.join(app.getPath('userData'), 'workspace-automation-state.json');
  }
