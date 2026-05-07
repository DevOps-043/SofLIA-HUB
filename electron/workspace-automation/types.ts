/**
 * Tipos de dominio del Workspace Automation Service.
 *
 * Sin lógica — solo contratos. Permiten que código consumidor
 * (workflow-hub-service, IPC handlers, tests) referencie tipos sin importar
 * la implementación.
 */

import type { CalendarService } from '../calendar-service';
import type { DesktopAgentService } from '../desktop-agent-service';
import type { DriveService } from '../drive-service';
import type { GChatService } from '../gchat-service';
import type { GmailService } from '../gmail-service';

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

export interface WorkflowState {
  runs: WorkflowRunRecord[];
  templates: WorkflowTemplateDefinition[];
}

export interface WorkflowDependencies {
  gmailService: GmailService;
  calendarService: CalendarService;
  gchatService: GChatService;
  driveService: DriveService;
  desktopAgentService: DesktopAgentService;
}

export interface ExecuteTemplateInput {
  templateId: WorkflowTemplateId;
  input?: Record<string, any>;
  requestedBy?: string | null;
}

export interface CreateCustomTemplateInput {
  name?: string | null;
  objective: string;
  requestedBy?: string | null;
}

/**
 * Definición de una carpeta dentro del template `drive_project_workspace`.
 * Permite anidar subcarpetas recursivamente.
 */
export interface DriveFolderDefinition {
  name: string;
  children?: DriveFolderDefinition[];
}
