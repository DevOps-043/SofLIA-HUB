import type { WorkspaceAutomationService } from '../../workspace-automation-service.ts';
import { TEMPLATE_DEFINITIONS } from '../templates';
import type { WorkflowTemplateDefinition } from '../types';

export function listTemplates(this: WorkspaceAutomationService): WorkflowTemplateDefinition[] {
    return [...TEMPLATE_DEFINITIONS, ...this.state.templates]
      .map((template) => structuredClone(template));
  }
