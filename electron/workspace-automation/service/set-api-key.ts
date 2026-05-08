import type { WorkspaceAutomationService } from '../../workspace-automation-service.ts';

export function setApiKey(this: WorkspaceAutomationService, apiKey: string | null): void {
    this.llmTaskService.setApiKey(apiKey);
  }
