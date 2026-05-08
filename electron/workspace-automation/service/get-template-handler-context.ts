import type { WorkspaceAutomationService } from '../../workspace-automation-service.ts';
import type { WorkspaceTemplateHandlerContext } from '../handlers/types';

export function getTemplateHandlerContext(this: WorkspaceAutomationService): WorkspaceTemplateHandlerContext {
    return {
      deps: this.deps,
      llmTaskService: this.llmTaskService,
      createRun: (runInput) => this.createRun(runInput),
    };
  }
