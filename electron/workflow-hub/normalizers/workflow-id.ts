import { AUTOMATION_CASE_PREFIX, MEETING_CASE_PREFIX, WORKFLOW_DEFINITIONS } from '../definitions';
import type { WorkflowEngine, WorkflowId } from '../types';

export function isWorkflowId(value: string): value is WorkflowId {
  return WORKFLOW_DEFINITIONS.some((workflow) => workflow.id === value);
}

export function parseCaseId(caseId: string): { engine: WorkflowEngine; nativeId: string } {
  if (caseId.startsWith(AUTOMATION_CASE_PREFIX)) {
    return { engine: 'automation', nativeId: caseId.slice(AUTOMATION_CASE_PREFIX.length) };
  }
  if (caseId.startsWith(MEETING_CASE_PREFIX)) {
    return { engine: 'meeting', nativeId: caseId.slice(MEETING_CASE_PREFIX.length) };
  }
  throw new Error('No reconoci el caso solicitado.');
}
