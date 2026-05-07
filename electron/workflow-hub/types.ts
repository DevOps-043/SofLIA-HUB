/**
 * Tipos de dominio del Workflow Hub.
 *
 * Centraliza los contratos para que la clase `WorkflowHubService` y los
 * consumidores externos (handlers IPC, Telegram, WhatsApp agent) compartan
 * la misma fuente de verdad sobre la forma de los datos.
 */

import type { ChatSpace } from '../gchat-service';
import type { ScheduledTaskExecutionMode } from '../task-scheduler';
import type { MeetingRunDetail } from '../meetings/meeting-types';
import type { WorkflowRunRecord } from '../workspace-automation-service';

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

export type WorkflowEngine = 'automation' | 'meeting';
export type WorkflowCaseStatus =
  | 'pending_approval'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'attention';
export type WorkflowApprovalScope = 'case' | 'summary' | 'actions' | 'action';
export type WorkflowTriggerMode = 'activation' | 'passive';
export type PassiveWorkflowBehavior = 'scheduled' | 'system';
export type PassiveWorkflowSource = 'legacy' | 'chat' | 'app' | 'system';
export type PassiveWorkflowStatus = 'active' | 'blocked' | 'system';

export interface MeetingContextTeam {
  team_id: string;
  name: string;
}

export interface MeetingContextProject {
  project_id: string;
  project_name: string;
  team_id?: string | null;
}

export interface MeetingContextTeamMember {
  membership_id?: string;
  team_id: string;
  user_id: string;
  role: string;
  joined_at: string;
  display_name?: string | null;
  email?: string | null;
  username?: string | null;
}

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

export interface WorkflowHubState {
  variants: WorkflowVariant[];
}
