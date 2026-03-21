export type WorkflowTemplateId = string;

export type WorkflowRunStatus =
  | 'needs_approval'
  | 'completed'
  | 'failed'
  | 'rejected'
  | 'cancelled';

export type WorkflowActionStatus = 'pending' | 'executed' | 'failed' | 'skipped';

export type WorkflowActionKind =
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
  payload: Record<string, unknown>;
  result?: Record<string, unknown> | null;
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
  input: Record<string, unknown>;
  source: Record<string, unknown> | null;
  preview: Record<string, unknown>;
  actions: WorkflowActionRecord[];
  approvals: WorkflowApprovalRecord[];
  logs: Array<{
    at: string;
    level: 'info' | 'error';
    message: string;
  }>;
}

export interface ExecuteAutomationTemplateInput {
  templateId: WorkflowTemplateId;
  input?: Record<string, unknown>;
  requestedBy?: string | null;
}

export interface CreateCustomAutomationTemplateInput {
  name?: string | null;
  objective: string;
  requestedBy?: string | null;
}

declare global {
  interface Window {
    automation?: {
      listTemplates: () => Promise<{ success: boolean; templates?: WorkflowTemplateDefinition[]; error?: string }>;
      listRuns: (limit?: number) => Promise<{ success: boolean; runs?: WorkflowRunRecord[]; error?: string }>;
      createCustomTemplate: (input: CreateCustomAutomationTemplateInput) => Promise<{ success: boolean; template?: WorkflowTemplateDefinition; error?: string }>;
      getRun: (runId: string) => Promise<{ success: boolean; run?: WorkflowRunRecord; error?: string }>;
      executeTemplate: (input: ExecuteAutomationTemplateInput) => Promise<{ success: boolean; run?: WorkflowRunRecord; error?: string }>;
      approveRun: (input: { runId: string; decidedBy: string; comment?: string | null }) => Promise<{ success: boolean; run?: WorkflowRunRecord; error?: string }>;
      rejectRun: (input: { runId: string; decidedBy: string; comment?: string | null }) => Promise<{ success: boolean; run?: WorkflowRunRecord; error?: string }>;
    };
  }
}

function getAPI() {
  if (!window.automation) {
    throw new Error('Automation API no disponible. Ejecuta SofLIA dentro de Electron.');
  }
  return window.automation;
}

export function isAutomationAvailable(): boolean {
  return !!window.automation;
}

export async function listAutomationTemplates() {
  return getAPI().listTemplates();
}

export async function listAutomationRuns(limit?: number) {
  return getAPI().listRuns(limit);
}

export async function createCustomAutomationTemplate(input: CreateCustomAutomationTemplateInput) {
  return getAPI().createCustomTemplate(input);
}

export async function getAutomationRun(runId: string) {
  return getAPI().getRun(runId);
}

export async function executeAutomationTemplate(input: ExecuteAutomationTemplateInput) {
  return getAPI().executeTemplate(input);
}

export async function approveAutomationRun(input: { runId: string; decidedBy: string; comment?: string | null }) {
  return getAPI().approveRun(input);
}

export async function rejectAutomationRun(input: { runId: string; decidedBy: string; comment?: string | null }) {
  return getAPI().rejectRun(input);
}
