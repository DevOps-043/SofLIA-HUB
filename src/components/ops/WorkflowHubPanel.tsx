import React, { useEffect, useMemo, useState } from 'react';
import {
  approveWorkflowCase,
  deletePassiveWorkflowRule,
  executeWorkflowHub,
  getWorkflowCaseDetail,
  getWorkflowHubOverview,
  isWorkflowHubAvailable,
  rejectWorkflowCase,
  savePassiveWorkflowRule,
  saveWorkflowVariant,
  syncWorkflowCase,
  updateWorkflowCaseAction,
  type WorkflowCaseDetail,
  type WorkflowDefinition,
  type WorkflowHubOverview,
  type WorkflowId,
} from '../../services/workflow-hub-service';

interface WorkflowHubPanelProps {
  userId: string;
  organizationId?: string | null;
}

type ActionDraft = {
  title: string;
  dueDate: string;
  teamId: string;
  projectId: string;
  assigneeId: string;
};

type PassiveScheduleFrequency = 'daily' | 'weekdays' | 'weekly';

const STATUS_STYLES: Record<string, string> = {
  pending_approval: 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/20',
  in_progress: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-300 border-cyan-500/20',
  completed: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/20',
  failed: 'bg-red-500/15 text-red-600 dark:text-red-300 border-red-500/20',
  attention: 'bg-orange-500/15 text-orange-600 dark:text-orange-300 border-orange-500/20',
  available: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/20',
  active: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/20',
  disconnected: 'bg-gray-500/15 text-gray-500 dark:text-gray-400 border-gray-500/20',
  setup_required: 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/20',
  blocked: 'bg-orange-500/15 text-orange-600 dark:text-orange-300 border-orange-500/20',
  error: 'bg-red-500/15 text-red-600 dark:text-red-300 border-red-500/20',
  system: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-300 border-cyan-500/20',
  pending: 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/20',
  approved: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-300 border-cyan-500/20',
  executed: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/20',
  skipped: 'bg-gray-500/15 text-gray-500 dark:text-gray-400 border-gray-500/20',
};

function formatDateTime(value?: string | null): string {
  if (!value) return 'n/d';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('es-MX', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function previewValue(value: unknown): string {
  if (Array.isArray(value)) return value.map((item) => previewValue(item)).join(', ');
  if (value && typeof value === 'object') return JSON.stringify(value);
  if (value === null || value === undefined || value === '') return 'n/d';
  return String(value);
}

function prettyValue(value: string): string {
  return value.replace(/_/g, ' ');
}

function tone(value: string): string {
  return STATUS_STYLES[value] || 'bg-gray-500/15 text-gray-500 dark:text-gray-400 border-gray-500/20';
}

function buildCronExpression(frequency: PassiveScheduleFrequency, time: string, weekday: string): string {
  const [hourRaw, minuteRaw] = (time || '08:00').split(':');
  const hour = Number(hourRaw || 8);
  const minute = Number(minuteRaw || 0);
  if (frequency === 'weekdays') {
    return `${minute} ${hour} * * 1-5`;
  }
  if (frequency === 'weekly') {
    return `${minute} ${hour} * * ${weekday || '1'}`;
  }
  return `${minute} ${hour} * * *`;
}

function describeSchedule(frequency: PassiveScheduleFrequency, time: string, weekday: string): string {
  const timeLabel = time || '08:00';
  const weekdayLabel: Record<string, string> = {
    '0': 'Domingo',
    '1': 'Lunes',
    '2': 'Martes',
    '3': 'Miercoles',
    '4': 'Jueves',
    '5': 'Viernes',
    '6': 'Sabado',
  };
  if (frequency === 'weekdays') {
    return `Lunes a viernes a las ${timeLabel}`;
  }
  if (frequency === 'weekly') {
    return `${weekdayLabel[weekday || '1'] || 'Lunes'} a las ${timeLabel}`;
  }
  return `Todos los dias a las ${timeLabel}`;
}

function Badge({ value }: { value: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium uppercase tracking-wide border ${tone(value)}`}>
      {prettyValue(value)}
    </span>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-gray-200 dark:border-white/[0.06] py-6 flex items-center justify-center">
      <span className="text-[13px] text-gray-400 dark:text-gray-600">{text}</span>
    </div>
  );
}

export const WorkflowHubPanel: React.FC<WorkflowHubPanelProps> = ({ userId }) => {
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

  const inputClass = 'w-full rounded-xl border border-gray-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.03] px-3 py-2 text-[13px] text-gray-800 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-600 focus:outline-none focus:border-accent/35 focus:ring-1 focus:ring-accent/20 transition';
  const textareaClass = `${inputClass} min-h-[88px] resize-y`;

  const selectedWorkflow = useMemo(
    () => overview?.workflows.find((workflow) => workflow.id === selectedWorkflowId) || null,
    [overview, selectedWorkflowId],
  );

  const workflowVariants = useMemo(
    () => (overview?.variants || []).filter((variant) => variant.workflowId === selectedWorkflowId),
    [overview, selectedWorkflowId],
  );

  const selectedVariant = useMemo(
    () => workflowVariants.find((variant) => variant.id === selectedVariantId) || null,
    [selectedVariantId, workflowVariants],
  );

  const currentAnalysis = selectedCaseDetail?.meetingDetail?.latest_asset?.payload.analysis_result || null;
  const teams = overview?.meetingContext.teams || [];
  const projects = overview?.meetingContext.projects || [];
  const teamMembers = overview?.meetingContext.teamMembers || [];
  const gchatSpaces = overview?.gchatSpaces || [];
  const passiveRules = overview?.passiveRules || [];
  const passiveCapableWorkflows = (overview?.workflows || []).filter((workflow) => workflow.triggerModes.includes('passive'));
  const activationCapableWorkflows = (overview?.workflows || []).filter((workflow) => workflow.triggerModes.includes('activation'));

  useEffect(() => {
    void refreshOverview(false);
  }, [userId]);

  useEffect(() => {
    if (!overview) return;
    const workflow = overview.workflows.find((item) => item.id === selectedWorkflowId) || overview.workflows[0] || null;
    if (!workflow) return;
    if (workflow.id !== selectedWorkflowId) {
      setSelectedWorkflowId(workflow.id);
      return;
    }
    if (selectedVariantId && !overview.variants.some((variant) => variant.id === selectedVariantId && variant.workflowId === workflow.id)) {
      setSelectedVariantId(null);
      return;
    }
    const variant = overview.variants.find((item) => item.id === selectedVariantId) || null;
    setDraftConfig({
      ...(workflow.defaultConfig || {}),
      ...(variant?.config || {}),
    });
    setVariantName(variant?.name || '');
    setVariantDescription(variant?.description || '');
    setPassiveRuleName((current) => current || `${workflow.name} programado`);
    setPassiveRuleDescription((current) => current || `Workflow pasivo de ${workflow.name.toLowerCase()}.`);
    if (!selectedCaseId && overview.cases[0]) {
      setSelectedCaseId(overview.cases[0].id);
    }
  }, [overview, selectedWorkflowId, selectedVariantId, selectedCaseId]);

  useEffect(() => {
    if (!selectedCaseId) {
      setSelectedCaseDetail(null);
      return;
    }
    void loadCaseDetail(selectedCaseId);
  }, [selectedCaseId]);

  useEffect(() => {
    const detail = selectedCaseDetail?.meetingDetail;
    if (!detail) {
      setActionDrafts({});
      return;
    }
    const nextDrafts: Record<string, ActionDraft> = {};
    for (const action of detail.sync_actions) {
      nextDrafts[action.id] = {
        title: action.payload.title || action.summary || '',
        dueDate: action.payload.due_date || '',
        teamId: action.payload.team_id || '',
        projectId: action.payload.project_id || '',
        assigneeId: action.payload.assignee_id || '',
      };
    }
    setActionDrafts(nextDrafts);
  }, [selectedCaseDetail]);

  async function refreshOverview(preserveSelection: boolean, preferredCaseId?: string): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const result = await getWorkflowHubOverview();
      if (!result.success || !result.overview) {
        throw new Error(result.error || 'No pude cargar el hub de workflows.');
      }
      setOverview(result.overview);
      setSelectedCaseId((current) => {
        if (preferredCaseId && result.overview!.cases.some((item) => item.id === preferredCaseId)) return preferredCaseId;
        if (preserveSelection && current && result.overview!.cases.some((item) => item.id === current)) return current;
        return result.overview!.cases[0]?.id || null;
      });
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : String(currentError));
    } finally {
      setLoading(false);
    }
  }

  async function loadCaseDetail(caseId: string): Promise<void> {
    const result = await getWorkflowCaseDetail(caseId);
    if (!result.success || !result.detail) {
      setError(result.error || 'No pude cargar el detalle.');
      return;
    }
    setSelectedCaseDetail(result.detail);
  }

  async function runAction(key: string, callback: () => Promise<void>): Promise<void> {
    setActionKey(key);
    setError(null);
    setNotice(null);
    try {
      await callback();
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : String(currentError));
    } finally {
      setActionKey(null);
    }
  }

  function updateConfig(key: string, value: unknown): void {
    setDraftConfig((current) => ({ ...current, [key]: value }));
  }

  function getProjectsForTeam(teamId: string) {
    if (!teamId) return projects;
    return projects.filter((project) => !project.team_id || project.team_id === teamId);
  }

  function getMembersForTeam(teamId: string) {
    if (!teamId) return [];
    return teamMembers.filter((member) => member.team_id === teamId);
  }

  async function persistPassiveWorkflow(input: {
    workflowId?: WorkflowId | null;
    prompt?: string | null;
    executionMode?: 'agent_prompt' | 'workflow';
  }): Promise<void> {
    const name = passiveRuleName.trim();
    if (!name) {
      throw new Error('Escribe un nombre para el workflow pasivo.');
    }

    const cronExpression = buildCronExpression(scheduleFrequency, scheduleTime, scheduleWeekday);
    const scheduleLabel = describeSchedule(scheduleFrequency, scheduleTime, scheduleWeekday);
    const result = await savePassiveWorkflowRule({
      workflowId: input.workflowId || null,
      name,
      description: passiveRuleDescription.trim() || null,
      prompt: input.prompt || null,
      config: input.workflowId ? draftConfig : undefined,
      cronExpression,
      scheduleLabel,
      requestedBy: `app:${userId}`,
      executionMode: input.executionMode,
      source: 'app',
    });

    if (!result.success || !result.rule) {
      throw new Error(result.error || 'No pude guardar el workflow pasivo.');
    }

    setNotice(`Workflow pasivo guardado: ${result.rule.name}.`);
    await refreshOverview(true, selectedCaseId || undefined);
  }

  function renderWorkflowForm(workflow: WorkflowDefinition): React.ReactNode {
    const mode = String(draftConfig.mode || 'manual');
    switch (workflow.id) {
      case 'correo':
        return (
          <div className="space-y-3">
            <select className={inputClass} value={String(draftConfig.preset || 'unread')} onChange={(event) => updateConfig('preset', event.target.value)}>
              <option value="unread">Correos pendientes</option>
              <option value="today">Correos de hoy</option>
              <option value="priority">Correos importantes</option>
              <option value="custom">Filtro personalizado</option>
            </select>
            {String(draftConfig.preset || 'unread') === 'custom' && (
              <input className={inputClass} value={String(draftConfig.query || '')} onChange={(event) => updateConfig('query', event.target.value)} placeholder="from:cliente@empresa.com newer_than:7d" />
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input className={inputClass} type="number" min={1} max={10} value={Number(draftConfig.maxResults || 5)} onChange={(event) => updateConfig('maxResults', Math.max(1, Math.min(10, Number(event.target.value) || 1)))} />
              <select className={inputClass} value={String(draftConfig.gchatSpace || '')} onChange={(event) => updateConfig('gchatSpace', event.target.value)}>
                <option value="">Sin Google Chat</option>
                {gchatSpaces.map((space) => <option key={space.name} value={space.name}>{space.displayName || space.name}</option>)}
              </select>
            </div>
          </div>
        );
      case 'agenda':
        return (
          <div className="space-y-3">
            <input className={inputClass} type="date" value={String(draftConfig.targetDate || '')} onChange={(event) => updateConfig('targetDate', event.target.value)} />
            <select className={inputClass} value={String(draftConfig.gchatSpace || '')} onChange={(event) => updateConfig('gchatSpace', event.target.value)}>
              <option value="">Sin Google Chat</option>
              {gchatSpaces.map((space) => <option key={space.name} value={space.name}>{space.displayName || space.name}</option>)}
            </select>
          </div>
        );
      case 'seguimiento':
        return (
          <div className="space-y-3">
            <input className={inputClass} value={String(draftConfig.to || '')} onChange={(event) => updateConfig('to', event.target.value)} placeholder="correo@empresa.com" />
            <input className={inputClass} value={String(draftConfig.topic || '')} onChange={(event) => updateConfig('topic', event.target.value)} placeholder="Tema del seguimiento" />
            <textarea className={textareaClass} value={String(draftConfig.context || '')} onChange={(event) => updateConfig('context', event.target.value)} placeholder="Contexto base..." />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input className={inputClass} value={String(draftConfig.tone || '')} onChange={(event) => updateConfig('tone', event.target.value)} placeholder="Tono" />
              <input className={inputClass} value={String(draftConfig.signature || '')} onChange={(event) => updateConfig('signature', event.target.value)} placeholder="Firma" />
            </div>
          </div>
        );
      case 'reuniones':
        return (
          <div className="space-y-3">
            <select className={inputClass} value={mode} onChange={(event) => updateConfig('mode', event.target.value)}>
              <option value="manual">Notas o transcripcion</option>
              <option value="drive">Google Drive</option>
              <option value="prep">Preparacion previa</option>
              <option value="auto">Deteccion automatica</option>
            </select>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input className={inputClass} value={String(draftConfig.meetingTitle || '')} onChange={(event) => updateConfig('meetingTitle', event.target.value)} placeholder="Titulo de la reunion" />
              <input className={inputClass} value={String(draftConfig.meetingType || '')} onChange={(event) => updateConfig('meetingType', event.target.value)} placeholder="Tipo" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <select className={inputClass} value={String(draftConfig.defaultTeamId || '')} onChange={(event) => { updateConfig('defaultTeamId', event.target.value); updateConfig('defaultProjectId', ''); }}>
                <option value="">Sin team</option>
                {teams.map((team) => <option key={team.team_id} value={team.team_id}>{team.name}</option>)}
              </select>
              <select className={inputClass} value={String(draftConfig.defaultProjectId || '')} onChange={(event) => updateConfig('defaultProjectId', event.target.value)}>
                <option value="">Sin proyecto</option>
                {getProjectsForTeam(String(draftConfig.defaultTeamId || '')).map((project) => (
                  <option key={project.project_id} value={project.project_id}>{project.project_name}</option>
                ))}
              </select>
            </div>
            {mode === 'prep' && (
              <>
                <input className={inputClass} type="date" value={String(draftConfig.targetDate || '')} onChange={(event) => updateConfig('targetDate', event.target.value)} />
                <select className={inputClass} value={String(draftConfig.gchatSpace || '')} onChange={(event) => updateConfig('gchatSpace', event.target.value)}>
                  <option value="">Sin Google Chat</option>
                  {gchatSpaces.map((space) => <option key={space.name} value={space.name}>{space.displayName || space.name}</option>)}
                </select>
              </>
            )}
            {mode === 'manual' && (
              <textarea className={textareaClass} value={String(draftConfig.manualText || '')} onChange={(event) => updateConfig('manualText', event.target.value)} placeholder="Pega aqui las notas, tareas y decisiones..." />
            )}
            {mode === 'drive' && (
              <input className={inputClass} value={String(draftConfig.driveRef || '')} onChange={(event) => updateConfig('driveRef', event.target.value)} placeholder="Link o ID de Google Drive" />
            )}
            {mode === 'auto' && (
              <div className="rounded-xl border border-dashed border-accent/20 bg-accent/5 px-4 py-3 text-xs text-accent">
                La deteccion automatica corre en segundo plano. Aqui puedes revisar sus capacidades y casos detectados.
              </div>
            )}
          </div>
        );
      case 'drive':
        return (
          <div className="space-y-3">
            <input className={inputClass} value={String(draftConfig.projectName || '')} onChange={(event) => updateConfig('projectName', event.target.value)} placeholder="Nombre del proyecto o cliente" />
            <input className={inputClass} value={String(draftConfig.parentFolderId || '')} onChange={(event) => updateConfig('parentFolderId', event.target.value)} placeholder="Carpeta padre opcional" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <select className={inputClass} value={String(draftConfig.folderPreset || 'cliente_estandar')} onChange={(event) => updateConfig('folderPreset', event.target.value)}>
                <option value="cliente_estandar">Cliente estandar</option>
                <option value="proyecto_simple">Proyecto simple</option>
                <option value="operacion">Operacion</option>
              </select>
              <select className={inputClass} value={String(draftConfig.gchatSpace || '')} onChange={(event) => updateConfig('gchatSpace', event.target.value)}>
                <option value="">Sin Google Chat</option>
                {gchatSpaces.map((space) => <option key={space.name} value={space.name}>{space.displayName || space.name}</option>)}
              </select>
            </div>
          </div>
        );
      case 'actualizacion_equipo':
        return (
          <div className="space-y-3">
            <select className={inputClass} value={String(draftConfig.spaceName || '')} onChange={(event) => updateConfig('spaceName', event.target.value)}>
              <option value="">Selecciona un espacio</option>
              {gchatSpaces.map((space) => <option key={space.name} value={space.name}>{space.displayName || space.name}</option>)}
            </select>
            <textarea className={textareaClass} value={String(draftConfig.context || '')} onChange={(event) => updateConfig('context', event.target.value)} placeholder="Contexto para la actualizacion..." />
            <input className={inputClass} value={String(draftConfig.tone || '')} onChange={(event) => updateConfig('tone', event.target.value)} placeholder="Tono" />
          </div>
        );
      case 'pc':
        return (
          <div className="space-y-3">
            <textarea className={textareaClass} value={String(draftConfig.objective || '')} onChange={(event) => updateConfig('objective', event.target.value)} placeholder="Describe la accion operativa..." />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <select className={inputClass} value={String(draftConfig.backend || 'auto')} onChange={(event) => updateConfig('backend', event.target.value)}>
                <option value="auto">Auto</option>
                <option value="browser">Browser</option>
                <option value="desktop">Desktop visual</option>
                <option value="uia">Windows UIA</option>
              </select>
              <input className={inputClass} value={String(draftConfig.startUrl || '')} onChange={(event) => updateConfig('startUrl', event.target.value)} placeholder="URL inicial opcional" />
            </div>
          </div>
        );
      default:
        return null;
    }
  }

  function renderCaseDetail(detail: WorkflowCaseDetail): React.ReactNode {
    const meetingDetail = detail.meetingDetail;
    const hasDraftActions = meetingDetail?.sync_actions.some((action) => action.approval_state === 'draft') || false;
    const hasApprovedActions = meetingDetail?.sync_actions.some((action) => action.approval_state === 'approved' && action.sync_state !== 'synced') || false;

    return (
      <div className="space-y-4">
        <div className="bg-white dark:bg-[#1a1c20]/50 backdrop-blur-sm border border-gray-200 dark:border-white/10 rounded-2xl p-5 shadow-sm dark:shadow-lg">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="min-w-0 flex-1">
              <p className="text-base font-bold text-gray-900 dark:text-white tracking-tight">{detail.title}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{detail.summary || 'Sin resumen.'}</p>
            </div>
            <Badge value={detail.normalizedStatus} />
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-gray-400 dark:text-gray-500">
            <span>Caso: <span className="font-mono">{detail.id}</span></span>
            <span>Workflow: {detail.workflowName}</span>
            <span>{formatDateTime(detail.updatedAt)}</span>
          </div>
          {detail.reasons.length > 0 && (
            <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/8 p-4 space-y-1">
              {detail.reasons.map((reason, index) => (
                <div key={`${reason}-${index}`} className="text-xs text-amber-700 dark:text-amber-200">{reason}</div>
              ))}
            </div>
          )}
          {Object.keys(detail.preview || {}).length > 0 && (
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {Object.entries(detail.preview || {}).map(([key, value]) => (
                <div key={key} className="rounded-lg border border-gray-100 dark:border-white/[0.05] bg-gray-50 dark:bg-black/10 px-3 py-2">
                  <p className="text-[9px] uppercase tracking-wider text-gray-500 dark:text-gray-500 truncate">{prettyValue(key)}</p>
                  <p className="mt-1 text-[12px] text-gray-800 dark:text-gray-200 line-clamp-3 break-words">{previewValue(value)}</p>
                </div>
              ))}
            </div>
          )}
          {(detail.normalizedStatus === 'pending_approval' || meetingDetail) && (
            <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/8 p-4 space-y-3">
              <textarea className={textareaClass} value={decisionComment} onChange={(event) => setDecisionComment(event.target.value)} placeholder="Comentario opcional" />
              <div className="flex flex-wrap gap-2">
                {detail.engine === 'automation' && detail.normalizedStatus === 'pending_approval' && (
                  <>
                    <button type="button" className="rounded-xl bg-accent hover:bg-accent/90 text-white px-4 py-2 text-sm font-semibold transition disabled:opacity-40"
                      onClick={() => void runAction('approve-case', async () => {
                        const result = await approveWorkflowCase({ caseId: detail.id, decidedBy: userId, scope: 'case', comment: decisionComment.trim() || null });
                        if (!result.success || !result.detail) throw new Error(result.error || 'No pude aprobar el caso.');
                        setDecisionComment('');
                        await refreshOverview(true, result.detail.id);
                        setSelectedCaseDetail(result.detail);
                        setNotice(`Caso aprobado: ${result.detail.title}.`);
                      })}
                      disabled={actionKey === 'approve-case'}>
                      {actionKey === 'approve-case' ? 'Aprobando...' : 'Aprobar'}
                    </button>
                    <button type="button" className="rounded-xl border border-red-500/20 bg-red-500/8 hover:bg-red-500/12 text-red-600 dark:text-red-300 px-4 py-2 text-sm font-semibold transition disabled:opacity-40"
                      onClick={() => void runAction('reject-case', async () => {
                        const result = await rejectWorkflowCase({ caseId: detail.id, decidedBy: userId, scope: 'case', comment: decisionComment.trim() || null });
                        if (!result.success || !result.detail) throw new Error(result.error || 'No pude rechazar el caso.');
                        setDecisionComment('');
                        await refreshOverview(true, result.detail.id);
                        setSelectedCaseDetail(result.detail);
                        setNotice(`Caso rechazado: ${result.detail.title}.`);
                      })}
                      disabled={actionKey === 'reject-case'}>
                      {actionKey === 'reject-case' ? 'Rechazando...' : 'No aprobar'}
                    </button>
                  </>
                )}
                {meetingDetail && (
                  <>
                    <button type="button" className="rounded-xl bg-accent hover:bg-accent/90 text-white px-4 py-2 text-sm font-semibold transition disabled:opacity-40"
                      onClick={() => void runAction('approve-summary', async () => {
                        const result = await approveWorkflowCase({ caseId: detail.id, decidedBy: userId, scope: 'summary', comment: decisionComment.trim() || null });
                        if (!result.success || !result.detail) throw new Error(result.error || 'No pude aprobar el resumen.');
                        await refreshOverview(true, result.detail.id);
                        setSelectedCaseDetail(result.detail);
                        setNotice('Resumen aprobado.');
                      })}
                      disabled={actionKey === 'approve-summary'}>
                      {actionKey === 'approve-summary' ? 'Aprobando...' : 'Aprobar resumen'}
                    </button>
                    {hasDraftActions && (
                      <button type="button" className="rounded-xl border border-accent/20 bg-accent/10 hover:bg-accent/15 text-accent px-4 py-2 text-sm font-semibold transition disabled:opacity-40"
                        onClick={() => void runAction('approve-actions', async () => {
                          const result = await approveWorkflowCase({ caseId: detail.id, decidedBy: userId, scope: 'actions', comment: decisionComment.trim() || null });
                          if (!result.success || !result.detail) throw new Error(result.error || 'No pude aprobar las acciones.');
                          await refreshOverview(true, result.detail.id);
                          setSelectedCaseDetail(result.detail);
                          setNotice('Acciones aprobadas.');
                        })}
                        disabled={actionKey === 'approve-actions'}>
                        {actionKey === 'approve-actions' ? 'Aprobando...' : 'Aprobar acciones'}
                      </button>
                    )}
                    {hasApprovedActions && (
                      <button type="button" className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 hover:bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 px-4 py-2 text-sm font-semibold transition disabled:opacity-40"
                        onClick={() => void runAction('sync-actions', async () => {
                          const result = await syncWorkflowCase({ caseId: detail.id, decidedBy: userId });
                          if (!result.success || !result.detail) throw new Error(result.error || 'No pude sincronizar.');
                          await refreshOverview(true, result.detail.id);
                          setSelectedCaseDetail(result.detail);
                          setNotice('Sincronizacion completada.');
                        })}
                        disabled={actionKey === 'sync-actions'}>
                        {actionKey === 'sync-actions' ? 'Sincronizando...' : 'Sincronizar'}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {meetingDetail && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white dark:bg-[#1a1c20]/50 border border-gray-200 dark:border-white/10 p-5 shadow-sm dark:shadow-lg">
              <div className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">Resumen ejecutivo</div>
              <p className="text-[13px] leading-relaxed text-gray-600 dark:text-gray-300">{meetingDetail.latest_asset?.executive_summary || 'Sin resumen ejecutivo.'}</p>
            </div>
            <div className="rounded-2xl bg-white dark:bg-[#1a1c20]/50 border border-gray-200 dark:border-white/10 p-5 shadow-sm dark:shadow-lg">
              <div className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">Resumen operativo</div>
              <p className="text-[13px] leading-relaxed text-gray-600 dark:text-gray-300">{meetingDetail.latest_asset?.operational_summary || 'Sin resumen operativo.'}</p>
            </div>
          </div>
        )}

        {currentAnalysis && currentAnalysis.keyPoints.length > 0 && (
          <div className="rounded-2xl bg-white dark:bg-[#1a1c20]/50 border border-gray-200 dark:border-white/10 p-5 shadow-sm dark:shadow-lg">
            <p className="text-sm font-bold text-gray-900 dark:text-white mb-3">Puntos clave</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {currentAnalysis.keyPoints.map((point, index) => (
                <div key={`${point}-${index}`} className="flex items-start gap-2 text-[12px] text-gray-600 dark:text-gray-300">
                  <span className="mt-1.5 w-1 h-1 rounded-full bg-accent/60 shrink-0" />
                  {point}
                </div>
              ))}
            </div>
          </div>
        )}

        {meetingDetail && (
          <div className="rounded-2xl bg-white dark:bg-[#1a1c20]/50 border border-gray-200 dark:border-white/10 p-5 shadow-sm dark:shadow-lg">
            <p className="text-sm font-bold text-gray-900 dark:text-white mb-3">Acciones propuestas</p>
            <div className="space-y-3">
              {meetingDetail.sync_actions.length === 0 && <EmptyState text="Sin acciones propuestas" />}
              {meetingDetail.sync_actions.map((action) => {
                const draft = actionDrafts[action.id] || {
                  title: action.payload.title || action.summary || '',
                  dueDate: action.payload.due_date || '',
                  teamId: action.payload.team_id || '',
                  projectId: action.payload.project_id || '',
                  assigneeId: action.payload.assignee_id || '',
                };
                return (
                  <div key={action.id} className="rounded-xl bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/[0.04] p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] text-gray-700 dark:text-gray-200 leading-snug">{action.summary}</div>
                        <div className="mt-1 text-[10px] text-gray-500 dark:text-gray-400">{action.action_type} · {action.approval_state} · {action.sync_state}</div>
                      </div>
                      <Badge value={action.error_message ? 'failed' : action.sync_state === 'synced' ? 'executed' : action.approval_state === 'approved' ? 'approved' : action.approval_state === 'rejected' ? 'skipped' : 'pending'} />
                    </div>
                    <input className={inputClass} value={draft.title} onChange={(event) => setActionDrafts((current) => ({ ...current, [action.id]: { ...draft, title: event.target.value } }))} placeholder="Titulo" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <select className={inputClass} value={draft.teamId} onChange={(event) => setActionDrafts((current) => ({ ...current, [action.id]: { ...draft, teamId: event.target.value, projectId: '', assigneeId: '' } }))}>
                        <option value="">Sin team</option>
                        {teams.map((team) => <option key={team.team_id} value={team.team_id}>{team.name}</option>)}
                      </select>
                      <select className={inputClass} value={draft.projectId} onChange={(event) => setActionDrafts((current) => ({ ...current, [action.id]: { ...draft, projectId: event.target.value } }))}>
                        <option value="">Sin proyecto</option>
                        {getProjectsForTeam(draft.teamId).map((project) => <option key={project.project_id} value={project.project_id}>{project.project_name}</option>)}
                      </select>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <select className={inputClass} value={draft.assigneeId} onChange={(event) => setActionDrafts((current) => ({ ...current, [action.id]: { ...draft, assigneeId: event.target.value } }))}>
                        <option value="">Sin responsable</option>
                        {getMembersForTeam(draft.teamId).map((member) => (
                          <option key={member.membership_id} value={member.user_id}>{member.display_name || member.username || member.email || member.user_id}</option>
                        ))}
                      </select>
                      <input type="date" className={inputClass} value={draft.dueDate} onChange={(event) => setActionDrafts((current) => ({ ...current, [action.id]: { ...draft, dueDate: event.target.value } }))} />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className="rounded-xl border border-gray-200 dark:border-white/[0.06] py-1.5 px-3 text-[11px] text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition"
                        onClick={() => void runAction(`save-action-${action.id}`, async () => {
                          const result = await updateWorkflowCaseAction({ caseId: detail.id, actionId: action.id, updates: { title: draft.title, due_date: draft.dueDate || null, team_id: draft.teamId || null, project_id: draft.projectId || null, assignee_id: draft.assigneeId || null } });
                          if (!result.success || !result.detail) throw new Error(result.error || 'No pude guardar la accion.');
                          await refreshOverview(true, result.detail.id);
                          setSelectedCaseDetail(result.detail);
                          setNotice('Accion actualizada.');
                        })}
                        disabled={actionKey === `save-action-${action.id}`}>
                        {actionKey === `save-action-${action.id}` ? 'Guardando...' : 'Guardar'}
                      </button>
                      {action.approval_state !== 'approved' && action.approval_state !== 'rejected' && (
                        <button type="button" className="rounded-xl border border-accent/20 bg-accent/10 hover:bg-accent/15 text-accent py-1.5 px-3 text-[11px] font-semibold transition"
                          onClick={() => void runAction(`approve-single-${action.id}`, async () => {
                            const result = await approveWorkflowCase({ caseId: detail.id, decidedBy: userId, scope: 'action', actionId: action.id, comment: decisionComment.trim() || null });
                            if (!result.success || !result.detail) throw new Error(result.error || 'No pude aprobar la accion.');
                            await refreshOverview(true, result.detail.id);
                            setSelectedCaseDetail(result.detail);
                            setNotice('Accion aprobada.');
                          })}
                          disabled={actionKey === `approve-single-${action.id}`}>
                          {actionKey === `approve-single-${action.id}` ? 'Aprobando...' : 'Aprobar'}
                        </button>
                      )}
                      {action.approval_state !== 'rejected' && (
                        <button type="button" className="rounded-xl border border-red-500/20 bg-red-500/8 hover:bg-red-500/12 text-red-600 dark:text-red-300 py-1.5 px-3 text-[11px] font-semibold transition"
                          onClick={() => void runAction(`reject-single-${action.id}`, async () => {
                            const result = await rejectWorkflowCase({ caseId: detail.id, decidedBy: userId, scope: 'action', actionId: action.id, comment: decisionComment.trim() || null });
                            if (!result.success || !result.detail) throw new Error(result.error || 'No pude rechazar la accion.');
                            await refreshOverview(true, result.detail.id);
                            setSelectedCaseDetail(result.detail);
                            setNotice('Accion rechazada.');
                          })}
                          disabled={actionKey === `reject-single-${action.id}`}>
                          {actionKey === `reject-single-${action.id}` ? 'Rechazando...' : 'Rechazar'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (!hubAvailable) {
    return (
      <div className="h-full flex items-center justify-center p-10">
        <div className="max-w-md rounded-3xl border border-dashed border-gray-300 dark:border-white/[0.08] px-8 py-10 text-center bg-white/60 dark:bg-white/[0.02]">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Workflow Hub no disponible</h3>
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-500">
            Este panel necesita el bridge nuevo de workflows dentro de Electron.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="shrink-0 px-6 py-5 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">Asistente Ejecutivo</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Workflows predeterminados, variantes y casos en una sola vista</p>
        </div>
        <button type="button" className="p-2.5 rounded-xl bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-white/10 transition-all"
          onClick={() => void refreshOverview(true)} title="Recargar">
          <svg className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {(error || notice) && (
        <div className="shrink-0 px-6 pb-2 space-y-2">
          {error && <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-xs text-red-600 dark:text-red-300">{error}</div>}
          {notice && <div className="rounded-xl border border-accent/20 bg-accent/10 px-4 py-2.5 text-xs text-accent">{notice}</div>}
        </div>
      )}

      <div className="flex-1 overflow-y-auto no-scrollbar">
        <section className="px-6 pt-2 pb-5 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
            {(overview?.capabilities || []).map((capability) => (
              <div key={capability.key} className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1a1c20]/50 p-4 shadow-sm dark:shadow-lg">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="text-[12px] font-semibold text-gray-900 dark:text-white">{capability.label}</p>
                  <Badge value={capability.state} />
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">{capability.message}</p>
                {capability.guidance && <p className="mt-2 text-[11px] text-accent leading-relaxed">{capability.guidance}</p>}
              </div>
            ))}
          </div>

          {overview && overview.legacyCustomTemplates.length > 0 && (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/8 px-5 py-4 text-xs text-amber-700 dark:text-amber-200">
              Detecte {overview.legacyCustomTemplates.length} flujo(s) personalizados legacy. Se conservan en storage, pero ahora se crean variantes sobre workflows predeterminados.
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-5">
            <div className="space-y-4">
              <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1a1c20]/50 p-5 shadow-sm dark:shadow-lg">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <p className="text-sm font-bold text-gray-900 dark:text-white">Pasivos</p>
                  <span className="text-[10px] uppercase tracking-[0.16em] text-gray-400 dark:text-gray-500">Se ejecutan solos</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {passiveCapableWorkflows.map((workflow) => (
                    <button key={workflow.id} type="button" onClick={() => { setSelectedWorkflowId(workflow.id); setSelectedVariantId(null); }}
                      className={`rounded-2xl border text-left px-4 py-4 transition-all ${
                        selectedWorkflowId === workflow.id
                          ? 'border-accent/30 bg-accent/8 shadow-md ring-1 ring-accent/10'
                          : 'border-gray-200 dark:border-white/[0.06] hover:border-accent/20 bg-gray-50 dark:bg-white/[0.02]'
                      }`}>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-bold text-gray-900 dark:text-white">{workflow.name}</p>
                        <Badge value={workflow.passiveBehavior === 'system' ? 'system' : 'active'} />
                      </div>
                      <p className="mt-1 text-[12px] text-gray-500 dark:text-gray-400 leading-relaxed">{workflow.summary}</p>
                      <p className="mt-2 text-[10px] text-accent">{workflow.passiveBehavior === 'system' ? 'Pasivo de sistema' : 'Pasivo programable'}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1a1c20]/50 p-5 shadow-sm dark:shadow-lg">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <p className="text-sm font-bold text-gray-900 dark:text-white">Rutinas guardadas</p>
                  <span className="text-[10px] uppercase tracking-[0.16em] text-gray-400 dark:text-gray-500">{passiveRules.length}</span>
                </div>
                <div className="space-y-2">
                  {passiveRules.length === 0 && <EmptyState text="Sin workflows pasivos guardados" />}
                  {passiveRules.map((rule) => (
                    <div key={rule.id} className="rounded-xl border border-gray-200 dark:border-white/[0.06] bg-gray-50 dark:bg-white/[0.02] px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-[12px] font-semibold text-gray-900 dark:text-white">{rule.name}</p>
                            <Badge value={rule.status} />
                          </div>
                          <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">{rule.description}</p>
                          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-gray-400 dark:text-gray-500">
                            <span>{rule.workflowName}</span>
                            <span>{rule.scheduleLabel}</span>
                            {rule.lastRunAt && <span>Ultima: {formatDateTime(rule.lastRunAt)}</span>}
                          </div>
                          {rule.reason && <p className="mt-2 text-[11px] text-amber-600 dark:text-amber-300">{rule.reason}</p>}
                        </div>
                        {rule.source !== 'system' && (
                          <button
                            type="button"
                            className="rounded-xl border border-red-500/20 bg-red-500/8 hover:bg-red-500/12 text-red-600 dark:text-red-300 px-3 py-1.5 text-[11px] font-semibold transition disabled:opacity-40"
                            onClick={() => void runAction(`delete-passive-${rule.id}`, async () => {
                              const result = await deletePassiveWorkflowRule(rule.id);
                              if (!result.success || !result.deleted) throw new Error(result.error || 'No pude eliminar el workflow pasivo.');
                              await refreshOverview(true, selectedCaseId || undefined);
                              setNotice(`Workflow pasivo eliminado: ${rule.name}.`);
                            })}
                            disabled={actionKey === `delete-passive-${rule.id}`}>
                            {actionKey === `delete-passive-${rule.id}` ? 'Eliminando...' : 'Eliminar'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1a1c20]/50 p-5 shadow-sm dark:shadow-lg">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <p className="text-sm font-bold text-gray-900 dark:text-white">Activacion</p>
                  <span className="text-[10px] uppercase tracking-[0.16em] text-gray-400 dark:text-gray-500">Se lanzan al pedirlos</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {activationCapableWorkflows.map((workflow) => (
                    <button key={workflow.id} type="button" onClick={() => { setSelectedWorkflowId(workflow.id); setSelectedVariantId(null); }}
                      className={`rounded-2xl border text-left px-4 py-4 transition-all ${
                        selectedWorkflowId === workflow.id
                          ? 'border-accent/30 bg-accent/8 shadow-md ring-1 ring-accent/10'
                          : 'border-gray-200 dark:border-white/[0.06] hover:border-accent/20 bg-gray-50 dark:bg-white/[0.02]'
                      }`}>
                      <p className="text-sm font-bold text-gray-900 dark:text-white">{workflow.name}</p>
                      <p className="mt-1 text-[12px] text-gray-500 dark:text-gray-400 leading-relaxed">{workflow.summary}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1a1c20]/50 p-5 shadow-sm dark:shadow-lg">
                <p className="text-sm font-bold text-gray-900 dark:text-white mb-3">Variantes</p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setSelectedVariantId(null)}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-semibold border transition ${
                      !selectedVariant ? 'border-accent/30 bg-accent/10 text-accent' : 'border-gray-200 dark:border-white/[0.06] text-gray-500 dark:text-gray-400'
                    }`}>
                    Base
                  </button>
                  {workflowVariants.map((variant) => (
                    <button key={variant.id} type="button" onClick={() => setSelectedVariantId(variant.id)}
                      className={`px-3 py-1.5 rounded-full text-[11px] font-semibold border transition ${
                        selectedVariantId === variant.id ? 'border-accent/30 bg-accent/10 text-accent' : 'border-gray-200 dark:border-white/[0.06] text-gray-500 dark:text-gray-400'
                      }`}>
                      {variant.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1a1c20]/50 p-5 shadow-sm dark:shadow-lg space-y-4">
              <div>
                <p className="text-sm font-bold text-gray-900 dark:text-white">{selectedWorkflow?.name || 'Workflow'}</p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{selectedVariant ? `Editando variante: ${selectedVariant.name}` : selectedWorkflow?.description}</p>
              </div>
              {selectedWorkflow?.triggerModes.includes('passive') && (
                <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/8 p-4 space-y-3">
                  <div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">Workflow pasivo</p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {selectedWorkflow.passiveBehavior === 'system'
                        ? 'Este flujo corre solo en segundo plano y se refleja en la bandeja de casos.'
                        : 'Programa este flujo para que se ejecute sin comando y quede recordado por el sistema.'}
                    </p>
                  </div>

                  {selectedWorkflow.passiveBehavior === 'system' ? (
                    <div className="rounded-xl border border-cyan-500/20 bg-white/70 dark:bg-black/10 px-4 py-3 text-xs text-cyan-700 dark:text-cyan-200">
                      Reuniones ya funciona como workflow pasivo de sistema. SofLIA revisa Calendar, Gmail y Drive para detectar reuniones y correr el flujo completo automaticamente.
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          className={inputClass}
                          value={passiveRuleName}
                          onChange={(event) => setPassiveRuleName(event.target.value)}
                          placeholder="Nombre del workflow pasivo"
                        />
                        <select
                          className={inputClass}
                          value={scheduleFrequency}
                          onChange={(event) => setScheduleFrequency(event.target.value as PassiveScheduleFrequency)}>
                          <option value="daily">Todos los dias</option>
                          <option value="weekdays">Lunes a viernes</option>
                          <option value="weekly">Semanal</option>
                        </select>
                      </div>
                      <textarea
                        className={textareaClass}
                        value={passiveRuleDescription}
                        onChange={(event) => setPassiveRuleDescription(event.target.value)}
                        placeholder="Descripcion corta"
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          className={inputClass}
                          type="time"
                          value={scheduleTime}
                          onChange={(event) => setScheduleTime(event.target.value)}
                        />
                        {scheduleFrequency === 'weekly' ? (
                          <select className={inputClass} value={scheduleWeekday} onChange={(event) => setScheduleWeekday(event.target.value)}>
                            <option value="1">Lunes</option>
                            <option value="2">Martes</option>
                            <option value="3">Miercoles</option>
                            <option value="4">Jueves</option>
                            <option value="5">Viernes</option>
                            <option value="6">Sabado</option>
                            <option value="0">Domingo</option>
                          </select>
                        ) : (
                          <div className="rounded-xl border border-gray-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.03] px-3 py-2 text-[13px] text-gray-500 dark:text-gray-400">
                            {describeSchedule(scheduleFrequency, scheduleTime, scheduleWeekday)}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        className="w-full rounded-xl border border-cyan-500/20 bg-cyan-500/10 hover:bg-cyan-500/15 text-cyan-700 dark:text-cyan-200 py-2.5 text-sm font-semibold transition disabled:opacity-40"
                        onClick={() => void runAction('save-passive-workflow', async () => {
                          if (!selectedWorkflow) throw new Error('Selecciona un workflow.');
                          await persistPassiveWorkflow({
                            workflowId: selectedWorkflow.id,
                            executionMode: 'workflow',
                          });
                        })}
                        disabled={actionKey === 'save-passive-workflow'}>
                        {actionKey === 'save-passive-workflow' ? 'Guardando...' : 'Guardar como workflow pasivo'}
                      </button>
                    </>
                  )}
                </div>
              )}
              {selectedWorkflow && renderWorkflowForm(selectedWorkflow)}
              <div className="rounded-2xl border border-gray-200 dark:border-white/[0.06] bg-gray-50 dark:bg-white/[0.02] p-4 space-y-3">
                <input className={inputClass} value={variantName} onChange={(event) => setVariantName(event.target.value)} placeholder="Nombre de la variante" />
                <textarea className={textareaClass} value={variantDescription} onChange={(event) => setVariantDescription(event.target.value)} placeholder="Descripcion corta" />
                <div className="flex gap-2">
                  <button type="button" className="flex-1 rounded-xl bg-accent hover:bg-accent/90 text-white py-2.5 text-sm font-semibold transition disabled:opacity-40"
                    onClick={() => void runAction('execute-workflow', async () => {
                      if (!selectedWorkflow) throw new Error('Selecciona un workflow.');
                      const result = await executeWorkflowHub({ workflowId: selectedVariant ? undefined : selectedWorkflow.id, variantId: selectedVariant?.id, requestedBy: `app:${userId}`, input: draftConfig });
                      if (!result.success || !result.detail) throw new Error(result.error || 'No pude ejecutar el workflow.');
                      await refreshOverview(true, result.detail.id);
                      setSelectedCaseDetail(result.detail);
                      setSelectedCaseId(result.detail.id);
                      setNotice(`Caso creado: ${result.detail.title}.`);
                    })}
                    disabled={actionKey === 'execute-workflow' || !selectedWorkflow}>
                    {actionKey === 'execute-workflow' ? 'Ejecutando...' : 'Ejecutar workflow'}
                  </button>
                  <button type="button" className="flex-1 rounded-xl border border-accent/20 bg-accent/10 hover:bg-accent/15 text-accent py-2.5 text-sm font-semibold transition disabled:opacity-40"
                    onClick={() => void runAction('save-variant', async () => {
                      if (!selectedWorkflow) throw new Error('Selecciona un workflow.');
                      if (!variantName.trim()) throw new Error('Escribe un nombre para la variante.');
                      const result = await saveWorkflowVariant({ variantId: selectedVariant?.id || null, workflowId: selectedWorkflow.id, name: variantName.trim(), description: variantDescription.trim() || null, config: draftConfig, createdBy: userId });
                      if (!result.success || !result.variant) throw new Error(result.error || 'No pude guardar la variante.');
                      setSelectedVariantId(result.variant.id);
                      await refreshOverview(true, selectedCaseId || undefined);
                      setNotice(selectedVariant ? 'Variante actualizada.' : 'Variante guardada.');
                    })}
                    disabled={actionKey === 'save-variant' || !selectedWorkflow}>
                    {actionKey === 'save-variant' ? 'Guardando...' : selectedVariant ? 'Actualizar variante' : 'Guardar variante'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="px-6 pb-6 border-t border-gray-200 dark:border-white/[0.05] pt-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-bold text-gray-900 dark:text-white">Casos</p>
            {overview && overview.cases.filter((item) => item.normalizedStatus === 'pending_approval').length > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/20">
                {overview.cases.filter((item) => item.normalizedStatus === 'pending_approval').length} pendientes
              </span>
            )}
          </div>
          {(overview?.cases || []).length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 dark:border-white/[0.06] px-4 py-10 text-center text-xs text-gray-500 dark:text-gray-500">
              Sin casos aun. Ejecuta un workflow arriba para crear el primero.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {(overview?.cases || []).map((item) => (
                  <button key={item.id} type="button" onClick={() => setSelectedCaseId(selectedCaseId === item.id ? null : item.id)}
                    className={`w-full text-left rounded-xl border px-4 py-3 transition-all ${
                      selectedCaseId === item.id ? 'border-accent/30 bg-accent/8 shadow-md ring-1 ring-accent/10' : 'border-gray-200 dark:border-white/[0.06] hover:border-accent/20 bg-white dark:bg-white/[0.02]'
                    }`}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[12px] font-semibold text-gray-900 dark:text-white line-clamp-2 flex-1">{item.title}</p>
                      <Badge value={item.normalizedStatus} />
                    </div>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1.5 truncate">{item.workflowName} · {formatDateTime(item.updatedAt)}</p>
                  </button>
                ))}
              </div>
              {selectedCaseDetail && renderCaseDetail(selectedCaseDetail)}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
