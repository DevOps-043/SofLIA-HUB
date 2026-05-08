import type { Dispatch, SetStateAction } from 'react';
import type { WorkflowCaseDetail, WorkflowHubOverview, WorkflowId } from '../../../services/workflow-hub-service';
import type { ActionDraft, PassiveScheduleFrequency } from './types';

export type PanelState = {
  overview: WorkflowHubOverview | null;
  selectedWorkflowId: WorkflowId;
  selectedVariantId: string | null;
  selectedCaseId: string | null;
  selectedCaseDetail: WorkflowCaseDetail | null;
  draftConfig: Record<string, unknown>;
  variantName: string;
  variantDescription: string;
  passiveRuleName: string;
  passiveRuleDescription: string;
  scheduleFrequency: PassiveScheduleFrequency;
  scheduleTime: string;
  scheduleWeekday: string;
  decisionComment: string;
  actionDrafts: Record<string, ActionDraft>;
  loading: boolean;
  actionKey: string | null;
  error: string | null;
  notice: string | null;
};

export const initialWorkflowHubState: PanelState = {
  overview: null, selectedWorkflowId: 'correo', selectedVariantId: null, selectedCaseId: null, selectedCaseDetail: null,
  draftConfig: {}, variantName: '', variantDescription: '', passiveRuleName: '', passiveRuleDescription: '',
  scheduleFrequency: 'daily', scheduleTime: '08:00', scheduleWeekday: '1', decisionComment: '', actionDrafts: {},
  loading: false, actionKey: null, error: null, notice: null,
};

export function buildActionDrafts(detail: WorkflowCaseDetail | null): Record<string, ActionDraft> {
  const meetingDetail = detail?.meetingDetail;
  if (!meetingDetail) return {};
  return Object.fromEntries(meetingDetail.sync_actions.map((action) => [action.id, {
    title: action.payload.title || action.summary || '',
    dueDate: action.payload.due_date || '',
    teamId: action.payload.team_id || '',
    projectId: action.payload.project_id || '',
    assigneeId: action.payload.assignee_id || '',
  }]));
}

export function createWorkflowStateSetter(setState: Dispatch<SetStateAction<PanelState>>) {
  return <Key extends keyof PanelState>(key: Key, value: SetStateAction<PanelState[Key]>) => {
    setState((current) => ({
      ...current,
      [key]: typeof value === 'function'
        ? (value as (previous: PanelState[Key]) => PanelState[Key])(current[key])
        : value,
    }));
  };
}
