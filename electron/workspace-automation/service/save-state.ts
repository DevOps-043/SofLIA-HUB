import type { WorkspaceAutomationService } from '../../workspace-automation-service.ts';
import fs from 'node:fs';
import path from 'node:path';
import { mirrorHubStateFile } from '../../hub-state-store';

export function saveState(this: WorkspaceAutomationService): void {
    const statePath = this.getStatePath();
    fs.mkdirSync(path.dirname(statePath), { recursive: true });
    fs.writeFileSync(statePath, JSON.stringify(this.state, null, 2), 'utf-8');
    mirrorHubStateFile('workspace-automation', statePath);
  }
