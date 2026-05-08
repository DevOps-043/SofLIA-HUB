import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { app } from 'electron';
import { LlmTaskService } from './llm-task-service';

import {
  CUSTOM_EXECUTION_SCHEMA,
  CUSTOM_TEMPLATE_SCHEMA,
} from './workspace-automation/schemas';
import { executeCalendarDailyBrief } from './workspace-automation/handlers/calendar-daily-brief';
import { executeCalendarMeetingPrep } from './workspace-automation/handlers/calendar-meeting-prep';
import { executeDesktopAction } from './workspace-automation/handlers/desktop-action';
import { executeDriveProjectWorkspace } from './workspace-automation/handlers/drive-project-workspace';
import { executeGChatExecutiveUpdate } from './workspace-automation/handlers/gchat-executive-update';
import { executeGmailFollowupDraft } from './workspace-automation/handlers/gmail-followup-draft';
import { executeGmailTriage } from './workspace-automation/handlers/gmail-triage';
import type { WorkspaceTemplateHandlerContext } from './workspace-automation/handlers/types';
import {
  createDriveFolderTree,
  normalizeDriveFolderDefinition,
  sanitizeCapabilities,
} from './workspace-automation/helpers';
import { TEMPLATE_DEFINITIONS } from './workspace-automation/templates';
import type {
  CreateCustomTemplateInput,
  DriveFolderDefinition,
  ExecuteTemplateInput,
  WorkflowActionKind,
  WorkflowActionRecord,
  WorkflowDependencies,
  WorkflowRunRecord,
  WorkflowRunStatus,
  WorkflowState,
  WorkflowTemplateDefinition,
  WorkflowTemplateId,
} from './workspace-automation/types';

// Re-export public types so callers (rom './workspace-automation-service') keep working.
export type {
  WorkflowActionRecord,
  WorkflowApprovalRecord,
  WorkflowRunRecord,
  WorkflowTemplateDefinition,
} from './workspace-automation/types';

export class WorkspaceAutomationService extends EventEmitter {
  private state: WorkflowState = { runs: [], templates: [] };
  private readonly llmTaskService = new LlmTaskService();

  constructor(private readonly deps: WorkflowDependencies) {
    super();
  }

  init(): void {
    this.loadState();
  }

  setApiKey(apiKey: string | null): void {
    this.llmTaskService.setApiKey(apiKey);
  }

  isConfigured(): boolean {
    return this.llmTaskService.isConfigured();
  }

  listTemplates(): WorkflowTemplateDefinition[] {
    return [...TEMPLATE_DEFINITIONS, ...this.state.templates]
      .map((template) => structuredClone(template));
  }

  async createCustomTemplate(input: CreateCustomTemplateInput): Promise<WorkflowTemplateDefinition> {
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
        'Convierte esta necesidad empresarial en un workflow reusable para SofLIA.',
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

  listRuns(limit = 20): WorkflowRunRecord[] {
    return this.state.runs
      .slice()
      .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
      .slice(0, Math.max(1, limit))
      .map((run) => structuredClone(run));
  }

  getRun(runId: string): WorkflowRunRecord {
    const run = this.state.runs.find((candidate) => candidate.id === runId);
    if (!run) {
      throw new Error('No encontre el workflow solicitado.');
    }
    return structuredClone(run);
  }

  async executeTemplate(input: ExecuteTemplateInput): Promise<WorkflowRunRecord> {
    const handlerContext = this.getTemplateHandlerContext();
    switch (input.templateId) {
      case 'gmail_triage':
        return executeGmailTriage(input, handlerContext);
      case 'calendar_daily_brief':
        return executeCalendarDailyBrief(input, handlerContext);
      case 'gmail_followup_draft':
        return executeGmailFollowupDraft(input, handlerContext);
      case 'calendar_meeting_prep':
        return executeCalendarMeetingPrep(input, handlerContext);
      case 'drive_project_workspace':
        return executeDriveProjectWorkspace(input, handlerContext);
      case 'gchat_executive_update':
        return executeGChatExecutiveUpdate(input, handlerContext);
      case 'desktop_action':
        return executeDesktopAction(input, handlerContext);
      default:
        return this.executeCustomTemplate(input);
    }
  }

  private getTemplateHandlerContext(): WorkspaceTemplateHandlerContext {
    return {
      deps: this.deps,
      llmTaskService: this.llmTaskService,
      createRun: (runInput) => this.createRun(runInput),
    };
  }

  async approveRun(runId: string, decidedBy: string, comment?: string | null): Promise<WorkflowRunRecord> {
    const run = this.getMutableRun(runId);
    if (run.status !== 'needs_approval') {
      throw new Error('Ese workflow ya no esta esperando aprobacion.');
    }

    run.approvals.push({
      id: crypto.randomUUID(),
      decision: 'approved',
      decidedBy,
      comment: comment?.trim() || null,
      createdAt: new Date().toISOString(),
    });
    this.appendLog(run, 'info', `Aprobado por ${decidedBy}.`);

    let failedActions = 0;
    for (const action of run.actions) {
      if (action.status !== 'pending') {
        continue;
      }

      try {
        action.result = await this.executeAction(action);
        action.status = 'executed';
        action.error = null;
        this.appendLog(run, 'info', `Accion ejecutada: ${action.title}.`);
      } catch (error: any) {
        action.status = 'failed';
        action.error = error?.message || String(error);
        failedActions += 1;
        this.appendLog(run, 'error', `Accion fallida (${action.title}): ${action.error}`);
      }
    }

    run.status = failedActions > 0 ? 'failed' : 'completed';
    run.updatedAt = new Date().toISOString();
    this.persistAndEmit(run);
    return structuredClone(run);
  }

  rejectRun(runId: string, decidedBy: string, comment?: string | null): WorkflowRunRecord {
    const run = this.getMutableRun(runId);
    if (run.status !== 'needs_approval') {
      throw new Error('Ese workflow ya no esta esperando aprobacion.');
    }

    run.approvals.push({
      id: crypto.randomUUID(),
      decision: 'rejected',
      decidedBy,
      comment: comment?.trim() || null,
      createdAt: new Date().toISOString(),
    });
    run.status = 'rejected';
    run.updatedAt = new Date().toISOString();
    for (const action of run.actions) {
      if (action.status === 'pending') {
        action.status = 'skipped';
      }
    }
    this.appendLog(run, 'info', `Workflow rechazado por ${decidedBy}.`);
    this.persistAndEmit(run);
    return structuredClone(run);
  }

  private async executeCustomTemplate(payload: ExecuteTemplateInput): Promise<WorkflowRunRecord> {
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
        'Genera la ejecucion concreta de un workflow personalizado de SofLIA.',
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

  private buildCustomWorkflowActions(
    generatedActions: Array<{
      kind: WorkflowActionKind;
      title: string;
      payload: Record<string, any>;
    }>,
    template: WorkflowTemplateDefinition,
  ): WorkflowActionRecord[] {
    const allowedCapabilities = new Set<WorkflowActionKind>(
      Array.isArray(template.capabilities) && template.capabilities.length > 0
        ? template.capabilities
        : ['desktop_task'],
    );

    return (Array.isArray(generatedActions) ? generatedActions : []).reduce<WorkflowActionRecord[]>((acc, action) => {
      if (!allowedCapabilities.has(action.kind)) {
        return acc;
      }

      const title = String(action.title || '').trim() || 'Accion personalizada';
      const payload = action.payload && typeof action.payload === 'object'
        ? { ...action.payload }
        : {};

      switch (action.kind) {
        case 'desktop_task': {
          const task = String(payload.task || '').trim();
          if (!task) {
            return acc;
          }
          acc.push({
            id: crypto.randomUUID(),
            kind: 'desktop_task',
            title,
            status: 'pending',
            payload: {
              task,
              maxSteps: Number(payload.maxSteps) || undefined,
              backend: ['auto', 'browser', 'desktop', 'uia'].includes(String(payload.backend || ''))
                ? String(payload.backend)
                : undefined,
              startUrl: String(payload.startUrl || '').trim() || undefined,
            },
          });
          return acc;
        }

        case 'gchat_message': {
          const spaceName = String(payload.spaceName || '').trim();
          const text = String(payload.text || '').trim();
          if (!spaceName || !text) {
            return acc;
          }
          acc.push({
            id: crypto.randomUUID(),
            kind: 'gchat_message',
            title,
            status: 'pending',
            payload: { spaceName, text },
          });
          return acc;
        }

        case 'gmail_reply': {
          const to = Array.isArray(payload.to)
            ? payload.to.map((item) => String(item || '').trim()).filter(Boolean)
            : [];
          const subject = String(payload.subject || '').trim();
          const body = String(payload.body || '').trim();
          if (to.length === 0 || !body) {
            return acc;
          }
          acc.push({
            id: crypto.randomUUID(),
            kind: 'gmail_reply',
            title,
            status: 'pending',
            payload: { to, subject, body },
          });
          return acc;
        }

        case 'gmail_send': {
          const to = Array.isArray(payload.to)
            ? payload.to.map((item) => String(item || '').trim()).filter(Boolean)
            : [];
          const subject = String(payload.subject || '').trim();
          const body = String(payload.body || '').trim();
          if (to.length === 0 || !subject || !body) {
            return acc;
          }
          acc.push({
            id: crypto.randomUUID(),
            kind: 'gmail_send',
            title,
            status: 'pending',
            payload: { to, subject, body },
          });
          return acc;
        }

        case 'calendar_event': {
          const eventTitle = String(payload.title || '').trim();
          const start = String(payload.start || payload.startIso || '').trim();
          const end = String(payload.end || payload.endIso || '').trim();
          if (!eventTitle || !start || !end) {
            return acc;
          }
          acc.push({
            id: crypto.randomUUID(),
            kind: 'calendar_event',
            title,
            status: 'pending',
            payload: {
              title: eventTitle,
              start,
              end,
              description: String(payload.description || '').trim(),
              location: String(payload.location || '').trim(),
            },
          });
          return acc;
        }

        case 'gmail_labels': {
          const messageId = String(payload.messageId || '').trim();
          const addLabels = Array.isArray(payload.addLabels)
            ? payload.addLabels.map((item) => String(item || '').trim()).filter(Boolean)
            : [];
          const removeLabels = Array.isArray(payload.removeLabels)
            ? payload.removeLabels.map((item) => String(item || '').trim()).filter(Boolean)
            : [];
          if (!messageId || (addLabels.length === 0 && removeLabels.length === 0)) {
            return acc;
          }
          acc.push({
            id: crypto.randomUUID(),
            kind: 'gmail_labels',
            title,
            status: 'pending',
            payload: { messageId, addLabels, removeLabels },
          });
          return acc;
        }

        case 'drive_folder_tree': {
          const projectName = String(payload.projectName || '').trim();
          const parentFolderId = String(payload.parentFolderId || '').trim();
          const folders = Array.isArray(payload.folders)
            ? payload.folders
                .map((item) => normalizeDriveFolderDefinition(item))
                .filter((item): item is DriveFolderDefinition => Boolean(item))
            : [];
          if (!projectName || folders.length === 0) {
            return acc;
          }
          acc.push({
            id: crypto.randomUUID(),
            kind: 'drive_folder_tree',
            title,
            status: 'pending',
            payload: {
              projectName,
              parentFolderId: parentFolderId || undefined,
              folders,
            },
          });
          return acc;
        }

        default:
          return acc;
      }
    }, []);
  }

  private async executeAction(action: WorkflowActionRecord): Promise<Record<string, any>> {
    switch (action.kind) {
      case 'gmail_labels': {
        const result = await this.deps.gmailService.modifyLabels(
          String(action.payload.messageId || ''),
          Array.isArray(action.payload.addLabels) ? action.payload.addLabels : [],
          Array.isArray(action.payload.removeLabels) ? action.payload.removeLabels : [],
        );
        if (!result.success) {
          throw new Error(result.error || 'No se pudieron aplicar etiquetas en Gmail.');
        }
        return result;
      }

      case 'gmail_reply': {
        const result = await this.deps.gmailService.sendEmail({
          to: Array.isArray(action.payload.to) ? action.payload.to : [],
          subject: String(action.payload.subject || ''),
          body: String(action.payload.body || ''),
        });
        if (!result.success) {
          throw new Error(result.error || 'No se pudo enviar la respuesta de Gmail.');
        }
        return result;
      }

      case 'gmail_send': {
        const result = await this.deps.gmailService.sendEmail({
          to: Array.isArray(action.payload.to) ? action.payload.to : [],
          subject: String(action.payload.subject || ''),
          body: String(action.payload.body || ''),
        });
        if (!result.success) {
          throw new Error(result.error || 'No se pudo enviar el correo de Gmail.');
        }
        return result;
      }

      case 'calendar_event': {
        const result = await this.deps.calendarService.createEvent({
          title: String(action.payload.title || ''),
          start: new Date(String(action.payload.start || '')),
          end: new Date(String(action.payload.end || '')),
          description: String(action.payload.description || ''),
          location: String(action.payload.location || ''),
        });
        if (!result.success) {
          throw new Error(result.error || 'No se pudo crear el evento de calendario.');
        }
        return result;
      }

      case 'gchat_message': {
        const result = await this.deps.gchatService.sendMessage(
          String(action.payload.spaceName || ''),
          String(action.payload.text || ''),
        );
        if (!result.success) {
          throw new Error(result.error || 'No se pudo enviar el mensaje a Google Chat.');
        }
        return result;
      }

      case 'drive_folder_tree': {
        const projectName = String(action.payload.projectName || '').trim();
        const parentFolderId = String(action.payload.parentFolderId || '').trim() || undefined;
        const folders = Array.isArray(action.payload.folders)
          ? action.payload.folders
              .map((item) => normalizeDriveFolderDefinition(item))
              .filter((item): item is DriveFolderDefinition => Boolean(item))
          : [];
        if (!projectName || folders.length === 0) {
          throw new Error('La estructura de Drive esta incompleta.');
        }

        const rootResult = await this.deps.driveService.createFolder(projectName, parentFolderId);
        if (!rootResult.success || !rootResult.folderId) {
          throw new Error(rootResult.error || 'No se pudo crear la carpeta principal en Drive.');
        }

        const createdFolders = await createDriveFolderTree(this.deps.driveService, rootResult.folderId, folders);
        return {
          success: true,
          rootFolderId: rootResult.folderId,
          folders: createdFolders,
        };
      }

      case 'desktop_task': {
        const backend = typeof action.payload.backend === 'string'
          && ['auto', 'browser', 'desktop', 'uia'].includes(action.payload.backend)
          ? action.payload.backend as 'auto' | 'browser' | 'desktop' | 'uia'
          : undefined;
        const result = await this.deps.desktopAgentService.executeTask(
          String(action.payload.task || ''),
          {
            maxSteps: typeof action.payload.maxSteps === 'number' ? action.payload.maxSteps : undefined,
            backend,
            startUrl: typeof action.payload.startUrl === 'string' ? action.payload.startUrl : undefined,
          },
        );
        return {
          success: true,
          message: result,
        };
      }

      default:
        throw new Error(`Accion no soportada: ${action.kind}`);
    }
  }

  private createRun(input: {
    templateId: WorkflowTemplateId;
    title: string;
    requestedBy: string | null;
    input: Record<string, any>;
    source: Record<string, any> | null;
    preview: Record<string, any>;
    actions: WorkflowActionRecord[];
    status: WorkflowRunStatus;
    initialLog: string;
  }): WorkflowRunRecord {
    const now = new Date().toISOString();
    const run: WorkflowRunRecord = {
      id: `wf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      templateId: input.templateId,
      title: input.title,
      status: input.status,
      summary: String(input.preview.summary || input.title),
      requestedBy: input.requestedBy,
      createdAt: now,
      updatedAt: now,
      input: input.input,
      source: input.source,
      preview: input.preview,
      actions: input.actions,
      approvals: [],
      logs: [
        {
          at: now,
          level: 'info',
          message: input.initialLog,
        },
      ],
    };

    this.state.runs.unshift(run);
    this.state.runs = this.state.runs.slice(0, 100);
    this.persistAndEmit(run);
    return structuredClone(run);
  }

  private appendLog(run: WorkflowRunRecord, level: 'info' | 'error', message: string): void {
    run.logs.unshift({
      at: new Date().toISOString(),
      level,
      message,
    });
    run.logs = run.logs.slice(0, 50);
  }

  private getMutableRun(runId: string): WorkflowRunRecord {
    const run = this.state.runs.find((candidate) => candidate.id === runId);
    if (!run) {
      throw new Error('No encontre el workflow solicitado.');
    }
    return run;
  }

  private getCustomTemplate(templateId: string): WorkflowTemplateDefinition {
    const template = this.state.templates.find((candidate) => candidate.id === templateId);
    if (!template) {
      throw new Error('No encontre el flujo personalizado solicitado.');
    }
    return structuredClone(template);
  }

  private persistAndEmit(run: WorkflowRunRecord): void {
    run.updatedAt = new Date().toISOString();
    this.saveState();
    this.emit('run-updated', structuredClone(run));
  }

  private getStatePath(): string {
    return path.join(app.getPath('userData'), 'workspace-automation-state.json');
  }

  private loadState(): void {
    try {
      const statePath = this.getStatePath();
      if (!fs.existsSync(statePath)) {
        this.saveState();
        return;
      }

      const parsed = JSON.parse(fs.readFileSync(statePath, 'utf-8')) as Partial<WorkflowState>;
      this.state = {
        runs: Array.isArray(parsed.runs) ? parsed.runs : [],
        templates: Array.isArray(parsed.templates) ? parsed.templates : [],
      };
    } catch (error) {
      console.error('[WorkspaceAutomationService] No se pudo cargar el estado:', error);
      this.state = { runs: [], templates: [] };
      this.saveState();
    }
  }

  private saveState(): void {
    const statePath = this.getStatePath();
    fs.mkdirSync(path.dirname(statePath), { recursive: true });
    fs.writeFileSync(statePath, JSON.stringify(this.state, null, 2), 'utf-8');
  }
}
