import type { WorkspaceAutomationService } from '../../workspace-automation-service.ts';
import type { WorkflowTemplateDefinition } from '../types';

export function getCustomTemplate(this: WorkspaceAutomationService, templateId: string): WorkflowTemplateDefinition {
    const template = this.state.templates.find((candidate) => candidate.id === templateId);
    if (!template) {
      throw new Error('No encontre el flujo personalizado solicitado.');
    }
    return structuredClone(template);
  }
