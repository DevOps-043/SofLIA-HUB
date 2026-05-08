import type { WorkspaceAutomationService } from '../../workspace-automation-service.ts';

export function isConfigured(this: WorkspaceAutomationService): boolean {
    return this.llmTaskService.isConfigured();
  }
