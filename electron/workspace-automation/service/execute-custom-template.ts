import type { WorkspaceAutomationService } from '../../workspace-automation-service.ts';
import { CUSTOM_EXECUTION_SCHEMA } from '../schemas';
import type { ExecuteTemplateInput, WorkflowActionKind, WorkflowRunRecord } from '../types';

export async function executeCustomTemplate(this: WorkspaceAutomationService, payload: ExecuteTemplateInput): Promise<WorkflowRunRecord> {
    const template = this.getCustomTemplate(payload.templateId);
    const details = String(payload.input?.details || payload.input?.request || '').trim();
    const execution = await this.llmTaskService.runJsonTask<{
      summary: string;
      rationale: string;
      steps: string[];
      missingData: string[];
      confidence: number;
      needsApproval: boolean;
      actions: Array<{
        kind: WorkflowActionKind;
        title: string;
        payload: Record<string, any>;
      }>;
    }>({
      prompt: [
        'Genera la ejecucion concreta de un workflow personalizado de Pulse.',
        'No inventes accesos ni datos.',
        'Si faltan datos criticos, mencialos en missingData y evita acciones riesgosas.',
        'Solo puedes usar acciones de los tipos permitidos por capabilities.',
        'Para tareas fuera de Google Workspace, usa desktop_task con instrucciones claras y autocontenidas para el agente de escritorio.',
        'Si no hace falta ejecutar nada todavia, actions puede ser un arreglo vacio.',
      ].join('\n'),
      input: {
        template,
        requestDetails: details || null,
        requestedBy: payload.requestedBy || null,
      },
      schema: CUSTOM_EXECUTION_SCHEMA,
    });

    const actions = this.buildCustomWorkflowActions(
      execution.output.actions,
      template,
    );

    return this.createRun({
      templateId: template.id,
      title: template.name,
      requestedBy: payload.requestedBy || null,
      input: {
        details: details || null,
      },
      source: {
        templateName: template.name,
        templateKind: template.kind,
      },
      preview: {
        summary: execution.output.summary,
        rationale: execution.output.rationale,
        steps: execution.output.steps,
        missingData: execution.output.missingData,
        confidence: execution.output.confidence,
        guidance: template.guidance || null,
      },
      actions,
      status: actions.length > 0 || execution.output.needsApproval ? 'needs_approval' : 'completed',
      initialLog: `Se preparo el flujo personalizado ${template.name}.`,
    });
  }
