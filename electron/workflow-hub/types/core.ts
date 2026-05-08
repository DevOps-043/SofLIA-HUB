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
