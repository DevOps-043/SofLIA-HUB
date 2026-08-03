import type { WorkspaceAutomationService } from '../../workspace-automation-service.ts';
import { CUSTOM_TEMPLATE_SCHEMA } from '../schemas';
import { sanitizeCapabilities } from '../helpers';
import type { CreateCustomTemplateInput, WorkflowActionKind, WorkflowTemplateDefinition } from '../types';

export async function createCustomTemplate(this: WorkspaceAutomationService, input: CreateCustomTemplateInput): Promise<WorkflowTemplateDefinition> {
    const objective = String(input.objective || '').trim();
    if (!objective) {
      throw new Error('Necesito una descripcion clara del flujo que quieres crear.');
    }

    const requestedName = String(input.name || '').trim();
    const generated = await this.llmTaskService.runJsonTask<{
      name: string;
      description: string;
      goal: string;
      guidance: string;
      inputHints: string[];
      capabilities: WorkflowActionKind[];
    }>({
      prompt: [
        'Convierte esta necesidad empresarial en un workflow reusable para Pulse.',
        'El resultado debe ser entendible para directivos no tecnicos.',
        'Si el flujo puede ocurrir fuera de Google Workspace, prioriza desktop_task como capacidad principal.',
        'No inventes integraciones inexistentes.',
        'capabilities solo puede contener desktop_task, gchat_message, gmail_reply, gmail_send, calendar_event, gmail_labels o drive_folder_tree.',
        'guidance debe explicar como ejecutar el flujo y que detalle debe proporcionar el usuario al correrlo.',
      ].join('\n'),
      input: {
        requestedName: requestedName || null,
        objective,
      },
      schema: CUSTOM_TEMPLATE_SCHEMA,
    });

    const template: WorkflowTemplateDefinition = {
      id: `custom_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      kind: 'custom',
      name: requestedName || generated.output.name.trim(),
      description: generated.output.description.trim(),
      goal: generated.output.goal.trim(),
      guidance: generated.output.guidance.trim(),
      inputHints: Array.isArray(generated.output.inputHints)
        ? generated.output.inputHints.map((item) => String(item || '').trim()).filter(Boolean)
        : [],
      capabilities: sanitizeCapabilities(generated.output.capabilities),
      inputSchema: {
        details: 'string opcional',
      },
      createdAt: new Date().toISOString(),
      createdBy: input.requestedBy || null,
    };

    this.state.templates.unshift(template);
    this.state.templates = this.state.templates.slice(0, 100);
    this.saveState();
    this.emit('template-created', structuredClone(template));
    return structuredClone(template);
  }
