import type { WorkspaceAutomationService } from '../../workspace-automation-service.ts';

export function init(this: WorkspaceAutomationService): void {
    this.loadState();
  }
