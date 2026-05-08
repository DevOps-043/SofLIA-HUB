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
