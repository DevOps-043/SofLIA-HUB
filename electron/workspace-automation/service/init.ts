import type { WorkspaceAutomationService } from '../../workspace-automation-service.ts';
import { restoreHubStateFile } from '../../hub-state-store';

export async function init(this: WorkspaceAutomationService): Promise<void> {
    // Local primero (sincrono); luego se adopta el estado de la base del Hub
    // SOLO si existe alli (plantillas y runs sobreviven formateos).
    this.loadState();
    const restore = await restoreHubStateFile('workspace-automation', this.getStatePath());
    if (restore === 'restaurado') this.loadState();
  }
