import type { ChatSpace } from './gchat-service';
import type {
  MeetingContextProject,
  MeetingContextTeam,
  MeetingContextTeamMember,
  MeetingRunDetail,
} from './meeting-service';

export type WorkflowId =
  | 'correo'
  | 'agenda'
  | 'seguimiento'
  | 'reuniones'
  | 'drive'
  | 'actualizacion_equipo'
  | 'pc';

export type WorkflowCapabilityKey =
  | 'calendar'
  | 'gmail'
  | 'drive'
  | 'gchat'
  | 'google_user_mapping';

export type WorkflowCapabilityState =
  | 'available'
  | 'disconnected'
  | 'setup_required'
  | 'blocked'
  | 'error';

export type WorkflowEngine = 'automation' | 'meeting' | 'hybrid';
export type WorkflowCaseStatus = 'pending_approval' | 'in_progress' | 'completed' | 'failed' | 'attention';
export type WorkflowApprovalScope = 'case' | 'summary' | 'actions' | 'action';
export type WorkflowTriggerMode = 'activation' | 'passive';
export type PassiveWorkflowBehavior = 'scheduled' | 'system';
export type PassiveWorkflowStatus = 'active' | 'blocked' | 'system';
export type PassiveWorkflowSource = 'legacy' | 'chat' | 'app' | 'system';
export type PassiveWorkflowExecutionMode = 'agent_prompt' | 'workflow';

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
  engine: WorkflowEngine;
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
  executionMode: PassiveWorkflowExecutionMode;
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
  engine: 'automation' | 'meeting';
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
  automationRun?: Record<string, unknown>;
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
  executionMode?: PassiveWorkflowExecutionMode;
}

export interface UpdateWorkflowCaseActionInput {
  caseId: string;
  actionId: string;
  updates: {
    title?: string | null;
    description?: string | null;
    team_id?: string | null;
    project_id?: string | null;
    due_date?: string | null;
    owner_candidate?: string | null;
    assignee_id?: string | null;
    summary?: string | null;
  };
}

declare global {
  interface Window {
    workflowHub?: {
      getOverview: () => Promise<{ success: boolean; overview?: WorkflowHubOverview; error?: string }>;
      getCaseDetail: (caseId: string) => Promise<{ success: boolean; detail?: WorkflowCaseDetail; error?: string }>;
      executeWorkflow: (input: ExecuteWorkflowInput) => Promise<{ success: boolean; detail?: WorkflowCaseDetail; error?: string }>;
      saveVariant: (input: SaveWorkflowVariantInput) => Promise<{ success: boolean; variant?: WorkflowVariant; error?: string }>;
      savePassiveRule: (input: SavePassiveWorkflowRuleInput) => Promise<{ success: boolean; rule?: PassiveWorkflowRule; error?: string }>;
      deletePassiveRule: (ruleId: string) => Promise<{ success: boolean; deleted?: boolean; error?: string }>;
      approveCase: (input: {
        caseId: string;
        decidedBy: string;
        scope: WorkflowApprovalScope;
        actionId?: string;
        comment?: string | null;
      }) => Promise<{ success: boolean; detail?: WorkflowCaseDetail; error?: string }>;
      rejectCase: (input: {
        caseId: string;
        decidedBy: string;
        scope: 'case' | 'action';
        actionId?: string;
        comment?: string | null;
      }) => Promise<{ success: boolean; detail?: WorkflowCaseDetail; error?: string }>;
      updateCaseAction: (input: UpdateWorkflowCaseActionInput) => Promise<{ success: boolean; detail?: WorkflowCaseDetail; error?: string }>;
      syncCase: (input: { caseId: string; decidedBy: string }) => Promise<{ success: boolean; detail?: WorkflowCaseDetail; error?: string }>;
    };
  }
}

function getAPI() {
  if (!window.workflowHub) {
    throw new Error('Workflow Hub no disponible. Ejecuta SofLIA dentro de Electron.');
  }
  return window.workflowHub;
}

export function isWorkflowHubAvailable(): boolean {
  return !!window.workflowHub;
}

export async function getWorkflowHubOverview() {
  return getAPI().getOverview();
}

export async function getWorkflowCaseDetail(caseId: string) {
  return getAPI().getCaseDetail(caseId);
}

export async function executeWorkflowHub(input: ExecuteWorkflowInput) {
  return getAPI().executeWorkflow(input);
}

export async function saveWorkflowVariant(input: SaveWorkflowVariantInput) {
  return getAPI().saveVariant(input);
}

export async function savePassiveWorkflowRule(input: SavePassiveWorkflowRuleInput) {
  return getAPI().savePassiveRule(input);
}

export async function deletePassiveWorkflowRule(ruleId: string) {
  return getAPI().deletePassiveRule(ruleId);
}

export async function approveWorkflowCase(input: {
  caseId: string;
  decidedBy: string;
  scope: WorkflowApprovalScope;
  actionId?: string;
  comment?: string | null;
}) {
  return getAPI().approveCase(input);
}

export async function rejectWorkflowCase(input: {
  caseId: string;
  decidedBy: string;
  scope: 'case' | 'action';
  actionId?: string;
  comment?: string | null;
}) {
  return getAPI().rejectCase(input);
}

export async function updateWorkflowCaseAction(input: UpdateWorkflowCaseActionInput) {
  return getAPI().updateCaseAction(input);
}

export async function syncWorkflowCase(input: { caseId: string; decidedBy: string }) {
  return getAPI().syncCase(input);
}
