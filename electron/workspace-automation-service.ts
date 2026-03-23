import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { app } from 'electron';
import type { GmailService, EmailMessage } from './gmail-service';
import type { CalendarService } from './calendar-service';
import type { GChatService } from './gchat-service';
import type { DriveService } from './drive-service';
import type { DesktopAgentService } from './desktop-agent-service';
import { LlmTaskService, type LlmTaskSchema } from './llm-task-service';

type WorkflowTemplateId = string;
type WorkflowRunStatus =
  | 'needs_approval'
  | 'completed'
  | 'failed'
  | 'rejected'
  | 'cancelled';
type WorkflowActionStatus = 'pending' | 'executed' | 'failed' | 'skipped';
type WorkflowActionKind =
  | 'gmail_labels'
  | 'gmail_reply'
  | 'gmail_send'
  | 'calendar_event'
  | 'gchat_message'
  | 'drive_folder_tree'
  | 'desktop_task';

export interface WorkflowTemplateDefinition {
  id: WorkflowTemplateId;
  name: string;
  description: string;
  kind: 'builtin' | 'custom';
  inputSchema: Record<string, unknown>;
  goal?: string | null;
  guidance?: string | null;
  inputHints?: string[];
  capabilities?: WorkflowActionKind[];
  createdAt?: string;
  createdBy?: string | null;
}

export interface WorkflowActionRecord {
  id: string;
  kind: WorkflowActionKind;
  title: string;
  status: WorkflowActionStatus;
  payload: Record<string, any>;
  result?: Record<string, any> | null;
  error?: string | null;
}

export interface WorkflowApprovalRecord {
  id: string;
  decision: 'approved' | 'rejected';
  decidedBy: string;
  comment?: string | null;
  createdAt: string;
}

export interface WorkflowRunRecord {
  id: string;
  templateId: WorkflowTemplateId;
  title: string;
  status: WorkflowRunStatus;
  summary: string;
  requestedBy: string | null;
  createdAt: string;
  updatedAt: string;
  input: Record<string, any>;
  source: Record<string, any> | null;
  preview: Record<string, any>;
  actions: WorkflowActionRecord[];
  approvals: WorkflowApprovalRecord[];
  logs: Array<{
    at: string;
    level: 'info' | 'error';
    message: string;
  }>;
}

interface WorkflowState {
  runs: WorkflowRunRecord[];
  templates: WorkflowTemplateDefinition[];
}

interface WorkflowDependencies {
  gmailService: GmailService;
  calendarService: CalendarService;
  gchatService: GChatService;
  driveService: DriveService;
  desktopAgentService: DesktopAgentService;
}

interface ExecuteTemplateInput {
  templateId: WorkflowTemplateId;
  input?: Record<string, any>;
  requestedBy?: string | null;
}

interface CreateCustomTemplateInput {
  name?: string | null;
  objective: string;
  requestedBy?: string | null;
}

const TEMPLATE_DEFINITIONS: WorkflowTemplateDefinition[] = [
  {
    id: 'gmail_triage',
    name: 'Triage de Gmail',
    description: 'Analiza el correo mas relevante, propone acciones y espera aprobacion antes de ejecutar.',
    kind: 'builtin',
    inputSchema: {
      query: 'string opcional',
      maxResults: 'number opcional',
      gchatSpace: 'string opcional',
      removeFromInbox: 'boolean opcional',
    },
  },
  {
    id: 'calendar_daily_brief',
    name: 'Briefing diario de calendario',
    description: 'Resume los eventos del dia y puede publicar el briefing en Google Chat bajo aprobacion.',
    kind: 'builtin',
    inputSchema: {
      targetDate: 'YYYY-MM-DD opcional',
      gchatSpace: 'string opcional',
    },
  },
  {
    id: 'gmail_followup_draft',
    name: 'Correo de seguimiento',
    description: 'Prepara un correo de seguimiento profesional y lo deja listo para enviar desde Gmail.',
    kind: 'builtin',
    inputSchema: {
      to: 'correo requerido',
      topic: 'string requerido',
      context: 'string opcional',
      tone: 'string opcional',
      signature: 'string opcional',
    },
  },
  {
    id: 'calendar_meeting_prep',
    name: 'Preparacion de reunion',
    description: 'Resume la siguiente reunion del dia, sugiere talking points y puede compartir el prep en Google Chat.',
    kind: 'builtin',
    inputSchema: {
      targetDate: 'YYYY-MM-DD opcional',
      gchatSpace: 'string opcional',
    },
  },
  {
    id: 'drive_project_workspace',
    name: 'Espacio de proyecto en Drive',
    description: 'Crea una estructura base de carpetas en Drive para organizar un proyecto o cliente.',
    kind: 'builtin',
    inputSchema: {
      projectName: 'string requerido',
      parentFolderId: 'string opcional',
      gchatSpace: 'string opcional',
      folders: 'array opcional',
    },
  },
  {
    id: 'gchat_executive_update',
    name: 'Actualizacion ejecutiva en Chat',
    description: 'Redacta y prepara un mensaje ejecutivo para Google Chat.',
    kind: 'builtin',
    inputSchema: {
      spaceName: 'string requerido',
      context: 'string requerido',
      tone: 'string opcional',
    },
  },
  {
    id: 'desktop_action',
    name: 'Accion en mi computadora',
    description: 'Prepara una accion operativa dentro de la computadora para ejecutarla con autorizacion.',
    kind: 'builtin',
    inputSchema: {
      objective: 'string requerido',
    },
  },
];

const GMAIL_TRIAGE_SCHEMA: LlmTaskSchema = {
  type: 'object',
  required: ['decision', 'summary', 'rationale', 'labelsToAdd', 'archive', 'confidence'],
  additionalProperties: false,
  properties: {
    decision: {
      type: 'string',
      enum: ['reply', 'label_only', 'schedule', 'notify_chat', 'ignore'],
    },
    summary: { type: 'string' },
    rationale: { type: 'string' },
    labelsToAdd: {
      type: 'array',
      items: { type: 'string' },
    },
    archive: { type: 'boolean' },
    confidence: { type: 'number' },
    reply: {
      type: 'object',
      required: ['subject', 'body'],
      additionalProperties: false,
      properties: {
        subject: { type: 'string' },
        body: { type: 'string' },
      },
    },
    calendarEvent: {
      type: 'object',
      required: ['title', 'startIso', 'endIso', 'description'],
      additionalProperties: false,
      properties: {
        title: { type: 'string' },
        startIso: { type: 'string' },
        endIso: { type: 'string' },
        description: { type: 'string' },
        location: { type: 'string' },
      },
    },
    chatNotification: {
      type: 'object',
      required: ['text'],
      additionalProperties: false,
      properties: {
        text: { type: 'string' },
      },
    },
  },
};

const CALENDAR_BRIEF_SCHEMA: LlmTaskSchema = {
  type: 'object',
  required: ['summary', 'keyPoints', 'risks', 'shouldSendChat', 'confidence'],
  additionalProperties: false,
  properties: {
    summary: { type: 'string' },
    keyPoints: {
      type: 'array',
      items: { type: 'string' },
    },
    risks: {
      type: 'array',
      items: { type: 'string' },
    },
    shouldSendChat: { type: 'boolean' },
    confidence: { type: 'number' },
    chatDraft: { type: 'string' },
  },
};

const GMAIL_FOLLOWUP_SCHEMA: LlmTaskSchema = {
  type: 'object',
  required: ['summary', 'subject', 'body', 'confidence'],
  additionalProperties: false,
  properties: {
    summary: { type: 'string' },
    subject: { type: 'string' },
    body: { type: 'string' },
    confidence: { type: 'number' },
  },
};

const CALENDAR_MEETING_PREP_SCHEMA: LlmTaskSchema = {
  type: 'object',
  required: ['summary', 'talkingPoints', 'risks', 'shouldSendChat', 'confidence'],
  additionalProperties: false,
  properties: {
    summary: { type: 'string' },
    talkingPoints: {
      type: 'array',
      items: { type: 'string' },
    },
    risks: {
      type: 'array',
      items: { type: 'string' },
    },
    shouldSendChat: { type: 'boolean' },
    chatDraft: { type: 'string' },
    confidence: { type: 'number' },
  },
};

const GCHAT_EXECUTIVE_UPDATE_SCHEMA: LlmTaskSchema = {
  type: 'object',
  required: ['summary', 'message', 'confidence'],
  additionalProperties: false,
  properties: {
    summary: { type: 'string' },
    message: { type: 'string' },
    confidence: { type: 'number' },
  },
};

const DESKTOP_ACTION_SCHEMA: LlmTaskSchema = {
  type: 'object',
  required: ['summary', 'rationale', 'task', 'confidence'],
  additionalProperties: false,
  properties: {
    summary: { type: 'string' },
    rationale: { type: 'string' },
    task: { type: 'string' },
    confidence: { type: 'number' },
  },
};

const CUSTOM_TEMPLATE_SCHEMA: LlmTaskSchema = {
  type: 'object',
  required: ['name', 'description', 'goal', 'guidance', 'inputHints', 'capabilities'],
  additionalProperties: false,
  properties: {
    name: { type: 'string' },
    description: { type: 'string' },
    goal: { type: 'string' },
    guidance: { type: 'string' },
    inputHints: {
      type: 'array',
      items: { type: 'string' },
    },
    capabilities: {
      type: 'array',
      items: {
        type: 'string',
        enum: ['desktop_task', 'gchat_message', 'gmail_reply', 'gmail_send', 'calendar_event', 'gmail_labels', 'drive_folder_tree'],
      },
    },
  },
};

const CUSTOM_EXECUTION_SCHEMA: LlmTaskSchema = {
  type: 'object',
  required: ['summary', 'rationale', 'steps', 'missingData', 'confidence', 'needsApproval', 'actions'],
  additionalProperties: false,
  properties: {
    summary: { type: 'string' },
    rationale: { type: 'string' },
    steps: {
      type: 'array',
      items: { type: 'string' },
    },
    missingData: {
      type: 'array',
      items: { type: 'string' },
    },
    confidence: { type: 'number' },
    needsApproval: { type: 'boolean' },
    actions: {
      type: 'array',
      items: {
        type: 'object',
        required: ['kind', 'title', 'payload'],
        additionalProperties: false,
        properties: {
          kind: {
            type: 'string',
            enum: ['desktop_task', 'gchat_message', 'gmail_reply', 'gmail_send', 'calendar_event', 'gmail_labels', 'drive_folder_tree'],
          },
          title: { type: 'string' },
          payload: {
            type: 'object',
            properties: {},
          },
        },
      },
    },
  },
};

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
    switch (input.templateId) {
      case 'gmail_triage':
        return this.executeGmailTriage(input);
      case 'calendar_daily_brief':
        return this.executeCalendarDailyBrief(input);
      case 'gmail_followup_draft':
        return this.executeGmailFollowupDraft(input);
      case 'calendar_meeting_prep':
        return this.executeCalendarMeetingPrep(input);
      case 'drive_project_workspace':
        return this.executeDriveProjectWorkspace(input);
      case 'gchat_executive_update':
        return this.executeGChatExecutiveUpdate(input);
      case 'desktop_action':
        return this.executeDesktopAction(input);
      default:
        return this.executeCustomTemplate(input);
    }
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

  private async executeGmailTriage(payload: ExecuteTemplateInput): Promise<WorkflowRunRecord> {
    const query = String(payload.input?.query || 'in:inbox newer_than:7d').trim();
    const maxResults = Math.min(Math.max(Number(payload.input?.maxResults) || 5, 1), 10);
    const removeFromInbox = payload.input?.removeFromInbox !== false;
    const gchatSpace = typeof payload.input?.gchatSpace === 'string' ? payload.input.gchatSpace.trim() : '';

    const messagesResult = await this.deps.gmailService.getMessages({ query, maxResults });
    if (!messagesResult.success || !messagesResult.messages?.length) {
      throw new Error(messagesResult.error || 'No encontre correos para el triage.');
    }

    const targetMessage = pickBestMessage(messagesResult.messages);
    const messageDetailResult = await this.deps.gmailService.getMessage(targetMessage.id);
    if (!messageDetailResult.success || !messageDetailResult.message) {
      throw new Error(messageDetailResult.error || 'No pude leer el correo seleccionado.');
    }

    const detail = messageDetailResult.message;
    const triage = await this.llmTaskService.runJsonTask<{
      decision: 'reply' | 'label_only' | 'schedule' | 'notify_chat' | 'ignore';
      summary: string;
      rationale: string;
      labelsToAdd: string[];
      archive: boolean;
      confidence: number;
      reply?: { subject: string; body: string };
      calendarEvent?: { title: string; startIso: string; endIso: string; description: string; location?: string };
      chatNotification?: { text: string };
    }>({
      prompt: [
        'Analiza este correo y propone una accion operativa.',
        'Usa solo una decision principal: reply, label_only, schedule, notify_chat o ignore.',
        'Si propones schedule, debes devolver calendarEvent con fechas ISO completas.',
        'Si propones reply, debes devolver reply con subject y body listos para enviar.',
        'Si propones notify_chat y existe gchatSpace, devuelve chatNotification.text.',
        'Puedes agregar labelsToAdd siempre que ayuden a clasificar.',
        'archive debe ser true solo si el correo ya quedara gestionado despues de ejecutar la accion propuesta.',
        'Responde en espanol profesional y concreto.',
      ].join('\n'),
      input: {
        email: {
          id: detail.id,
          threadId: detail.threadId,
          from: detail.from,
          subject: detail.subject,
          snippet: detail.snippet,
          body: detail.body || '',
          date: detail.date.toISOString(),
          labelIds: detail.labelIds,
          isUnread: detail.isUnread,
        },
        options: {
          gchatSpace: gchatSpace || null,
          removeFromInbox,
        },
      },
      schema: GMAIL_TRIAGE_SCHEMA,
    });

    const actions = this.buildGmailTriageActions(detail, triage.output, {
      gchatSpace,
      removeFromInbox,
    });

    return this.createRun({
      templateId: 'gmail_triage',
      title: `Triage Gmail: ${detail.subject || 'Sin asunto'}`,
      requestedBy: payload.requestedBy || null,
      input: {
        query,
        maxResults,
        gchatSpace: gchatSpace || null,
        removeFromInbox,
      },
      source: {
        messageId: detail.id,
        threadId: detail.threadId,
        from: detail.from,
        subject: detail.subject,
        date: detail.date.toISOString(),
      },
      preview: {
        summary: triage.output.summary,
        rationale: triage.output.rationale,
        confidence: triage.output.confidence,
        decision: triage.output.decision,
        reply: triage.output.reply || null,
        calendarEvent: triage.output.calendarEvent || null,
        chatNotification: triage.output.chatNotification || null,
        labelsToAdd: triage.output.labelsToAdd || [],
        archive: Boolean(triage.output.archive),
      },
      actions,
      status: actions.length > 0 ? 'needs_approval' : 'completed',
      initialLog: `Correo analizado: ${detail.subject || 'Sin asunto'} (${detail.from}).`,
    });
  }

  private async executeCalendarDailyBrief(payload: ExecuteTemplateInput): Promise<WorkflowRunRecord> {
    const targetDate = parseTargetDate(payload.input?.targetDate);
    const gchatSpace = typeof payload.input?.gchatSpace === 'string' ? payload.input.gchatSpace.trim() : '';
    const events = await this.deps.calendarService.getCurrentEvents(targetDate);

    const briefing = await this.llmTaskService.runJsonTask<{
      summary: string;
      keyPoints: string[];
      risks: string[];
      shouldSendChat: boolean;
      confidence: number;
      chatDraft?: string;
    }>({
      prompt: [
        'Genera un briefing ejecutivo de agenda diaria.',
        'Resume prioridades del dia, riesgos de calendario y si conviene notificarlo al equipo.',
        'Si shouldSendChat es true y existe gchatSpace, devuelve chatDraft listo para publicarse.',
        'No inventes eventos ni participantes.',
      ].join('\n'),
      input: {
        targetDate: formatDateOnly(targetDate),
        eventCount: events.length,
        events: events.map((event) => ({
          title: event.title,
          start: event.start.toISOString(),
          end: event.end.toISOString(),
          isAllDay: event.isAllDay,
          location: event.location || null,
          description: event.description || null,
          source: event.source,
        })),
        options: {
          gchatSpace: gchatSpace || null,
        },
      },
      schema: CALENDAR_BRIEF_SCHEMA,
    });

    const actions: WorkflowActionRecord[] = [];
    if (briefing.output.shouldSendChat && briefing.output.chatDraft?.trim() && gchatSpace) {
      actions.push({
        id: crypto.randomUUID(),
        kind: 'gchat_message',
        title: 'Publicar briefing diario en Google Chat',
        status: 'pending',
        payload: {
          spaceName: gchatSpace,
          text: briefing.output.chatDraft.trim(),
        },
      });
    }

    return this.createRun({
      templateId: 'calendar_daily_brief',
      title: `Briefing de calendario ${formatDateOnly(targetDate)}`,
      requestedBy: payload.requestedBy || null,
      input: {
        targetDate: formatDateOnly(targetDate),
        gchatSpace: gchatSpace || null,
      },
      source: {
        eventCount: events.length,
      },
      preview: {
        summary: briefing.output.summary,
        keyPoints: briefing.output.keyPoints,
        risks: briefing.output.risks,
        confidence: briefing.output.confidence,
        chatDraft: briefing.output.chatDraft || null,
      },
      actions,
      status: actions.length > 0 ? 'needs_approval' : 'completed',
      initialLog: `Se genero un briefing con ${events.length} evento(s) para ${formatDateOnly(targetDate)}.`,
    });
  }

  private async executeGmailFollowupDraft(payload: ExecuteTemplateInput): Promise<WorkflowRunRecord> {
    const to = String(payload.input?.to || '').trim();
    const topic = String(payload.input?.topic || '').trim();
    const context = String(payload.input?.context || '').trim();
    const tone = String(payload.input?.tone || 'profesional y claro').trim();
    const signature = String(payload.input?.signature || '').trim();

    if (!to) {
      throw new Error('Necesito el correo destino para preparar el seguimiento.');
    }
    if (!topic) {
      throw new Error('Necesito el tema o motivo del seguimiento.');
    }

    const followup = await this.llmTaskService.runJsonTask<{
      summary: string;
      subject: string;
      body: string;
      confidence: number;
    }>({
      prompt: [
        'Redacta un correo de seguimiento ejecutivo y claro.',
        'Debe sonar profesional, humano y accionable.',
        'No inventes acuerdos, cifras ni fechas que no aparezcan en el contexto.',
        'Asume que se enviara desde Gmail y devuelve asunto y cuerpo listos para enviar.',
        'Respeta el tono solicitado si existe.',
        'Si se proporciona una firma, integrala al final del correo sin inventar cargo ni datos nuevos.',
      ].join('\n'),
      input: {
        to,
        topic,
        context: context || null,
        tone: tone || null,
        signature: signature || null,
      },
      schema: GMAIL_FOLLOWUP_SCHEMA,
    });

    const actions: WorkflowActionRecord[] = [
      {
        id: crypto.randomUUID(),
        kind: 'gmail_send',
        title: 'Enviar correo de seguimiento',
        status: 'pending',
        payload: {
          to: [to],
          subject: followup.output.subject.trim(),
          body: followup.output.body.trim(),
        },
      },
    ];

    return this.createRun({
      templateId: 'gmail_followup_draft',
      title: `Seguimiento de correo: ${topic}`,
      requestedBy: payload.requestedBy || null,
      input: {
        to,
        topic,
        context: context || null,
        tone,
        signature: signature || null,
      },
      source: null,
      preview: {
        summary: followup.output.summary,
        confidence: followup.output.confidence,
        subject: followup.output.subject,
        body: followup.output.body,
        tone,
        signature: signature || null,
      },
      actions,
      status: 'needs_approval',
      initialLog: `Se preparo un correo de seguimiento para ${to}.`,
    });
  }

  private async executeCalendarMeetingPrep(payload: ExecuteTemplateInput): Promise<WorkflowRunRecord> {
    const targetDate = parseTargetDate(payload.input?.targetDate);
    const gchatSpace = typeof payload.input?.gchatSpace === 'string' ? payload.input.gchatSpace.trim() : '';
    const events = await this.deps.calendarService.getCurrentEvents(targetDate);
    const event = pickMeetingEvent(events, targetDate);
    if (!event) {
      throw new Error('No encontre una reunion para preparar en la fecha indicada.');
    }

    const prep = await this.llmTaskService.runJsonTask<{
      summary: string;
      talkingPoints: string[];
      risks: string[];
      shouldSendChat: boolean;
      chatDraft?: string;
      confidence: number;
    }>({
      prompt: [
        'Prepara una ficha ejecutiva para la siguiente reunion del calendario.',
        'Resume objetivo probable, talking points y riesgos o huecos de informacion.',
        'No inventes asistentes ni acuerdos.',
        'Si existe gchatSpace y vale la pena compartir el prep con el equipo, activa shouldSendChat y devuelve chatDraft.',
      ].join('\n'),
      input: {
        targetDate: formatDateOnly(targetDate),
        event: {
          title: event.title,
          start: event.start.toISOString(),
          end: event.end.toISOString(),
          location: event.location || null,
          description: event.description || null,
          isAllDay: event.isAllDay,
          source: event.source,
        },
        options: {
          gchatSpace: gchatSpace || null,
        },
      },
      schema: CALENDAR_MEETING_PREP_SCHEMA,
    });

    const actions: WorkflowActionRecord[] = [];
    if (prep.output.shouldSendChat && prep.output.chatDraft?.trim() && gchatSpace) {
      actions.push({
        id: crypto.randomUUID(),
        kind: 'gchat_message',
        title: 'Compartir preparacion de reunion en Google Chat',
        status: 'pending',
        payload: {
          spaceName: gchatSpace,
          text: prep.output.chatDraft.trim(),
        },
      });
    }

    return this.createRun({
      templateId: 'calendar_meeting_prep',
      title: `Preparacion de reunion: ${event.title || 'Sin titulo'}`,
      requestedBy: payload.requestedBy || null,
      input: {
        targetDate: formatDateOnly(targetDate),
        gchatSpace: gchatSpace || null,
      },
      source: {
        eventId: event.id,
        title: event.title,
        start: event.start.toISOString(),
        end: event.end.toISOString(),
        location: event.location || null,
      },
      preview: {
        summary: prep.output.summary,
        talkingPoints: prep.output.talkingPoints,
        risks: prep.output.risks,
        confidence: prep.output.confidence,
        chatDraft: prep.output.chatDraft || null,
      },
      actions,
      status: actions.length > 0 ? 'needs_approval' : 'completed',
      initialLog: `Se preparo la reunion ${event.title || 'sin titulo'} del ${formatDateOnly(targetDate)}.`,
    });
  }

  private async executeDriveProjectWorkspace(payload: ExecuteTemplateInput): Promise<WorkflowRunRecord> {
    const projectName = String(payload.input?.projectName || '').trim();
    const parentFolderId = String(payload.input?.parentFolderId || '').trim();
    const gchatSpace = String(payload.input?.gchatSpace || '').trim();
    const requestedFolders = Array.isArray(payload.input?.folders)
      ? payload.input?.folders.map((folder) => normalizeDriveFolderDefinition(folder)).filter(Boolean) as DriveFolderDefinition[]
      : [];

    if (!projectName) {
      throw new Error('Necesito el nombre del proyecto o cliente para crear el espacio en Drive.');
    }

    const folders = requestedFolders.length > 0 ? requestedFolders : buildDriveWorkspaceFolders();
    const actions: WorkflowActionRecord[] = [
      {
        id: crypto.randomUUID(),
        kind: 'drive_folder_tree',
        title: 'Crear estructura base en Google Drive',
        status: 'pending',
        payload: {
          projectName,
          parentFolderId: parentFolderId || undefined,
          folders,
        },
      },
    ];

    if (gchatSpace) {
      actions.push({
        id: crypto.randomUUID(),
        kind: 'gchat_message',
        title: 'Avisar al equipo por Google Chat',
        status: 'pending',
        payload: {
          spaceName: gchatSpace,
          text: `SofLIA dejara listo el espacio base de Drive para "${projectName}" con las carpetas iniciales del proyecto.`,
        },
      });
    }

    return this.createRun({
      templateId: 'drive_project_workspace',
      title: `Espacio de Drive: ${projectName}`,
      requestedBy: payload.requestedBy || null,
      input: {
        projectName,
        parentFolderId: parentFolderId || null,
        gchatSpace: gchatSpace || null,
      },
      source: null,
      preview: {
        summary: `Se preparara una estructura base de Drive para ${projectName}.`,
        folders: folders.map((folder) => folder.name),
        parentFolderId: parentFolderId || null,
        gchatSpace: gchatSpace || null,
      },
      actions,
      status: 'needs_approval',
      initialLog: `Se preparo un espacio de Drive para ${projectName}.`,
    });
  }

  private async executeGChatExecutiveUpdate(payload: ExecuteTemplateInput): Promise<WorkflowRunRecord> {
    const spaceName = String(payload.input?.spaceName || '').trim();
    const context = String(payload.input?.context || '').trim();
    const tone = String(payload.input?.tone || 'ejecutivo y claro').trim();

    if (!spaceName) {
      throw new Error('Necesito el espacio de Google Chat para preparar la actualizacion.');
    }
    if (!context) {
      throw new Error('Necesito el contexto de la actualizacion ejecutiva.');
    }

    const update = await this.llmTaskService.runJsonTask<{
      summary: string;
      message: string;
      confidence: number;
    }>({
      prompt: [
        'Redacta una actualizacion ejecutiva breve para Google Chat.',
        'Debe ser clara, concreta y apta para directivos.',
        'No inventes avances ni cifras que no existan en el contexto.',
      ].join('\n'),
      input: {
        spaceName,
        context,
        tone,
      },
      schema: GCHAT_EXECUTIVE_UPDATE_SCHEMA,
    });

    const actions: WorkflowActionRecord[] = [
      {
        id: crypto.randomUUID(),
        kind: 'gchat_message',
        title: 'Enviar actualizacion ejecutiva por Google Chat',
        status: 'pending',
        payload: {
          spaceName,
          text: update.output.message.trim(),
        },
      },
    ];

    return this.createRun({
      templateId: 'gchat_executive_update',
      title: `Actualizacion ejecutiva: ${spaceName}`,
      requestedBy: payload.requestedBy || null,
      input: {
        spaceName,
        context,
        tone,
      },
      source: null,
      preview: {
        summary: update.output.summary,
        confidence: update.output.confidence,
        message: update.output.message,
      },
      actions,
      status: 'needs_approval',
      initialLog: `Se preparo una actualizacion ejecutiva para ${spaceName}.`,
    });
  }

  private async executeDesktopAction(payload: ExecuteTemplateInput): Promise<WorkflowRunRecord> {
    const objective = String(payload.input?.objective || '').trim();
    const backend = typeof payload.input?.backend === 'string' ? payload.input.backend.trim() : '';
    const startUrl = typeof payload.input?.startUrl === 'string' ? payload.input.startUrl.trim() : '';

    if (!objective) {
      throw new Error('Necesito el objetivo de la accion en tu computadora.');
    }

    const planned = await this.llmTaskService.runJsonTask<{
      summary: string;
      rationale: string;
      task: string;
      confidence: number;
    }>({
      prompt: [
        'Convierte esta necesidad operativa en una instruccion clara para un agente de escritorio.',
        'La tarea debe ser concreta, segura y autocontenida.',
        'No inventes accesos ni confirmes resultados que aun no existen.',
      ].join('\n'),
      input: {
        objective,
        backend: backend || null,
        startUrl: startUrl || null,
      },
      schema: DESKTOP_ACTION_SCHEMA,
    });

    const actions: WorkflowActionRecord[] = [
      {
        id: crypto.randomUUID(),
        kind: 'desktop_task',
        title: 'Ejecutar accion en la computadora',
        status: 'pending',
        payload: {
          task: planned.output.task.trim(),
          backend: ['auto', 'browser', 'desktop', 'uia'].includes(backend) ? backend : undefined,
          startUrl: startUrl || undefined,
        },
      },
    ];

    return this.createRun({
      templateId: 'desktop_action',
      title: `Accion en computadora: ${objective}`,
      requestedBy: payload.requestedBy || null,
      input: {
        objective,
        backend: backend || null,
        startUrl: startUrl || null,
      },
      source: null,
      preview: {
        summary: planned.output.summary,
        rationale: planned.output.rationale,
        confidence: planned.output.confidence,
        task: planned.output.task,
      },
      actions,
      status: 'needs_approval',
      initialLog: `Se preparo una accion de escritorio para: ${objective}.`,
    });
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

  private buildGmailTriageActions(
    message: EmailMessage,
    triage: {
      decision: 'reply' | 'label_only' | 'schedule' | 'notify_chat' | 'ignore';
      summary: string;
      rationale: string;
      labelsToAdd: string[];
      archive: boolean;
      confidence: number;
      reply?: { subject: string; body: string };
      calendarEvent?: { title: string; startIso: string; endIso: string; description: string; location?: string };
      chatNotification?: { text: string };
    },
    options: {
      gchatSpace: string;
      removeFromInbox: boolean;
    },
  ): WorkflowActionRecord[] {
    const actions: WorkflowActionRecord[] = [];

    const labelsToAdd = Array.isArray(triage.labelsToAdd)
      ? triage.labelsToAdd.map((item) => String(item || '').trim()).filter(Boolean)
      : [];
    const removeLabels = triage.archive && options.removeFromInbox ? ['INBOX'] : [];

    if (labelsToAdd.length > 0 || removeLabels.length > 0) {
      actions.push({
        id: crypto.randomUUID(),
        kind: 'gmail_labels',
        title: 'Aplicar etiquetas en Gmail',
        status: 'pending',
        payload: {
          messageId: message.id,
          addLabels: labelsToAdd,
          removeLabels,
        },
      });
    }

    if (triage.reply?.body?.trim()) {
      const primaryRecipient = extractPrimaryEmailAddress(message.from);
      if (primaryRecipient) {
        actions.push({
          id: crypto.randomUUID(),
          kind: 'gmail_reply',
          title: 'Enviar respuesta por Gmail',
          status: 'pending',
          payload: {
            to: [primaryRecipient],
            subject: triage.reply.subject?.trim() || buildReplySubject(message.subject),
            body: triage.reply.body.trim(),
          },
        });
      }
    }

    if (triage.calendarEvent?.title?.trim() && triage.calendarEvent.startIso && triage.calendarEvent.endIso) {
      actions.push({
        id: crypto.randomUUID(),
        kind: 'calendar_event',
        title: 'Crear evento en Google Calendar',
        status: 'pending',
        payload: {
          title: triage.calendarEvent.title.trim(),
          start: triage.calendarEvent.startIso,
          end: triage.calendarEvent.endIso,
          description: triage.calendarEvent.description?.trim() || '',
          location: triage.calendarEvent.location?.trim() || '',
        },
      });
    }

    if (triage.chatNotification?.text?.trim() && options.gchatSpace) {
      actions.push({
        id: crypto.randomUUID(),
        kind: 'gchat_message',
        title: 'Enviar alerta a Google Chat',
        status: 'pending',
        payload: {
          spaceName: options.gchatSpace,
          text: triage.chatNotification.text.trim(),
        },
      });
    }

    return actions;
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

function pickBestMessage(messages: EmailMessage[]): EmailMessage {
  const unread = messages.find((message) => message.isUnread);
  return unread || messages[0];
}

function extractPrimaryEmailAddress(fromHeader: string): string | null {
  const angleMatch = String(fromHeader || '').match(/<([^>]+)>/);
  if (angleMatch?.[1]) {
    return angleMatch[1].trim();
  }

  const directMatch = String(fromHeader || '').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return directMatch?.[0]?.trim() || null;
}

function buildReplySubject(subject: string): string {
  const trimmed = String(subject || '').trim();
  if (!trimmed) {
    return 'Seguimiento';
  }
  return /^re:/i.test(trimmed) ? trimmed : `Re: ${trimmed}`;
}

function parseTargetDate(value: unknown): Date {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return new Date(`${value.trim()}T12:00:00`);
  }
  return new Date();
}

function formatDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function sanitizeCapabilities(value: unknown): WorkflowActionKind[] {
  const allowed: WorkflowActionKind[] = [
    'desktop_task',
    'gchat_message',
    'gmail_reply',
    'gmail_send',
    'calendar_event',
    'gmail_labels',
    'drive_folder_tree',
  ];
  const incoming = Array.isArray(value)
    ? value.map((item) => String(item || '').trim()).filter(Boolean)
    : [];
  const normalized = incoming.filter((item): item is WorkflowActionKind =>
    allowed.includes(item as WorkflowActionKind),
  );
  return normalized.length > 0 ? normalized : ['desktop_task'];
}

interface DriveFolderDefinition {
  name: string;
  children?: DriveFolderDefinition[];
}

function buildDriveWorkspaceFolders(): DriveFolderDefinition[] {
  return [
    { name: '01 Direccion' },
    { name: '02 Operacion' },
    { name: '03 Comercial' },
    { name: '04 Entregables' },
    { name: '05 Finanzas' },
  ];
}

function normalizeDriveFolderDefinition(value: unknown): DriveFolderDefinition | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const source = value as { name?: unknown; children?: unknown };
  const name = String(source.name || '').trim();
  if (!name) {
    return null;
  }

  const children = Array.isArray(source.children)
    ? source.children
        .map((item) => normalizeDriveFolderDefinition(item))
        .filter((item): item is DriveFolderDefinition => Boolean(item))
    : [];

  return children.length > 0 ? { name, children } : { name };
}

function pickMeetingEvent(events: Array<{
  id: string;
  title: string;
  start: Date;
  end: Date;
  isAllDay: boolean;
  location?: string;
  description?: string;
  source: 'google' | 'microsoft';
}>, targetDate: Date) {
  const sorted = events
    .slice()
    .sort((left, right) => left.start.getTime() - right.start.getTime());

  if (sorted.length === 0) {
    return null;
  }

  const today = formatDateOnly(targetDate) === formatDateOnly(new Date());
  if (today) {
    const now = Date.now();
    return sorted.find((event) => event.end.getTime() >= now) || sorted[0];
  }

  return sorted[0];
}

async function createDriveFolderTree(
  driveService: DriveService,
  parentFolderId: string,
  folders: DriveFolderDefinition[],
): Promise<Array<{ name: string; folderId: string; parentFolderId: string }>> {
  const created: Array<{ name: string; folderId: string; parentFolderId: string }> = [];

  for (const folder of folders) {
    const result = await driveService.createFolder(folder.name, parentFolderId);
    if (!result.success || !result.folderId) {
      throw new Error(result.error || `No se pudo crear la carpeta ${folder.name}.`);
    }

    created.push({
      name: folder.name,
      folderId: result.folderId,
      parentFolderId,
    });

    if (folder.children?.length) {
      const nested = await createDriveFolderTree(driveService, result.folderId, folder.children);
      created.push(...nested);
    }
  }

  return created;
}
