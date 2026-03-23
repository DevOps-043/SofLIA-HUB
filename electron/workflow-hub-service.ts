import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import { getSofiaUserByEmail } from './iris-data-main';
import type { CalendarService } from './calendar-service';
import type { ChatSpace, GChatService } from './gchat-service';
import type {
  WorkflowActionRecord,
  WorkflowRunRecord,
  WorkspaceAutomationService,
} from './workspace-automation-service';
import type { ScheduledTaskExecutionMode, ScheduledTaskInfo, TaskScheduler } from './task-scheduler';
import type { MeetingWorkflowService } from './meetings/meeting-workflow-service';
import type {
  MeetingRunDetail,
  MeetingRunSummary,
  UpdateMeetingActionInput,
} from './meetings/meeting-types';

interface MeetingContextTeam {
  team_id: string;
  name: string;
}

interface MeetingContextProject {
  project_id: string;
  project_name: string;
  team_id?: string | null;
}

interface MeetingContextTeamMember {
  membership_id?: string;
  team_id: string;
  user_id: string;
  role: string;
  joined_at: string;
  display_name?: string | null;
  email?: string | null;
  username?: string | null;
}

type WorkflowId =
  | 'correo'
  | 'agenda'
  | 'seguimiento'
  | 'reuniones'
  | 'drive'
  | 'actualizacion_equipo'
  | 'pc';

type WorkflowCapabilityKey =
  | 'calendar'
  | 'gmail'
  | 'drive'
  | 'gchat'
  | 'google_user_mapping';

type WorkflowCapabilityState =
  | 'available'
  | 'disconnected'
  | 'setup_required'
  | 'blocked'
  | 'error';

type WorkflowEngine = 'automation' | 'meeting';
type WorkflowCaseStatus = 'pending_approval' | 'in_progress' | 'completed' | 'failed' | 'attention';
type WorkflowApprovalScope = 'case' | 'summary' | 'actions' | 'action';
type WorkflowTriggerMode = 'activation' | 'passive';
type PassiveWorkflowBehavior = 'scheduled' | 'system';
type PassiveWorkflowSource = 'legacy' | 'chat' | 'app' | 'system';
type PassiveWorkflowStatus = 'active' | 'blocked' | 'system';

export interface WorkspaceCapabilityStatus {
  key: WorkflowCapabilityKey;
  label: string;
  state: WorkflowCapabilityState;
  message: string;
  guidance?: string | null;
}

export interface WorkflowVariant {
  id: string;
  workflowId: WorkflowId;
  name: string;
  description: string;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
}

export interface WorkflowDefinition {
  id: WorkflowId;
  name: string;
  description: string;
  summary: string;
  engine: WorkflowEngine | 'hybrid';
  triggerModes: WorkflowTriggerMode[];
  passiveBehavior?: PassiveWorkflowBehavior;
  configurableFields: string[];
  requiredCapabilities: WorkflowCapabilityKey[];
  optionalCapabilities: WorkflowCapabilityKey[];
  defaultConfig: Record<string, unknown>;
  modes?: string[];
}

export interface PassiveWorkflowRule {
  id: string;
  workflowId?: WorkflowId | null;
  workflowName: string;
  name: string;
  description: string;
  prompt: string;
  scheduleLabel: string;
  cronExpression?: string | null;
  source: PassiveWorkflowSource;
  status: PassiveWorkflowStatus;
  executionMode: ScheduledTaskExecutionMode;
  createdAt: string;
  updatedAt: string;
  lastRunAt?: string | null;
  requestedBy?: string | null;
  phoneNumber?: string | null;
  config?: Record<string, unknown>;
  reason?: string | null;
}

export interface WorkflowCaseAction {
  id: string;
  title: string;
  kind: string;
  status: 'pending' | 'approved' | 'executed' | 'failed' | 'skipped';
  payload: Record<string, unknown>;
  error?: string | null;
  blockingFlags?: string[];
  approvalState?: string | null;
  syncState?: string | null;
}

export interface WorkflowCaseSummary {
  id: string;
  nativeId: string;
  workflowId: WorkflowId;
  workflowName: string;
  engine: WorkflowEngine;
  title: string;
  summary: string;
  normalizedStatus: WorkflowCaseStatus;
  nativeStatus: string;
  createdAt: string;
  updatedAt: string;
  actions: {
    pending: number;
    approved: number;
    failed: number;
    total: number;
  };
  reasons: string[];
}

export interface WorkflowCaseDetail extends WorkflowCaseSummary {
  preview: Record<string, unknown>;
  approvals: Array<Record<string, unknown>>;
  logs: Array<{ at: string; level: string; message: string }>;
  actionsDetail: WorkflowCaseAction[];
  capabilitiesUsed: WorkflowCapabilityKey[];
  automationRun?: WorkflowRunRecord;
  meetingDetail?: MeetingRunDetail;
}

export interface WorkflowHubOverview {
  workflows: WorkflowDefinition[];
  variants: WorkflowVariant[];
  passiveRules: PassiveWorkflowRule[];
  cases: WorkflowCaseSummary[];
  capabilities: WorkspaceCapabilityStatus[];
  gchatSpaces: ChatSpace[];
  meetingContext: {
    teams: MeetingContextTeam[];
    projects: MeetingContextProject[];
    teamMembers: MeetingContextTeamMember[];
  };
  legacyCustomTemplates: Array<{
    id: string;
    name: string;
    description: string;
    createdAt?: string;
  }>;
}

export interface ExecuteWorkflowInput {
  workflowId?: WorkflowId;
  variantId?: string;
  requestedBy?: string | null;
  input?: Record<string, unknown>;
}

export interface SaveWorkflowVariantInput {
  variantId?: string | null;
  workflowId: WorkflowId;
  name: string;
  description?: string | null;
  config?: Record<string, unknown>;
  createdBy?: string | null;
}

export interface SavePassiveWorkflowRuleInput {
  ruleId?: string | null;
  workflowId?: WorkflowId | null;
  name: string;
  description?: string | null;
  prompt?: string | null;
  config?: Record<string, unknown>;
  cronExpression?: string | null;
  scheduleLabel?: string | null;
  requestedBy?: string | null;
  phoneNumber?: string | null;
  source?: PassiveWorkflowSource;
  executionMode?: ScheduledTaskExecutionMode;
}

interface WorkflowHubState {
  variants: WorkflowVariant[];
}

interface WorkflowHubDependencies {
  calendarService: CalendarService;
  gchatService: GChatService;
  taskScheduler: TaskScheduler;
  workspaceAutomationService: WorkspaceAutomationService;
  meetingWorkflowService: MeetingWorkflowService;
}

const AUTOMATION_CASE_PREFIX = 'automation:';
const MEETING_CASE_PREFIX = 'meeting:';

const WORKFLOW_DEFINITIONS: WorkflowDefinition[] = [
  {
    id: 'correo',
    name: 'Correo',
    description: 'Triage ejecutivo de Gmail con aprobacion antes de actuar.',
    summary: 'Revisa correos prioritarios, propone etiquetas, respuesta o seguimiento.',
    engine: 'automation',
    triggerModes: ['activation', 'passive'],
    passiveBehavior: 'scheduled',
    configurableFields: ['preset de busqueda', 'maximo de resultados', 'salida opcional a Chat', 'archivar al terminar'],
    requiredCapabilities: ['gmail'],
    optionalCapabilities: ['gchat'],
    defaultConfig: { preset: 'unread', maxResults: 5, removeFromInbox: true, gchatSpace: '' },
  },
  {
    id: 'agenda',
    name: 'Agenda',
    description: 'Briefing diario del calendario con riesgos y puntos clave.',
    summary: 'Resume el dia y opcionalmente lo comparte por Google Chat.',
    engine: 'automation',
    triggerModes: ['activation', 'passive'],
    passiveBehavior: 'scheduled',
    configurableFields: ['fecha objetivo', 'salida opcional a Chat'],
    requiredCapabilities: ['calendar'],
    optionalCapabilities: ['gchat'],
    defaultConfig: { targetDate: '', gchatSpace: '' },
  },
  {
    id: 'seguimiento',
    name: 'Seguimiento',
    description: 'Borrador de correo de seguimiento listo para autorizacion.',
    summary: 'Redacta un seguimiento profesional con tono y firma configurables.',
    engine: 'automation',
    triggerModes: ['activation'],
    configurableFields: ['destinatario', 'tema', 'contexto base', 'tono', 'firma'],
    requiredCapabilities: ['gmail'],
    optionalCapabilities: [],
    defaultConfig: { to: '', topic: '', context: '', tone: 'profesional y claro', signature: '' },
  },
  {
    id: 'reuniones',
    name: 'Reuniones',
    description: 'Preparacion previa, procesamiento de notas/transcripciones y deteccion automatica.',
    summary: 'Unifica la preparacion, revision y sincronizacion de reuniones en un solo flujo.',
    engine: 'hybrid',
    triggerModes: ['activation', 'passive'],
    passiveBehavior: 'system',
    configurableFields: ['modo', 'fecha', 'equipo por defecto', 'proyecto por defecto', 'salida opcional a Chat'],
    requiredCapabilities: [],
    optionalCapabilities: ['calendar', 'drive', 'gmail', 'gchat', 'google_user_mapping'],
    defaultConfig: {
      mode: 'manual',
      targetDate: '',
      gchatSpace: '',
      meetingTitle: '',
      meetingType: 'general',
      defaultTeamId: '',
      defaultProjectId: '',
      manualText: '',
      driveRef: '',
    },
    modes: ['prep', 'manual', 'drive', 'auto'],
  },
  {
    id: 'drive',
    name: 'Drive',
    description: 'Crea espacios base de proyecto con plantillas de carpetas.',
    summary: 'Genera una estructura inicial y opcionalmente avisa al equipo.',
    engine: 'automation',
    triggerModes: ['activation'],
    configurableFields: ['nombre del proyecto', 'carpeta padre', 'plantilla de carpetas', 'salida opcional a Chat'],
    requiredCapabilities: ['drive'],
    optionalCapabilities: ['gchat'],
    defaultConfig: { projectName: '', parentFolderId: '', gchatSpace: '', folderPreset: 'cliente_estandar' },
  },
  {
    id: 'actualizacion_equipo',
    name: 'Actualizacion de equipo',
    description: 'Convierte contexto operativo en un mensaje ejecutivo para Google Chat.',
    summary: 'Redacta una actualizacion clara para un espacio de Chat.',
    engine: 'automation',
    triggerModes: ['activation'],
    configurableFields: ['destino', 'contexto', 'tono'],
    requiredCapabilities: ['gchat'],
    optionalCapabilities: [],
    defaultConfig: { spaceName: '', context: '', tone: 'ejecutivo y claro' },
  },
  {
    id: 'pc',
    name: 'PC',
    description: 'Prepara una accion operativa en la computadora con aprobacion obligatoria.',
    summary: 'Convierte un objetivo operativo en una tarea ejecutable por el agente de escritorio.',
    engine: 'automation',
    triggerModes: ['activation'],
    configurableFields: ['objetivo', 'backend preferido', 'URL inicial'],
    requiredCapabilities: [],
    optionalCapabilities: [],
    defaultConfig: { objective: '', backend: 'auto', startUrl: '' },
  },
];

const AUTOMATION_TEMPLATE_TO_WORKFLOW: Record<string, WorkflowId> = {
  gmail_triage: 'correo',
  calendar_daily_brief: 'agenda',
  gmail_followup_draft: 'seguimiento',
  calendar_meeting_prep: 'reuniones',
  drive_project_workspace: 'drive',
  gchat_executive_update: 'actualizacion_equipo',
  desktop_action: 'pc',
};

export class WorkflowHubService {
  private state: WorkflowHubState = { variants: [] };

  constructor(private readonly deps: WorkflowHubDependencies) {}

  init(): void {
    this.loadState();
  }

  async getOverview(): Promise<WorkflowHubOverview> {
    const [capabilitySnapshot, meetingContext] = await Promise.all([
      this.getCapabilitiesSnapshot(),
      this.safeGetMeetingContext(),
    ]);
    const templates = this.deps.workspaceAutomationService.listTemplates();
    const automationRuns = this.deps.workspaceAutomationService.listRuns(100);
    const meetingRuns = await this.deps.meetingWorkflowService.listRuns({ limit: 100 });

    const legacyCustomTemplates = templates
      .filter((template) => template.kind === 'custom')
      .map((template) => ({
        id: template.id,
        name: template.name,
        description: template.description,
        createdAt: template.createdAt,
      }));

    const automationCases = automationRuns
      .filter((run) => !run.templateId.startsWith('custom_'))
      .map((run) => this.mapAutomationRunToSummary(run));
    const meetingCases = meetingRuns.map((run) => this.mapMeetingRunToSummary(run));
    const cases = [...automationCases, ...meetingCases]
      .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
    const passiveRules = [
      ...this.deps.taskScheduler.getTasks().map((task) => this.mapScheduledTaskToPassiveRule(task)),
      ...this.getSystemPassiveRules(capabilitySnapshot.capabilities),
    ].sort((left, right) => {
      if (left.source === 'system' && right.source !== 'system') return -1;
      if (left.source !== 'system' && right.source === 'system') return 1;
      return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
    });

    return {
      workflows: structuredClone(WORKFLOW_DEFINITIONS),
      variants: structuredClone(this.state.variants),
      passiveRules,
      cases,
      capabilities: capabilitySnapshot.capabilities,
      gchatSpaces: capabilitySnapshot.gchatSpaces,
      meetingContext,
      legacyCustomTemplates,
    };
  }

  async getCaseDetail(caseId: string): Promise<WorkflowCaseDetail> {
    const resolved = this.parseCaseId(caseId);
    if (resolved.engine === 'automation') {
      const run = this.deps.workspaceAutomationService.getRun(resolved.nativeId);
      return this.mapAutomationRunToDetail(run);
    }

    const detail = await this.deps.meetingWorkflowService.getRunDetail(resolved.nativeId);
    return this.mapMeetingRunToDetail(detail);
  }

  saveVariant(input: SaveWorkflowVariantInput): WorkflowVariant {
    const workflow = this.getWorkflowDefinition(input.workflowId);
    const name = String(input.name || '').trim();
    if (!name) {
      throw new Error('Necesito un nombre para guardar la variante.');
    }

    const now = new Date().toISOString();
    const sanitizedConfig = this.sanitizeWorkflowConfig(workflow.id, input.config || {});
    const existing = input.variantId
      ? this.state.variants.find((variant) => variant.id === input.variantId)
      : null;

    const variant: WorkflowVariant = existing
      ? {
          ...existing,
          name,
          description: String(input.description || '').trim(),
          config: sanitizedConfig,
          updatedAt: now,
        }
      : {
          id: `variant_${crypto.randomUUID()}`,
          workflowId: workflow.id,
          name,
          description: String(input.description || '').trim(),
          config: sanitizedConfig,
          createdAt: now,
          updatedAt: now,
          createdBy: input.createdBy || null,
        };

    if (existing) {
      this.state.variants = this.state.variants.map((candidate) => candidate.id === variant.id ? variant : candidate);
    } else {
      this.state.variants.unshift(variant);
    }
    this.state.variants = this.state.variants.slice(0, 200);
    this.saveState();
    return structuredClone(variant);
  }

  savePassiveRule(input: SavePassiveWorkflowRuleInput): PassiveWorkflowRule {
    const workflow = input.workflowId ? this.getWorkflowDefinition(input.workflowId) : null;
    if (workflow?.passiveBehavior === 'system') {
      throw new Error('Ese workflow pasivo ya corre automaticamente en segundo plano y no necesita programacion manual.');
    }

    const name = String(input.name || '').trim();
    if (!name) {
      throw new Error('Necesito un nombre para guardar el workflow pasivo.');
    }

    const cronExpression = this.requireNonEmptyString(
      input.cronExpression,
      'Necesito una programacion valida para guardar el workflow pasivo.',
    );
    const config = workflow
      ? this.sanitizeWorkflowConfig(workflow.id, input.config || {})
      : {};
    const prompt = this.resolvePassivePrompt({
      workflowId: workflow?.id || null,
      prompt: input.prompt || null,
      config,
    });
    const executionMode = input.executionMode
      || (input.phoneNumber ? 'agent_prompt' : workflow ? 'workflow' : 'agent_prompt');

    const task = this.deps.taskScheduler.upsertTask({
      id: input.ruleId || undefined,
      cronExpression,
      prompt,
      phoneNumber: String(input.phoneNumber || '').trim(),
      name,
      description: String(input.description || '').trim(),
      scheduleLabel: String(input.scheduleLabel || '').trim() || this.describeCron(cronExpression),
      source: input.source === 'chat' || input.source === 'app' ? input.source : 'app',
      kind: workflow ? 'passive_workflow' : 'passive_prompt',
      executionMode,
      workflowId: workflow?.id || null,
      workflowInput: workflow && executionMode === 'workflow' ? config : {},
      requestedBy: input.requestedBy || null,
      passiveRuleId: input.ruleId || undefined,
    });

    return this.mapScheduledTaskToPassiveRule(task);
  }

  deletePassiveRule(ruleId: string): boolean {
    return this.deps.taskScheduler.deleteTask(String(ruleId || '').trim());
  }

  async executeWorkflow(input: ExecuteWorkflowInput): Promise<WorkflowCaseDetail> {
    const resolved = this.resolveWorkflowExecution(input);
    const requestedBy = input.requestedBy || null;

    switch (resolved.workflow.id) {
      case 'correo': {
        const preset = String(resolved.config.preset || 'unread').trim();
        const query = preset === 'custom'
          ? String(resolved.config.query || '').trim()
          : this.resolveMailPresetQuery(preset);
        const run = await this.deps.workspaceAutomationService.executeTemplate({
          templateId: 'gmail_triage',
          requestedBy,
          input: {
            query,
            maxResults: resolved.config.maxResults,
            gchatSpace: resolved.config.gchatSpace || undefined,
            removeFromInbox: resolved.config.removeFromInbox !== false,
          },
        });
        return this.mapAutomationRunToDetail(run);
      }
      case 'agenda': {
        const run = await this.deps.workspaceAutomationService.executeTemplate({
          templateId: 'calendar_daily_brief',
          requestedBy,
          input: {
            targetDate: this.normalizeOptionalString(resolved.config.targetDate) || undefined,
            gchatSpace: this.normalizeOptionalString(resolved.config.gchatSpace) || undefined,
          },
        });
        return this.mapAutomationRunToDetail(run);
      }
      case 'seguimiento': {
        const to = this.requireNonEmptyString(resolved.config.to, 'Necesito el correo destino para preparar el seguimiento.');
        const topic = this.requireNonEmptyString(resolved.config.topic, 'Necesito el tema o motivo del seguimiento.');
        const run = await this.deps.workspaceAutomationService.executeTemplate({
          templateId: 'gmail_followup_draft',
          requestedBy,
          input: {
            to,
            topic,
            context: this.normalizeOptionalString(resolved.config.context) || undefined,
            tone: this.normalizeOptionalString(resolved.config.tone) || undefined,
            signature: this.normalizeOptionalString(resolved.config.signature) || undefined,
          },
        });
        return this.mapAutomationRunToDetail(run);
      }
      case 'reuniones':
        return this.executeMeetingWorkflow(resolved.config, requestedBy);
      case 'drive': {
        const projectName = this.requireNonEmptyString(resolved.config.projectName, 'Necesito el nombre del proyecto o cliente.');
        const run = await this.deps.workspaceAutomationService.executeTemplate({
          templateId: 'drive_project_workspace',
          requestedBy,
          input: {
            projectName,
            parentFolderId: this.normalizeOptionalString(resolved.config.parentFolderId) || undefined,
            gchatSpace: this.normalizeOptionalString(resolved.config.gchatSpace) || undefined,
            folders: this.resolveDriveFolderPreset(String(resolved.config.folderPreset || 'cliente_estandar')),
          },
        });
        return this.mapAutomationRunToDetail(run);
      }
      case 'actualizacion_equipo': {
        const spaceName = this.requireNonEmptyString(resolved.config.spaceName, 'Necesito el espacio de Google Chat.');
        const context = this.requireNonEmptyString(resolved.config.context, 'Necesito el contexto de la actualizacion.');
        const run = await this.deps.workspaceAutomationService.executeTemplate({
          templateId: 'gchat_executive_update',
          requestedBy,
          input: {
            spaceName,
            context,
            tone: this.normalizeOptionalString(resolved.config.tone) || undefined,
          },
        });
        return this.mapAutomationRunToDetail(run);
      }
      case 'pc': {
        const objective = this.requireNonEmptyString(resolved.config.objective, 'Necesito el objetivo de la accion en tu computadora.');
        const run = await this.deps.workspaceAutomationService.executeTemplate({
          templateId: 'desktop_action',
          requestedBy,
          input: {
            objective,
            backend: this.normalizeOptionalString(resolved.config.backend) || undefined,
            startUrl: this.normalizeOptionalString(resolved.config.startUrl) || undefined,
          },
        });
        return this.mapAutomationRunToDetail(run);
      }
      default:
        throw new Error('Workflow no soportado.');
    }
  }

  async approveCase(input: { caseId: string; decidedBy: string; scope: WorkflowApprovalScope; actionId?: string; comment?: string | null }): Promise<WorkflowCaseDetail> {
    const resolved = this.parseCaseId(input.caseId);
    if (resolved.engine === 'automation') {
      if (input.scope !== 'case') {
        throw new Error('Ese tipo de aprobacion solo aplica a reuniones.');
      }
      const run = await this.deps.workspaceAutomationService.approveRun(resolved.nativeId, input.decidedBy, input.comment || null);
      return this.mapAutomationRunToDetail(run);
    }

    if (input.scope === 'summary') {
      const detail = await this.deps.meetingWorkflowService.approveAsset(resolved.nativeId, input.decidedBy, input.comment || undefined);
      return this.mapMeetingRunToDetail(detail);
    }
    if (input.scope === 'actions') {
      const detail = await this.deps.meetingWorkflowService.approveActions(resolved.nativeId, input.decidedBy, undefined, input.comment || undefined);
      return this.mapMeetingRunToDetail(detail);
    }
    if (input.scope === 'action') {
      const actionId = this.requireNonEmptyString(input.actionId, 'Necesito la accion que quieres aprobar.');
      const detail = await this.deps.meetingWorkflowService.approveActions(resolved.nativeId, input.decidedBy, [actionId], input.comment || undefined);
      return this.mapMeetingRunToDetail(detail);
    }

    throw new Error('Tipo de aprobacion no soportado.');
  }

  async rejectCase(input: { caseId: string; decidedBy: string; scope: 'case' | 'action'; actionId?: string; comment?: string | null }): Promise<WorkflowCaseDetail> {
    const resolved = this.parseCaseId(input.caseId);
    if (resolved.engine === 'automation') {
      if (input.scope !== 'case') {
        throw new Error('Ese tipo de rechazo solo aplica a reuniones.');
      }
      const run = this.deps.workspaceAutomationService.rejectRun(resolved.nativeId, input.decidedBy, input.comment || null);
      return this.mapAutomationRunToDetail(run);
    }

    if (input.scope !== 'action') {
      throw new Error('En reuniones solo puedes rechazar acciones individuales.');
    }
    const actionId = this.requireNonEmptyString(input.actionId, 'Necesito la accion que quieres rechazar.');
    const detail = await this.deps.meetingWorkflowService.rejectAction(actionId, input.decidedBy, input.comment || undefined);
    return this.mapMeetingRunToDetail(detail);
  }

  async updateCaseAction(input: { caseId: string; actionId: string; updates: UpdateMeetingActionInput }): Promise<WorkflowCaseDetail> {
    const resolved = this.parseCaseId(input.caseId);
    if (resolved.engine !== 'meeting') {
      throw new Error('Solo las reuniones permiten editar acciones sincronizables.');
    }
    const detail = await this.deps.meetingWorkflowService.updateAction(
      this.requireNonEmptyString(input.actionId, 'Necesito la accion a editar.'),
      input.updates,
    );
    return this.mapMeetingRunToDetail(detail);
  }

  async syncCase(input: { caseId: string; decidedBy: string }): Promise<WorkflowCaseDetail> {
    const resolved = this.parseCaseId(input.caseId);
    if (resolved.engine !== 'meeting') {
      throw new Error('Solo las reuniones requieren sincronizacion posterior.');
    }
    const result = await this.deps.meetingWorkflowService.syncApprovedActions(resolved.nativeId, input.decidedBy);
    return this.mapMeetingRunToDetail(result.detail);
  }

  private async executeMeetingWorkflow(config: Record<string, unknown>, requestedBy: string | null): Promise<WorkflowCaseDetail> {
    const mode = String(config.mode || 'manual').trim().toLowerCase();
    if (mode === 'prep') {
      const run = await this.deps.workspaceAutomationService.executeTemplate({
        templateId: 'calendar_meeting_prep',
        requestedBy,
        input: {
          targetDate: this.normalizeOptionalString(config.targetDate) || undefined,
          gchatSpace: this.normalizeOptionalString(config.gchatSpace) || undefined,
        },
      });
      return this.mapAutomationRunToDetail(run);
    }

    if (mode === 'auto') {
      throw new Error('La deteccion automatica de reuniones corre en segundo plano. Usa manual, Drive o prep para crear un caso ahora.');
    }

    const meetingTitle = this.normalizeOptionalString(config.meetingTitle);
    const meetingType = this.normalizeOptionalString(config.meetingType) || 'general';
    const defaultTeamId = this.normalizeOptionalString(config.defaultTeamId);
    const defaultProjectId = this.normalizeOptionalString(config.defaultProjectId);

    if (mode === 'drive') {
      const fileIdOrUrl = this.requireNonEmptyString(config.driveRef, 'Necesito el link o ID de Google Drive.');
      const result = await this.deps.meetingWorkflowService.createDriveRun({
        ownerUserId: this.resolveOwnerUserId(requestedBy),
        originChannel: 'app',
        originRef: 'workflow-hub:reuniones',
        meetingTitle,
        meetingType,
        defaultTeamId,
        defaultProjectId,
        fileIdOrUrl,
      });
      return this.mapMeetingRunToDetail(result.detail);
    }

    const text = this.requireNonEmptyString(config.manualText, 'Necesito las notas o transcripcion para procesar la reunion.');
    const result = await this.deps.meetingWorkflowService.createManualRun({
      ownerUserId: this.resolveOwnerUserId(requestedBy),
      originChannel: 'app',
      originRef: 'workflow-hub:reuniones',
      meetingTitle,
      meetingType,
      defaultTeamId,
      defaultProjectId,
      text,
    });
    return this.mapMeetingRunToDetail(result.detail);
  }

  private resolveWorkflowExecution(input: ExecuteWorkflowInput): { workflow: WorkflowDefinition; config: Record<string, unknown> } {
    const variant = input.variantId
      ? this.state.variants.find((candidate) => candidate.id === input.variantId)
      : null;
    const workflowId = variant?.workflowId || input.workflowId;
    if (!workflowId) {
      throw new Error('Necesito saber que workflow quieres ejecutar.');
    }
    const workflow = this.getWorkflowDefinition(workflowId);
    const merged = {
      ...structuredClone(workflow.defaultConfig),
      ...(variant?.config || {}),
      ...(input.input || {}),
    };
    return {
      workflow,
      config: this.sanitizeWorkflowConfig(workflow.id, merged),
    };
  }

  private sanitizeWorkflowConfig(workflowId: WorkflowId, config: Record<string, unknown>): Record<string, unknown> {
    switch (workflowId) {
      case 'correo':
        return {
          preset: this.normalizeEnum(config.preset, ['today', 'unread', 'priority', 'custom'], 'unread'),
          query: this.normalizeOptionalString(config.query) || '',
          maxResults: this.normalizeNumber(config.maxResults, 5, 1, 10),
          gchatSpace: this.normalizeOptionalString(config.gchatSpace) || '',
          removeFromInbox: config.removeFromInbox !== false,
        };
      case 'agenda':
        return {
          targetDate: this.normalizeOptionalString(config.targetDate) || '',
          gchatSpace: this.normalizeOptionalString(config.gchatSpace) || '',
        };
      case 'seguimiento':
        return {
          to: this.normalizeOptionalString(config.to) || '',
          topic: this.normalizeOptionalString(config.topic) || '',
          context: this.normalizeOptionalString(config.context) || '',
          tone: this.normalizeOptionalString(config.tone) || 'profesional y claro',
          signature: this.normalizeOptionalString(config.signature) || '',
        };
      case 'reuniones':
        return {
          mode: this.normalizeEnum(config.mode, ['prep', 'manual', 'drive', 'auto'], 'manual'),
          targetDate: this.normalizeOptionalString(config.targetDate) || '',
          gchatSpace: this.normalizeOptionalString(config.gchatSpace) || '',
          meetingTitle: this.normalizeOptionalString(config.meetingTitle) || '',
          meetingType: this.normalizeOptionalString(config.meetingType) || 'general',
          defaultTeamId: this.normalizeOptionalString(config.defaultTeamId) || '',
          defaultProjectId: this.normalizeOptionalString(config.defaultProjectId) || '',
          manualText: this.normalizeOptionalString(config.manualText) || '',
          driveRef: this.normalizeOptionalString(config.driveRef) || '',
        };
      case 'drive':
        return {
          projectName: this.normalizeOptionalString(config.projectName) || '',
          parentFolderId: this.normalizeOptionalString(config.parentFolderId) || '',
          gchatSpace: this.normalizeOptionalString(config.gchatSpace) || '',
          folderPreset: this.normalizeEnum(config.folderPreset, ['cliente_estandar', 'proyecto_simple', 'operacion'], 'cliente_estandar'),
        };
      case 'actualizacion_equipo':
        return {
          spaceName: this.normalizeOptionalString(config.spaceName) || '',
          context: this.normalizeOptionalString(config.context) || '',
          tone: this.normalizeOptionalString(config.tone) || 'ejecutivo y claro',
        };
      case 'pc':
        return {
          objective: this.normalizeOptionalString(config.objective) || '',
          backend: this.normalizeEnum(config.backend, ['auto', 'browser', 'desktop', 'uia'], 'auto'),
          startUrl: this.normalizeOptionalString(config.startUrl) || '',
        };
      default:
        return {};
    }
  }

  private resolvePassivePrompt(input: {
    workflowId: WorkflowId | null;
    prompt: string | null;
    config: Record<string, unknown>;
  }): string {
    const explicitPrompt = this.normalizeOptionalString(input.prompt);
    if (explicitPrompt) {
      return explicitPrompt;
    }

    if (!input.workflowId) {
      throw new Error('Necesito la instruccion que quieres recordar o automatizar.');
    }

    switch (input.workflowId) {
      case 'correo': {
        const preset = String(input.config.preset || 'unread');
        const maxResults = Number(input.config.maxResults || 5);
        const presetCopy = preset === 'priority'
          ? 'prioritarios'
          : preset === 'today'
            ? 'de hoy'
            : preset === 'custom'
              ? `que cumplan el filtro "${String(input.config.query || '').trim()}"`
              : 'no leidos';
        return `Dame un resumen ejecutivo de mis correos ${presetCopy}. Prioriza lo accionable, limita la revision a ${maxResults} resultados y responde por WhatsApp con lo mas importante.`;
      }
      case 'agenda': {
        const targetDate = this.normalizeOptionalString(input.config.targetDate);
        return `Dame un briefing ejecutivo de mi agenda ${targetDate ? `para ${targetDate}` : 'de hoy'}, con riesgos, prioridades y reuniones importantes. Responde por WhatsApp.`;
      }
      default:
        throw new Error('Ese workflow no soporta programacion pasiva desde la app.');
    }
  }

  private mapScheduledTaskToPassiveRule(task: ScheduledTaskInfo): PassiveWorkflowRule {
    const workflowId = task.workflowId && this.isWorkflowId(task.workflowId) ? task.workflowId : null;
    const workflowName = workflowId
      ? this.getWorkflowDefinition(workflowId).name
      : 'Rutina libre';
    const status: PassiveWorkflowStatus = task.kind === 'passive_workflow' || task.kind === 'passive_prompt'
      ? 'active'
      : 'active';

    return {
      id: task.id,
      workflowId,
      workflowName,
      name: task.name || workflowName,
      description: task.description || (workflowId
        ? `Workflow pasivo ${workflowName.toLowerCase()} programado.`
        : 'Instruccion recordada que el agente ejecutara automaticamente.'),
      prompt: task.prompt,
      scheduleLabel: task.scheduleLabel || this.describeCron(task.cronExpression),
      cronExpression: task.cronExpression,
      source: task.source === 'chat' || task.source === 'app' ? task.source : 'legacy',
      status,
      executionMode: task.executionMode || 'agent_prompt',
      createdAt: task.createdAt,
      updatedAt: task.updatedAt || task.createdAt,
      lastRunAt: task.lastRun || null,
      requestedBy: task.requestedBy || null,
      phoneNumber: task.phoneNumber || null,
      config: task.workflowInput && typeof task.workflowInput === 'object' ? { ...task.workflowInput } : {},
      reason: null,
    };
  }

  private getSystemPassiveRules(capabilities: WorkspaceCapabilityStatus[]): PassiveWorkflowRule[] {
    const mappingCapability = capabilities.find((item) => item.key === 'google_user_mapping');
    const googleCapability = capabilities.find((item) => item.key === 'calendar');
    const systemTimestamp = new Date(0).toISOString();
    const status: PassiveWorkflowStatus =
      mappingCapability?.state === 'available' && googleCapability?.state === 'available'
        ? 'system'
        : 'blocked';

    return [
      {
        id: 'system:reuniones-auto',
        workflowId: 'reuniones',
        workflowName: this.getWorkflowDefinition('reuniones').name,
        name: 'Deteccion automatica de reuniones',
        description: 'Escanea Calendar, Gmail y Drive para detectar reuniones y correr el flujo completo sin comando.',
        prompt: 'Deteccion automatica del sistema',
        scheduleLabel: 'Cada 20 minutos y por eventos de Google',
        cronExpression: null,
        source: 'system',
        status,
        executionMode: 'workflow',
        createdAt: systemTimestamp,
        updatedAt: systemTimestamp,
        lastRunAt: null,
        requestedBy: null,
        phoneNumber: null,
        config: { mode: 'auto' },
        reason: status === 'blocked'
          ? mappingCapability?.guidance || mappingCapability?.message || 'La auto-deteccion esta bloqueada.'
          : 'Activo en segundo plano.',
      },
    ];
  }

  private describeCron(cronExpression: string): string {
    const normalized = String(cronExpression || '').trim();
    const parts = normalized.split(/\s+/);
    if (parts.length !== 5) {
      return normalized;
    }

    const [minuteRaw, hourRaw, _dayOfMonth, _month, dayOfWeekRaw] = parts;
    const minute = Number(minuteRaw);
    const hour = Number(hourRaw);
    const timeLabel = Number.isFinite(hour) && Number.isFinite(minute)
      ? `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
      : `${hourRaw}:${minuteRaw}`;

    if (dayOfWeekRaw === '1-5') {
      return `Lunes a viernes a las ${timeLabel}`;
    }
    if (dayOfWeekRaw === '*') {
      return `Todos los dias a las ${timeLabel}`;
    }

    const weekdayMap: Record<string, string> = {
      '0': 'Domingo',
      '1': 'Lunes',
      '2': 'Martes',
      '3': 'Miercoles',
      '4': 'Jueves',
      '5': 'Viernes',
      '6': 'Sabado',
      '7': 'Domingo',
    };
    return `${weekdayMap[dayOfWeekRaw] || normalized} a las ${timeLabel}`;
  }

  private isWorkflowId(value: string): value is WorkflowId {
    return WORKFLOW_DEFINITIONS.some((workflow) => workflow.id === value);
  }

  private async getCapabilitiesSnapshot(): Promise<{ capabilities: WorkspaceCapabilityStatus[]; gchatSpaces: ChatSpace[] }> {
    const googleConnection = this.deps.calendarService
      .getConnections()
      .find((connection) => connection.provider === 'google' && connection.isActive && connection.email);
    const hasGoogle = Boolean(googleConnection?.email);

    const capabilities: WorkspaceCapabilityStatus[] = [
      {
        key: 'calendar',
        label: 'Calendar',
        state: hasGoogle ? 'available' : 'disconnected',
        message: hasGoogle ? `Cuenta conectada: ${googleConnection?.email}` : 'Conecta Google Calendar para usar agenda y preparacion de reuniones.',
        guidance: hasGoogle ? null : 'Ve a Calendario y vincula tu cuenta de Google.',
      },
      {
        key: 'gmail',
        label: 'Gmail',
        state: hasGoogle ? 'available' : 'disconnected',
        message: hasGoogle ? 'Gmail disponible desde la misma sesion de Google.' : 'Gmail requiere la misma conexion de Google Workspace.',
        guidance: hasGoogle ? null : 'Conecta Google para habilitar correo y seguimiento.',
      },
      {
        key: 'drive',
        label: 'Drive',
        state: hasGoogle ? 'available' : 'disconnected',
        message: hasGoogle ? 'Drive disponible desde la misma sesion de Google.' : 'Drive requiere la misma conexion de Google Workspace.',
        guidance: hasGoogle ? null : 'Conecta Google para habilitar Drive y reuniones desde transcripciones.',
      },
    ];

    let gchatSpaces: ChatSpace[] = [];
    if (!hasGoogle) {
      capabilities.push({
        key: 'gchat',
        label: 'Google Chat',
        state: 'disconnected',
        message: 'Google Chat no esta disponible porque no hay una cuenta de Google conectada.',
        guidance: 'Conecta Google Workspace primero.',
      });
    } else {
      const result = await this.deps.gchatService.listSpaces();
      if (result.success) {
        gchatSpaces = result.spaces || [];
        capabilities.push({
          key: 'gchat',
          label: 'Google Chat',
          state: 'available',
          message: gchatSpaces.length > 0
            ? `${gchatSpaces.length} espacio(s) disponibles para compartir salidas.`
            : 'Google Chat conectado, sin espacios visibles por ahora.',
          guidance: null,
        });
      } else {
        const message = String(result.error || 'No pude consultar Google Chat.');
        const setupRequired = /google chat app not found/i.test(message);
        capabilities.push({
          key: 'gchat',
          label: 'Google Chat',
          state: setupRequired ? 'setup_required' : 'error',
          message,
          guidance: setupRequired
            ? 'Activa la Chat API y configura la app de Google Chat en Google Cloud. Los demas flujos de Google seguiran funcionando sin esta salida.'
            : 'Revisa la configuracion de Google Chat o vuelve a intentarlo.',
        });
      }
    }

    if (!googleConnection?.email) {
      capabilities.push({
        key: 'google_user_mapping',
        label: 'Resolucion Google -> SOFIA',
        state: 'disconnected',
        message: 'Sin cuenta de Google conectada no puedo mapear el correo al usuario interno.',
        guidance: 'Conecta Google para habilitar la deteccion automatica de reuniones.',
      });
    } else {
      const sofiaUser = googleConnection.userId
        ? { id: googleConnection.userId }
        : await getSofiaUserByEmail(googleConnection.email);
      if (sofiaUser?.id) {
        capabilities.push({
          key: 'google_user_mapping',
          label: 'Resolucion Google -> SOFIA',
          state: 'available',
          message: `El correo ${googleConnection.email} si resuelve a un usuario de SOFIA.`,
          guidance: null,
        });
      } else {
        capabilities.push({
          key: 'google_user_mapping',
          label: 'Resolucion Google -> SOFIA',
          state: 'blocked',
          message: `No encontre un usuario SOFIA para ${googleConnection.email}.`,
          guidance: 'La deteccion automatica de reuniones quedara bloqueada hasta resolver ese mapeo.',
        });
      }
    }

    return { capabilities, gchatSpaces };
  }

  private async safeGetMeetingContext(): Promise<WorkflowHubOverview['meetingContext']> {
    try {
      const context = await this.deps.meetingWorkflowService.getContext();
      return {
        teams: context.teams || [],
        projects: context.projects || [],
        teamMembers: context.teamMembers || [],
      };
    } catch {
      return {
        teams: [],
        projects: [],
        teamMembers: [],
      };
    }
  }

  private mapAutomationRunToSummary(run: WorkflowRunRecord): WorkflowCaseSummary {
    const workflowId = AUTOMATION_TEMPLATE_TO_WORKFLOW[run.templateId];
    const workflow = this.getWorkflowDefinition(workflowId);
    const actions = this.mapAutomationActions(run.actions);
    const reasons = run.actions.filter((action) => action.error).map((action) => action.error || '').filter(Boolean);
    return {
      id: `${AUTOMATION_CASE_PREFIX}${run.id}`,
      nativeId: run.id,
      workflowId,
      workflowName: workflow.name,
      engine: 'automation',
      title: run.title,
      summary: run.summary,
      normalizedStatus: this.normalizeAutomationStatus(run.status),
      nativeStatus: run.status,
      createdAt: run.createdAt,
      updatedAt: run.updatedAt,
      actions: {
        pending: actions.filter((action) => action.status === 'pending').length,
        approved: actions.filter((action) => action.status === 'executed').length,
        failed: actions.filter((action) => action.status === 'failed').length,
        total: actions.length,
      },
      reasons,
    };
  }

  private mapAutomationRunToDetail(run: WorkflowRunRecord): WorkflowCaseDetail {
    const summary = this.mapAutomationRunToSummary(run);
    return {
      ...summary,
      preview: run.preview || {},
      approvals: run.approvals as unknown as Array<Record<string, unknown>>,
      logs: run.logs || [],
      actionsDetail: this.mapAutomationActions(run.actions),
      capabilitiesUsed: this.getWorkflowDefinition(summary.workflowId).requiredCapabilities,
      automationRun: structuredClone(run),
    };
  }

  private mapMeetingRunToSummary(run: MeetingRunSummary): WorkflowCaseSummary {
    const reasons = [
      ...(run.latest_asset?.review_flags.map((flag) => flag.message) || []),
    ];
    return {
      id: `${MEETING_CASE_PREFIX}${run.run.id}`,
      nativeId: run.run.id,
      workflowId: 'reuniones',
      workflowName: this.getWorkflowDefinition('reuniones').name,
      engine: 'meeting',
      title: run.run.meeting_title || 'Reunion sin titulo',
      summary: run.latest_asset?.executive_summary || 'Caso de reunion listo para revision.',
      normalizedStatus: this.normalizeMeetingStatus(run.run.status),
      nativeStatus: run.run.status,
      createdAt: run.run.created_at,
      updatedAt: run.run.updated_at,
      actions: {
        pending: run.counts.draft_actions,
        approved: run.counts.approved_actions + run.counts.synced_actions,
        failed: run.counts.failed_actions,
        total: run.counts.draft_actions + run.counts.approved_actions + run.counts.synced_actions + run.counts.failed_actions,
      },
      reasons,
    };
  }

  private mapMeetingRunToDetail(detail: MeetingRunDetail): WorkflowCaseDetail {
    const summary = this.mapMeetingRunToSummary({
      run: detail.run,
      latest_asset: detail.latest_asset
        ? {
            id: detail.latest_asset.id,
            executive_summary: detail.latest_asset.executive_summary,
            operational_summary: detail.latest_asset.operational_summary,
            review_flags: detail.latest_asset.review_flags,
            created_at: detail.run.updated_at,
          }
        : null,
      counts: {
        draft_actions: detail.sync_actions.filter((action) => action.approval_state === 'draft').length,
        approved_actions: detail.sync_actions.filter((action) => action.approval_state === 'approved').length,
        synced_actions: detail.sync_actions.filter((action) => action.sync_state === 'synced').length,
        failed_actions: detail.sync_actions.filter((action) => action.sync_state === 'failed').length,
      },
    });

    const reasons = [
      ...(detail.latest_asset?.review_flags.map((flag) => flag.message) || []),
      ...detail.sync_actions.flatMap((action) => action.blocking_flags || []),
    ].filter(Boolean);

    return {
      ...summary,
      reasons,
      preview: detail.latest_asset?.payload.analysis_result
        ? {
            executiveSummary: detail.latest_asset.payload.analysis_result.executiveSummary,
            keyPoints: detail.latest_asset.payload.analysis_result.keyPoints,
            decisions: detail.latest_asset.payload.analysis_result.decisions.length,
            tasks: detail.latest_asset.payload.analysis_result.tasks.length,
            risks: detail.latest_asset.payload.analysis_result.risks.length,
          }
        : {},
      approvals: detail.approvals as unknown as Array<Record<string, unknown>>,
      logs: [],
      actionsDetail: detail.sync_actions.map((action) => ({
        id: action.id,
        title: action.payload.title || action.summary,
        kind: action.action_type,
        status: this.normalizeMeetingActionStatus(action.approval_state, action.sync_state, action.error_message),
        payload: action.payload as unknown as Record<string, unknown>,
        error: action.error_message,
        blockingFlags: action.blocking_flags,
        approvalState: action.approval_state,
        syncState: action.sync_state,
      })),
      capabilitiesUsed: ['calendar', 'drive', 'gmail', 'google_user_mapping'],
      meetingDetail: structuredClone(detail),
    };
  }

  private mapAutomationActions(actions: WorkflowActionRecord[]): WorkflowCaseAction[] {
    return actions.map((action) => ({
      id: action.id,
      title: action.title,
      kind: action.kind,
      status: action.status,
      payload: action.payload || {},
      error: action.error,
      approvalState: null,
      syncState: null,
    }));
  }

  private parseCaseId(caseId: string): { engine: WorkflowEngine; nativeId: string } {
    if (caseId.startsWith(AUTOMATION_CASE_PREFIX)) {
      return { engine: 'automation', nativeId: caseId.slice(AUTOMATION_CASE_PREFIX.length) };
    }
    if (caseId.startsWith(MEETING_CASE_PREFIX)) {
      return { engine: 'meeting', nativeId: caseId.slice(MEETING_CASE_PREFIX.length) };
    }
    throw new Error('No reconoci el caso solicitado.');
  }

  private getWorkflowDefinition(workflowId: WorkflowId): WorkflowDefinition {
    const workflow = WORKFLOW_DEFINITIONS.find((candidate) => candidate.id === workflowId);
    if (!workflow) {
      throw new Error('No encontre el workflow solicitado.');
    }
    return workflow;
  }

  private resolveMailPresetQuery(preset: string): string {
    switch (preset) {
      case 'today':
        return 'in:inbox newer_than:1d';
      case 'priority':
        return 'in:inbox category:primary newer_than:7d';
      case 'custom':
        return 'in:inbox newer_than:7d';
      case 'unread':
      default:
        return 'in:inbox is:unread newer_than:7d';
    }
  }

  private resolveDriveFolderPreset(preset: string): Array<Record<string, unknown>> {
    switch (preset) {
      case 'proyecto_simple':
        return [
          { name: '01 Alcance' },
          { name: '02 Operacion' },
          { name: '03 Entregables' },
        ];
      case 'operacion':
        return [
          { name: '01 Operacion diaria' },
          { name: '02 Reportes' },
          { name: '03 Incidencias' },
          { name: '04 Evidencias' },
        ];
      case 'cliente_estandar':
      default:
        return [
          { name: '01 Direccion' },
          { name: '02 Operacion' },
          { name: '03 Comercial' },
          { name: '04 Entregables' },
          { name: '05 Finanzas' },
        ];
    }
  }

  private resolveOwnerUserId(requestedBy: string | null): string {
    const normalized = String(requestedBy || '').trim();
    if (!normalized) {
      throw new Error('Necesito un usuario solicitante para crear el caso de reunion.');
    }
    if (normalized.startsWith('app:')) {
      return normalized.slice(4);
    }
    if (normalized.startsWith('whatsapp:')) {
      return normalized.slice(9);
    }
    if (normalized.startsWith('telegram:')) {
      return normalized.slice(9);
    }
    return normalized;
  }

  private normalizeAutomationStatus(status: string): WorkflowCaseStatus {
    switch (status) {
      case 'needs_approval':
        return 'pending_approval';
      case 'completed':
        return 'completed';
      case 'failed':
        return 'failed';
      case 'rejected':
      case 'cancelled':
      default:
        return 'attention';
    }
  }

  private normalizeMeetingStatus(status: string): WorkflowCaseStatus {
    switch (status) {
      case 'REVIEW_REQUIRED':
        return 'pending_approval';
      case 'SOURCE_IMPORTED':
      case 'EXTRACTING':
      case 'SYNCING':
      case 'APPROVED':
      case 'FOLLOWUP_ACTIVE':
        return 'in_progress';
      case 'SYNCED':
      case 'CLOSED':
        return 'completed';
      case 'FAILED_IMPORT':
      case 'FAILED_EXTRACTION':
      case 'SYNC_FAILED':
        return 'failed';
      case 'BLOCKED_REVIEW':
      default:
        return 'attention';
    }
  }

  private normalizeMeetingActionStatus(approvalState: string, syncState: string, errorMessage: string | null): WorkflowCaseAction['status'] {
    if (errorMessage || syncState === 'failed') {
      return 'failed';
    }
    if (syncState === 'synced') {
      return 'executed';
    }
    if (approvalState === 'approved') {
      return 'approved';
    }
    if (approvalState === 'rejected') {
      return 'skipped';
    }
    return 'pending';
  }

  private normalizeOptionalString(value: unknown): string | null {
    const normalized = String(value || '').trim();
    return normalized || null;
  }

  private normalizeEnum(value: unknown, allowed: string[], fallback: string): string {
    const normalized = String(value || '').trim();
    return allowed.includes(normalized) ? normalized : fallback;
  }

  private normalizeNumber(value: unknown, fallback: number, min: number, max: number): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return fallback;
    }
    return Math.max(min, Math.min(max, Math.round(parsed)));
  }

  private requireNonEmptyString(value: unknown, errorMessage: string): string {
    const normalized = this.normalizeOptionalString(value);
    if (!normalized) {
      throw new Error(errorMessage);
    }
    return normalized;
  }

  private getStatePath(): string {
    return path.join(app.getPath('userData'), 'workflow-hub-state.json');
  }

  private loadState(): void {
    try {
      const statePath = this.getStatePath();
      if (!fs.existsSync(statePath)) {
        this.saveState();
        return;
      }
      const parsed = JSON.parse(fs.readFileSync(statePath, 'utf-8')) as Partial<WorkflowHubState>;
      this.state = {
        variants: Array.isArray(parsed.variants) ? parsed.variants : [],
      };
    } catch (error) {
      console.error('[WorkflowHubService] No se pudo cargar el estado:', error);
      this.state = { variants: [] };
      this.saveState();
    }
  }

  private saveState(): void {
    const statePath = this.getStatePath();
    fs.mkdirSync(path.dirname(statePath), { recursive: true });
    fs.writeFileSync(statePath, JSON.stringify(this.state, null, 2), 'utf-8');
  }
}
