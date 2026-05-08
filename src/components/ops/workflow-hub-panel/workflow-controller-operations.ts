import type { Dispatch, SetStateAction } from 'react';
import { getWorkflowCaseDetail, getWorkflowHubOverview, savePassiveWorkflowRule, type WorkflowCaseDetail, type WorkflowHubOverview, type WorkflowId } from '../../../services/workflow-hub-service';
import { buildCronExpression, describeSchedule } from './formatters';
import type { PassiveScheduleFrequency } from './types';

export async function refreshWorkflowOverview(params: {
  preserveSelection: boolean;
  preferredCaseId?: string;
  setLoading: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setOverview: Dispatch<SetStateAction<WorkflowHubOverview | null>>;
  setSelectedCaseId: Dispatch<SetStateAction<string | null>>;
}): Promise<void> {
  params.setLoading(true);
  params.setError(null);
  try {
    const result = await getWorkflowHubOverview();
    if (!result.success || !result.overview) throw new Error(result.error || 'No pude cargar el hub de workflows.');
    params.setOverview(result.overview);
    params.setSelectedCaseId((current) => {
      if (params.preferredCaseId && result.overview!.cases.some((item) => item.id === params.preferredCaseId)) return params.preferredCaseId;
      if (params.preserveSelection && current && result.overview!.cases.some((item) => item.id === current)) return current;
      return result.overview!.cases[0]?.id || null;
    });
  } catch (error) {
    params.setError(error instanceof Error ? error.message : String(error));
  } finally {
    params.setLoading(false);
  }
}

export async function loadWorkflowCaseDetail(
  caseId: string | null,
  setSelectedCaseDetail: Dispatch<SetStateAction<WorkflowCaseDetail | null>>,
  setError: Dispatch<SetStateAction<string | null>>,
): Promise<void> {
  if (!caseId) { setSelectedCaseDetail(null); return; }
  const result = await getWorkflowCaseDetail(caseId);
  if (!result.success || !result.detail) {
    setError(result.error || 'No pude cargar el detalle.');
    return;
  }
  setSelectedCaseDetail(result.detail);
}

export async function runWorkflowAction(params: {
  key: string;
  callback: () => Promise<void>;
  setActionKey: Dispatch<SetStateAction<string | null>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setNotice: Dispatch<SetStateAction<string | null>>;
}): Promise<void> {
  params.setActionKey(params.key);
  params.setError(null);
  params.setNotice(null);
  try {
    await params.callback();
  } catch (error) {
    params.setError(error instanceof Error ? error.message : String(error));
  } finally {
    params.setActionKey(null);
  }
}

export async function persistPassiveWorkflowRule(params: {
  input: { workflowId?: WorkflowId | null; prompt?: string | null; executionMode?: 'agent_prompt' | 'workflow' };
  userId: string;
  draftConfig: Record<string, unknown>;
  passiveRuleName: string;
  passiveRuleDescription: string;
  scheduleFrequency: PassiveScheduleFrequency;
  scheduleTime: string;
  scheduleWeekday: string;
  selectedCaseId: string | null;
  setNotice: Dispatch<SetStateAction<string | null>>;
  refreshOverview: (preserveSelection: boolean, preferredCaseId?: string) => Promise<void>;
}): Promise<void> {
  const name = params.passiveRuleName.trim();
  if (!name) throw new Error('Escribe un nombre para el workflow pasivo.');
  const result = await savePassiveWorkflowRule({
    workflowId: params.input.workflowId || null,
    name,
    description: params.passiveRuleDescription.trim() || null,
    prompt: params.input.prompt || null,
    config: params.input.workflowId ? params.draftConfig : undefined,
    cronExpression: buildCronExpression(params.scheduleFrequency, params.scheduleTime, params.scheduleWeekday),
    scheduleLabel: describeSchedule(params.scheduleFrequency, params.scheduleTime, params.scheduleWeekday),
    requestedBy: `app:${params.userId}`,
    executionMode: params.input.executionMode,
    source: 'app',
  });
  if (!result.success || !result.rule) throw new Error(result.error || 'No pude guardar el workflow pasivo.');
  params.setNotice(`Workflow pasivo guardado: ${result.rule.name}.`);
  await params.refreshOverview(true, params.selectedCaseId || undefined);
}
