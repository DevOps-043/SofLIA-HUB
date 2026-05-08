import type { WorkflowDefinition, WorkflowId } from './types';
import { CORE_WORKFLOW_DEFINITIONS } from './definitions/core-workflows';
import { OPS_WORKFLOW_DEFINITIONS } from './definitions/ops-workflows';

export const AUTOMATION_CASE_PREFIX = 'automation:';
export const MEETING_CASE_PREFIX = 'meeting:';

export const WORKFLOW_DEFINITIONS: WorkflowDefinition[] = [
  ...CORE_WORKFLOW_DEFINITIONS,
  ...OPS_WORKFLOW_DEFINITIONS,
];

export const AUTOMATION_TEMPLATE_TO_WORKFLOW: Record<string, WorkflowId> = {
  gmail_triage: 'correo',
  calendar_daily_brief: 'agenda',
  gmail_followup_draft: 'seguimiento',
  calendar_meeting_prep: 'reuniones',
  drive_project_workspace: 'drive',
  gchat_executive_update: 'actualizacion_equipo',
  desktop_action: 'pc',
};
