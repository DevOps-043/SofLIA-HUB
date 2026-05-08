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
export type WorkflowCaseStatus = 'pending_approval' | 'in_progress' | 'completed' | 'failed' | 'attention';
export type WorkflowApprovalScope = 'case' | 'summary' | 'actions' | 'action';
export type WorkflowTriggerMode = 'activation' | 'passive';
export type PassiveWorkflowBehavior = 'scheduled' | 'system';
export type PassiveWorkflowSource = 'legacy' | 'chat' | 'app' | 'system';
export type PassiveWorkflowStatus = 'active' | 'blocked' | 'system';

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
