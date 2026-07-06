import { useEffect, useMemo, useState } from 'react';
import { getWorkflowCaseDetail, getWorkflowHubOverview, isWorkflowHubAvailable, savePassiveWorkflowRule, type WorkflowCaseDetail, type WorkflowHubOverview, type WorkflowId } from '../../../services/workflow-hub-service';
import { buildCronExpression, describeSchedule } from './formatters';
import type { ActionDraft, PassiveScheduleFrequency } from './types';

export function useWorkflowHubPanelModel(userId: string, organizationId?: string) {
  const hubAvailable = useMemo(() => isWorkflowHubAvailable(), []);
  const [overview, setOverview] = useState<WorkflowHubOverview | null>(null);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<WorkflowId>('correo');
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedCaseDetail, setSelectedCaseDetail] = useState<WorkflowCaseDetail | null>(null);
  const [draftConfig, setDraftConfig] = useState<Record<string, unknown>>({});
  const [variantName, setVariantName] = useState('');
  const [variantDescription, setVariantDescription] = useState('');
  const [passiveRuleName, setPassiveRuleName] = useState('');
  const [passiveRuleDescription, setPassiveRuleDescription] = useState('');
  const [scheduleFrequency, setScheduleFrequency] = useState<PassiveScheduleFrequency>('daily');
  const [scheduleTime, setScheduleTime] = useState('08:00');
  const [scheduleWeekday, setScheduleWeekday] = useState('1');
  const [decisionComment, setDecisionComment] = useState('');
  const [actionDrafts, setActionDrafts] = useState<Record<string, ActionDraft>>({});
  const [loading, setLoading] = useState(false);
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const inputClass = 'w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-gray-800 dark:text-gray-200 placeholder:text-secondary/70 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 transition-colors';
  const textareaClass = `${inputClass} min-h-[88px] resize-y`;
  const selectedWorkflow = useMemo(() => overview?.workflows.find((workflow) => workflow.id === selectedWorkflowId) || null, [overview, selectedWorkflowId]);
  const workflowVariants = useMemo(() => (overview?.variants || []).filter((variant) => variant.workflowId === selectedWorkflowId), [overview, selectedWorkflowId]);
  const selectedVariant = useMemo(() => workflowVariants.find((variant) => variant.id === selectedVariantId) || null, [selectedVariantId, workflowVariants]);
  const teams = overview?.meetingContext.teams || [];
  const projects = overview?.meetingContext.projects || [];
  const teamMembers = overview?.meetingContext.teamMembers || [];
  const gchatSpaces = overview?.gchatSpaces || [];
  const passiveRules = overview?.passiveRules || [], passiveCapableWorkflows = (overview?.workflows || []).filter((workflow) => workflow.triggerModes.includes('passive'));
  const activationCapableWorkflows = (overview?.workflows || []).filter((workflow) => workflow.triggerModes.includes('activation'));

  useEffect(() => { void refreshOverview(false); }, [userId, organizationId]);
  useEffect(() => {
    if (!overview) return;
    const workflow = overview.workflows.find((item) => item.id === selectedWorkflowId) || overview.workflows[0] || null;
    if (!workflow) return;
    if (workflow.id !== selectedWorkflowId) { setSelectedWorkflowId(workflow.id); return; }
    if (selectedVariantId && !overview.variants.some((variant) => variant.id === selectedVariantId && variant.workflowId === workflow.id)) { setSelectedVariantId(null); return; }
    const variant = overview.variants.find((item) => item.id === selectedVariantId) || null;
    setDraftConfig({ ...(workflow.defaultConfig || {}), ...(variant?.config || {}) });
    setVariantName(variant?.name || '');
    setVariantDescription(variant?.description || '');
    setPassiveRuleName((current) => current || `${workflow.name} programado`);
    setPassiveRuleDescription((current) => current || `Workflow pasivo de ${workflow.name.toLowerCase()}.`);
    if (!selectedCaseId && overview.cases[0]) setSelectedCaseId(overview.cases[0].id);
  }, [overview, selectedWorkflowId, selectedVariantId, selectedCaseId]);
  useEffect(() => { if (!selectedCaseId) { setSelectedCaseDetail(null); return; } void loadCaseDetail(selectedCaseId); }, [selectedCaseId]);
  useEffect(() => {
    const detail = selectedCaseDetail?.meetingDetail;
    if (!detail) { setActionDrafts({}); return; }
    const nextDrafts: Record<string, ActionDraft> = {};
    for (const action of detail.sync_actions) {
      nextDrafts[action.id] = { title: action.payload.title || action.summary || '', dueDate: action.payload.due_date || '', teamId: action.payload.team_id || '', projectId: action.payload.project_id || '', assigneeId: action.payload.assignee_id || '' };
    }
    setActionDrafts(nextDrafts);
  }, [selectedCaseDetail]);

  async function refreshOverview(preserveSelection: boolean, preferredCaseId?: string): Promise<void> {
    setLoading(true); setError(null);
    try {
      const result = await getWorkflowHubOverview(organizationId);
      if (!result.success || !result.overview) throw new Error(result.error || 'No pude cargar el hub de workflows.');
      setOverview(result.overview);
      setSelectedCaseId((current) => preferredCaseId && result.overview!.cases.some((item) => item.id === preferredCaseId) ? preferredCaseId : preserveSelection && current && result.overview!.cases.some((item) => item.id === current) ? current : result.overview!.cases[0]?.id || null);
    } catch (currentError) { setError(currentError instanceof Error ? currentError.message : String(currentError)); } finally { setLoading(false); }
  }
  async function loadCaseDetail(caseId: string): Promise<void> {
    const result = await getWorkflowCaseDetail(caseId);
    if (!result.success || !result.detail) { setError(result.error || 'No pude cargar el detalle.'); return; }
    setSelectedCaseDetail(result.detail);
  }
  async function runAction(key: string, callback: () => Promise<void>): Promise<void> {
    setActionKey(key); setError(null); setNotice(null);
    try { await callback(); } catch (currentError) { setError(currentError instanceof Error ? currentError.message : String(currentError)); } finally { setActionKey(null); }
  }
  const updateConfig = (key: string, value: unknown) => setDraftConfig((current) => ({ ...current, [key]: value }));
  const getProjectsForTeam = (teamId: string) => teamId ? projects.filter((project) => !project.team_id || project.team_id === teamId) : projects;
  const getMembersForTeam = (teamId: string) => teamId ? teamMembers.filter((member) => member.team_id === teamId) : [];
  async function persistPassiveWorkflow(input: { workflowId?: WorkflowId | null; prompt?: string | null; executionMode?: 'agent_prompt' | 'workflow' }): Promise<void> {
    const name = passiveRuleName.trim();
    if (!name) throw new Error('Escribe un nombre para el workflow pasivo.');
    const result = await savePassiveWorkflowRule({ workflowId: input.workflowId || null, name, description: passiveRuleDescription.trim() || null, prompt: input.prompt || null, config: input.workflowId ? draftConfig : undefined, cronExpression: buildCronExpression(scheduleFrequency, scheduleTime, scheduleWeekday), scheduleLabel: describeSchedule(scheduleFrequency, scheduleTime, scheduleWeekday), requestedBy: `app:${userId}`, executionMode: input.executionMode, source: 'app' });
    if (!result.success || !result.rule) throw new Error(result.error || 'No pude guardar el workflow pasivo.');
    setNotice(`Workflow pasivo guardado: ${result.rule.name}.`);
    await refreshOverview(true, selectedCaseId || undefined);
  }

  return { userId, hubAvailable, overview, selectedWorkflowId, setSelectedWorkflowId, selectedVariantId, setSelectedVariantId, selectedCaseId, setSelectedCaseId, selectedCaseDetail, setSelectedCaseDetail, draftConfig, variantName, setVariantName, variantDescription, setVariantDescription, passiveRuleName, setPassiveRuleName, passiveRuleDescription, setPassiveRuleDescription, scheduleFrequency, setScheduleFrequency, scheduleTime, setScheduleTime, scheduleWeekday, setScheduleWeekday, decisionComment, setDecisionComment, actionDrafts, setActionDrafts, loading, actionKey, error, notice, setNotice, inputClass, textareaClass, selectedWorkflow, workflowVariants, selectedVariant, teams, projects, teamMembers, gchatSpaces, passiveRules, passiveCapableWorkflows, activationCapableWorkflows, describeSchedule, refreshOverview, runAction, updateConfig, getProjectsForTeam, getMembersForTeam, persistPassiveWorkflow };
}

export type WorkflowHubPanelModel = ReturnType<typeof useWorkflowHubPanelModel>;
