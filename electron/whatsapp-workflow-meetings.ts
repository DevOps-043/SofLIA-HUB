import type { MeetingWorkflowService } from './meetings/meeting-workflow-service';
import type { MeetingRunDetail, UpdateMeetingActionInput } from './meetings/meeting-types';
import type { WhatsAppService } from './whatsapp-service';

const WORKFLOW_TIMEOUT_MS = 5 * 60 * 1000;
const CANCEL_WORKFLOW_PATTERN = /\b(cancelar|cancela(?:r)?|cerrar|salir|detener|rechazar|rechaza(?:r)?|no aprobar|no apruebo)\b/i;
const REJECT_WORKFLOW_PATTERN = /\b(rechazar|rechaza(?:r)?|no aprobar|no apruebo)\b/i;

interface MeetingRunIntroMessageOptions {
  fallbackTitle?: string | null;
  busy?: boolean;
}

export function buildMeetingRunIntroMessage(
  detail: MeetingRunDetail,
  options: MeetingRunIntroMessageOptions = {},
): string {
  const title = resolveMeetingTitle(detail, options.fallbackTitle);
  const typeLabel = resolveMeetingTypeLabel(detail);
  const contextLine = buildContextLine(detail);
  const focusLine = buildFocusLine(detail);
  const promptPreview = buildPromptPreview(detail);
  const summary = truncateText(getMeetingExecutiveSummary(detail), 360);
  const lines = options.busy
    ? [
        'Detecte otra reunion mientras tu workflow actual sigue abierto.',
        'La deje lista para que la revises despues.',
      ]
    : [
        'Detecte una reunion nueva y ya prepare un brief para revisarla contigo.',
        'Antes de sincronizar nada, quiero que valides el enfoque.',
      ];

  lines.push('');
  lines.push(`Reunion: ${title}`);
  lines.push(`Tipo detectado: ${typeLabel}`);
  if (contextLine) {
    lines.push(`Contexto: ${contextLine}`);
  }
  if (focusLine) {
    lines.push(`Enfoque: ${focusLine}`);
  }

  if (promptPreview.length > 0) {
    lines.push('');
    lines.push('Prompt operativo generado:');
    for (const line of promptPreview) {
      lines.push(`- ${line}`);
    }
  }

  if (summary) {
    lines.push('');
    lines.push(`Resumen inicial: ${summary}`);
  }

  lines.push('');
  if (options.busy) {
    lines.push('Cuando cierres el workflow actual, revisala desde la app en Meetings.');
  } else {
    lines.push('Si este encuadre si representa la reunion, responde "aprobar resumen".');
    lines.push('Si quieres revisar el detalle antes, responde "estado" o "acciones".');
    lines.push('Si no te convence, responde "rechazar" o "cancelar".');
  }
  lines.push(`Ref: ${detail.run.id}`);

  return lines.join('\n');
}

function resolveMeetingTitle(detail: MeetingRunDetail, fallbackTitle?: string | null): string {
  return detail.run.meeting_title
    || detail.latest_asset?.payload.meeting_title
    || fallbackTitle
    || 'Sin titulo';
}

function resolveMeetingTypeLabel(detail: MeetingRunDetail): string {
  const analysis = detail.latest_asset?.payload.analysis_result;
  return analysis?.analysisStrategy.strategyName
    || humanizeToken(analysis?.meetingType.suggestedType)
    || humanizeToken(detail.latest_asset?.payload.meeting_type)
    || humanizeToken(detail.run.meeting_type)
    || 'General';
}

function buildContextLine(detail: MeetingRunDetail): string | null {
  const analysis = detail.latest_asset?.payload.analysis_result;
  const objectives = summarizeList(analysis?.detectedContext.meetingObjective, 2);
  const parts = compactParts([
    analysis?.detectedContext.team ? `equipo ${analysis.detectedContext.team}` : null,
    analysis?.detectedContext.project ? `proyecto ${analysis.detectedContext.project}` : null,
    objectives ? `objetivo ${objectives}` : null,
  ]);
  return parts.length > 0 ? parts.join(' | ') : null;
}

function buildFocusLine(detail: MeetingRunDetail): string | null {
  const analysis = detail.latest_asset?.payload.analysis_result;
  return summarizeList(
    analysis?.analysisStrategy.extractionFocus || analysis?.detectedContext.meetingObjective,
    3,
  );
}

function buildPromptPreview(detail: MeetingRunDetail): string[] {
  const analysis = detail.latest_asset?.payload.analysis_result;
  if (!analysis) {
    const fallbackFocus = buildFocusLine(detail);
    return compactParts([
      fallbackFocus ? `Me enfocare en ${fallbackFocus}.` : null,
    ]);
  }

  const focus = summarizeList(analysis.analysisStrategy.extractionFocus, 3);
  return compactParts([
    `La estoy leyendo como ${resolveMeetingTypeLabel(detail)}.`,
    analysis.analysisStrategy.whyThisStrategy
      ? truncateSentence(stripStrategyPrefix(analysis.analysisStrategy.whyThisStrategy), 180)
      : null,
    focus ? `Voy a priorizar ${focus}.` : null,
  ]);
}

function getMeetingExecutiveSummary(detail: MeetingRunDetail): string {
  return detail.latest_asset?.executive_summary?.trim()
    || detail.latest_asset?.payload.executive_summary?.trim()
    || detail.latest_asset?.operational_summary?.trim()
    || detail.latest_asset?.payload.operational_summary?.trim()
    || 'Sin resumen.';
}

function compactParts(parts: Array<string | null | undefined>): string[] {
  return parts
    .map((part) => String(part || '').trim())
    .filter(Boolean);
}

function summarizeList(values: string[] | null | undefined, limit: number): string | null {
  const normalized = Array.from(new Set(
    (values || [])
      .map((value) => String(value || '').trim())
      .filter(Boolean),
  ));
  if (normalized.length === 0) {
    return null;
  }
  const trimmed = normalized.slice(0, limit);
  const suffix = normalized.length > limit ? '...' : '';
  return `${trimmed.join(', ')}${suffix}`;
}

function humanizeToken(value: string | null | undefined): string | null {
  const normalized = String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) {
    return null;
  }

  return normalized
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function stripStrategyPrefix(value: string): string {
  return value
    .replace(/^estrategia seleccionada por clasificacion como\s+/i, '')
    .replace(/^la estrategia de\s+/i, '')
    .replace(/^clasifique como\s+/i, '')
    .trim();
}

function truncateSentence(value: string, maxLength: number): string {
  const text = truncateText(value, maxLength);
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

function truncateText(value: string | null | undefined, maxLength: number): string {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return '';
  }
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}

class MeetingWhatsAppWorkflow {
  private inactivityTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    public readonly sessionKey: string,
    private readonly jid: string,
    private readonly senderNumber: string,
    private readonly waService: WhatsAppService,
    private readonly workflowService: MeetingWorkflowService,
    private runId: string | null = null,
    private readonly introMessage: string | null = null,
  ) {}

  async start(): Promise<void> {
    this.scheduleInactivityTimeout();

    if (this.runId) {
      const fallbackMessage = await this.buildExistingRunIntroMessage();
      await this.waService.sendText(this.jid, this.introMessage || fallbackMessage);
      return;
    }

    await this.waService.sendText(
      this.jid,
      [
        'Workflow de reuniones iniciado.',
        '',
        'Enviame una de estas dos cosas:',
        '1. Notas de reunion en texto.',
        '2. Un link o ID de Google Drive con la transcripcion o notas.',
        '',
        'Luego podras responder: "estado", "aprobar resumen", "aprobar acciones", "sincronizar", "rechazar" o "cancelar".',
      ].join('\n'),
    );
  }

  async handleInput(text: string): Promise<boolean> {
    const lower = text.trim().toLowerCase();

    try {
      if (this.isCancelRequest(lower)) {
        return this.cancelWorkflow(
          this.isRejectRequest(lower)
            ? 'Workflow de reuniones rechazado. No sincronice nada y deje el run listo para revision manual.'
            : 'Workflow de reuniones cancelado.',
        );
      }

      if (!this.runId) {
        const result = await this.importSource(text);
        this.runId = result.detail.run.id;
        this.scheduleInactivityTimeout();
        await this.waService.sendText(this.jid, this.formatRunDetail(result.detail, result.deduplicated));
        return true;
      }

      if (lower === 'estado') {
        this.scheduleInactivityTimeout();
        const detail = await this.workflowService.getRunDetail(this.runId);
        await this.waService.sendText(this.jid, this.formatStatus(detail));
        return true;
      }

      if (lower === 'acciones') {
        this.scheduleInactivityTimeout();
        const detail = await this.workflowService.getRunDetail(this.runId);
        await this.waService.sendText(this.jid, this.formatActionList(detail));
        return true;
      }

      if (lower === 'aprobar resumen') {
        const detail = await this.workflowService.approveAsset(this.runId, this.senderNumber, 'Aprobado desde WhatsApp');
        const shouldClose = this.shouldCloseWorkflow(detail);
        if (!shouldClose) this.scheduleInactivityTimeout();
        await this.waService.sendText(
          this.jid,
          `Resumen aprobado.\n\n${this.formatStatus(detail)}${shouldClose ? '\n\nWorkflow de reuniones finalizado. Ya puedes volver a preguntarme lo que necesites.' : ''}`,
        );
        return !shouldClose;
      }

      if (lower === 'aprobar acciones') {
        const detail = await this.workflowService.approveActions(
          this.runId,
          this.senderNumber,
          undefined,
          'Acciones aprobadas desde WhatsApp',
        );
        const shouldClose = this.shouldCloseWorkflow(detail);
        if (!shouldClose) this.scheduleInactivityTimeout();
        await this.waService.sendText(
          this.jid,
          `Acciones aprobadas.\n\n${this.formatStatus(detail)}${shouldClose ? '\n\nWorkflow de reuniones finalizado. Ya puedes volver a preguntarme lo que necesites.' : ''}`,
        );
        return !shouldClose;
      }

      const approveSingleMatch = lower.match(/^aprobar accion\s+(\d+)$/);
      if (approveSingleMatch) {
        const action = this.getActionByNumber(await this.workflowService.getRunDetail(this.runId), Number(approveSingleMatch[1]));
        if (!action) {
          this.scheduleInactivityTimeout();
          await this.waService.sendText(this.jid, 'No encontre ese numero de accion.');
          return true;
        }
        const detail = await this.workflowService.approveActions(
          this.runId,
          this.senderNumber,
          [action.id],
          'Accion aprobada desde WhatsApp',
        );
        this.scheduleInactivityTimeout();
        await this.waService.sendText(this.jid, `Accion ${approveSingleMatch[1]} aprobada.\n\n${this.formatActionList(detail)}`);
        return true;
      }

      const editMatch = text.trim().match(/^editar accion\s+(\d+)\s+(.+)$/i);
      if (editMatch) {
        const detail = await this.workflowService.getRunDetail(this.runId);
        const action = this.getActionByNumber(detail, Number(editMatch[1]));
        if (!action) {
          this.scheduleInactivityTimeout();
          await this.waService.sendText(this.jid, 'No encontre ese numero de accion.');
          return true;
        }

        const updates = this.parseActionUpdates(editMatch[2]);
        if (Object.keys(updates).length === 0) {
          this.scheduleInactivityTimeout();
          await this.waService.sendText(
            this.jid,
            'No detecte cambios validos. Usa por ejemplo: editar accion 1 titulo="Preparar minuta" fecha=2026-03-20 team=TEAM_ID proyecto=PROJECT_ID responsable="Juan Perez" assignee=USER_ID',
          );
          return true;
        }

        const updatedDetail = await this.workflowService.updateAction(action.id, updates);
        this.scheduleInactivityTimeout();
        await this.waService.sendText(this.jid, `Accion ${editMatch[1]} actualizada.\n\n${this.formatActionList(updatedDetail)}`);
        return true;
      }

      if (lower === 'sincronizar') {
        const syncResult = await this.workflowService.syncApprovedActions(this.runId, this.senderNumber);
        await this.waService.sendText(this.jid, this.formatSyncResult(syncResult.detail, syncResult.result));
        return false;
      }

      await this.waService.sendText(
        this.jid,
        await this.buildUnknownInstructionMessage(),
      );
      const shouldStayOpen = !this.shouldCloseWorkflow(await this.workflowService.getRunDetail(this.runId));
      if (shouldStayOpen) this.scheduleInactivityTimeout();
      return shouldStayOpen;
    } catch (error: any) {
      this.scheduleInactivityTimeout();
      await this.waService.sendText(this.jid, `No pude completar la accion: ${error?.message || String(error)}`);
      return true;
    }
  }

  dispose(): void {
    this.clearInactivityTimer();
  }

  private isCancelRequest(text: string): boolean {
    return CANCEL_WORKFLOW_PATTERN.test(text.trim());
  }

  private isRejectRequest(text: string): boolean {
    return REJECT_WORKFLOW_PATTERN.test(text.trim());
  }

  private async buildExistingRunIntroMessage(): Promise<string> {
    if (!this.runId) {
      return 'No pude preparar el resumen inicial de la reunion.';
    }

    try {
      const detail = await this.workflowService.getRunDetail(this.runId);
      return buildMeetingRunIntroMessage(detail);
    } catch (error) {
      console.warn('[MeetingWhatsAppWorkflow] Could not build intro message for existing run:', error);
      return [
        'Detecte una reunion nueva y ya cargue la transcripcion.',
        `Ref: ${this.runId}`,
        'Responde "estado", "acciones", "aprobar resumen", "rechazar" o "cancelar".',
      ].join('\n');
    }
  }

  private scheduleInactivityTimeout(): void {
    this.clearInactivityTimer();
    this.inactivityTimer = setTimeout(() => {
      this.handleInactivityTimeout().catch((error) => {
        console.error('[MeetingWhatsAppWorkflow] Error handling inactivity timeout:', error);
      });
    }, WORKFLOW_TIMEOUT_MS);
  }

  private clearInactivityTimer(): void {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }
  }

  private async handleInactivityTimeout(): Promise<void> {
    this.clearInactivityTimer();
    await this.waService.sendText(
      this.jid,
      'Workflow de reuniones cancelado por inactividad despues de 5 minutos. Si quieres retomarlo, inicia /reunion de nuevo.',
    );
    MeetingWorkflowManager.endWorkflow(this.sessionKey);
  }

  private async cancelWorkflow(message: string): Promise<boolean> {
    this.clearInactivityTimer();
    await this.waService.sendText(this.jid, message);
    MeetingWorkflowManager.endWorkflow(this.sessionKey);
    return false;
  }

  private async importSource(text: string) {
    const context = await this.workflowService.getContext();
    const defaultTeamId = context.teams.length === 1 ? context.teams[0].team_id : null;
    const matchingProjects = defaultTeamId
      ? context.projects.filter((project) => !project.team_id || project.team_id === defaultTeamId)
      : [];
    const defaultProjectId = matchingProjects.length === 1 ? matchingProjects[0].project_id : null;

    if (this.looksLikeDriveReference(text)) {
      return this.workflowService.createDriveRun({
        ownerUserId: this.senderNumber,
        originChannel: 'whatsapp',
        originRef: text.trim(),
        meetingTitle: null,
        meetingType: 'general',
        defaultTeamId,
        defaultProjectId,
        fileIdOrUrl: text.trim(),
      });
    }

    return this.workflowService.createManualRun({
      ownerUserId: this.senderNumber,
      originChannel: 'whatsapp',
      originRef: `whatsapp:${this.senderNumber}`,
      meetingTitle: null,
      meetingType: 'general',
      defaultTeamId,
      defaultProjectId,
      text,
    });
  }

  private looksLikeDriveReference(text: string): boolean {
    const trimmed = text.trim();
    return trimmed.includes('drive.google.com') || /^[a-zA-Z0-9_-]{20,}$/.test(trimmed);
  }

  private formatRunDetail(detail: MeetingRunDetail, deduplicated: boolean): string {
    const asset = detail.latest_asset;
    const actionCount = detail.sync_actions.length;
    const flags = asset?.review_flags || [];
    const lines = [
      deduplicated ? 'Ya existia un run con la misma fuente. Reuso ese resultado.' : 'Reunion importada correctamente.',
      `Run: ${detail.run.id}`,
      `Estado: ${detail.run.status}`,
      '',
      `Resumen ejecutivo: ${this.getExecutiveSummary(asset)}`,
      '',
      `Compromisos: ${asset?.payload.commitments.length || 0}`,
      `Decisiones: ${asset?.payload.decisions.length || 0}`,
      `Issues: ${asset?.payload.issues.length || 0}`,
      `Acciones propuestas: ${actionCount}`,
      `Flags de revision: ${flags.length}`,
      '',
      'Siguiente paso: responde "acciones" para revisar, luego "aprobar resumen" y despues "aprobar accion N", "aprobar acciones" o "rechazar".',
    ];
    return lines.join('\n');
  }

  private formatStatus(detail: MeetingRunDetail): string {
    const asset = detail.latest_asset;
    const approvedActions = detail.sync_actions.filter((action) => action.approval_state === 'approved').length;
    const syncedActions = detail.sync_actions.filter((action) => action.sync_state === 'synced').length;
    return [
      `Run: ${detail.run.id}`,
      `Estado: ${detail.run.status}`,
      `Resumen aprobado: ${detail.approvals.some((approval) => approval.scope === 'asset' && approval.decision === 'approved') ? 'si' : 'no'}`,
      `Acciones aprobadas: ${approvedActions}/${detail.sync_actions.length}`,
      `Acciones sincronizadas: ${syncedActions}/${detail.sync_actions.length}`,
      `Resumen ejecutivo: ${this.getExecutiveSummary(asset)}`,
    ].join('\n');
  }

  private getExecutiveSummary(asset: MeetingRunDetail['latest_asset']): string {
    return asset?.executive_summary?.trim() || asset?.payload?.executive_summary?.trim() || 'Sin resumen.';
  }

  private shouldCloseWorkflow(detail: MeetingRunDetail): boolean {
    const hasPendingReview = detail.sync_actions.some((action) => action.approval_state === 'draft');
    const hasApprovedPendingSync = detail.sync_actions.some(
      (action) => action.approval_state === 'approved' && action.sync_state !== 'synced',
    );
    return !hasPendingReview && !hasApprovedPendingSync;
  }

  private async buildUnknownInstructionMessage(): Promise<string> {
    if (!this.runId) {
      return 'No reconoci la instruccion. Usa: "estado", "acciones", "aprobar resumen", "aprobar acciones", "aprobar accion N", "editar accion N ...", "sincronizar", "rechazar" o "cancelar".';
    }

    const detail = await this.workflowService.getRunDetail(this.runId);
    if (this.shouldCloseWorkflow(detail)) {
      return 'Este workflow de reuniones ya termino. Lo cierro para devolverte el chat normal. Si quieres revisar otra reunion, usa /reunion.';
    }

    return 'No reconoci la instruccion. Usa: "estado", "acciones", "aprobar resumen", "aprobar acciones", "aprobar accion N", "editar accion N ...", "sincronizar", "rechazar" o "cancelar".';
  }

  private formatActionList(detail: MeetingRunDetail): string {
    if (detail.sync_actions.length === 0) {
      return 'No hay acciones propuestas en este run.';
    }

    const lines = [
      'Acciones del run:',
      ...detail.sync_actions.map((action, index) => {
        const teamId = action.payload.team_id || 'sin-team';
        const dueDate = action.payload.due_date || 'sin-fecha';
        const owner = action.payload.owner_candidate || 'sin-responsable-detectado';
        const assignee = action.payload.assignee_id || 'sin-assignee';
        return `${index + 1}. ${action.payload.title || action.summary} | ${action.approval_state}/${action.sync_state} | team=${teamId} | fecha=${dueDate} | owner=${owner} | assignee=${assignee}`;
      }),
      '',
      'Comandos:',
      'aprobar accion N',
      'editar accion N titulo="..." fecha=YYYY-MM-DD team=TEAM_ID proyecto=PROJECT_ID responsable="Nombre" assignee=USER_ID',
    ];
    return lines.join('\n');
  }

  private formatSyncResult(detail: MeetingRunDetail, result: { synced: number; failed: number; skipped: number }): string {
    return [
      'Sincronizacion terminada.',
      `Estado final: ${detail.run.status}`,
      `Sincronizadas: ${result.synced}`,
      `Fallidas: ${result.failed}`,
      `Omitidas: ${result.skipped}`,
    ].join('\n');
  }

  private getActionByNumber(detail: MeetingRunDetail, actionNumber: number) {
    if (!Number.isFinite(actionNumber) || actionNumber < 1) return null;
    return detail.sync_actions[actionNumber - 1] || null;
  }

  private parseActionUpdates(rawText: string): UpdateMeetingActionInput {
    const updates: UpdateMeetingActionInput = {};
    const tokenRegex = /([a-z_]+)=("([^"]*)"|'([^']*)'|(\S+))/gi;
    let match: RegExpExecArray | null = tokenRegex.exec(rawText);
    while (match) {
      const key = match[1].toLowerCase();
      const value = match[3] || match[4] || match[5] || '';
      if (key === 'titulo' || key === 'title') updates.title = value;
      if (key === 'fecha' || key === 'due') updates.due_date = value;
      if (key === 'team' || key === 'equipo') updates.team_id = value;
      if (key === 'proyecto' || key === 'project') updates.project_id = value;
      if (key === 'responsable' || key === 'owner') updates.owner_candidate = value;
      if (key === 'assignee' || key === 'usuario') updates.assignee_id = value;
      match = tokenRegex.exec(rawText);
    }
    return updates;
  }
}

class MeetingWorkflowManagerClass {
  private readonly activeWorkflows = new Map<string, MeetingWhatsAppWorkflow>();

  isActive(sessionKey: string): boolean {
    return this.activeWorkflows.has(sessionKey);
  }

  async startWorkflow(
    sessionKey: string,
    jid: string,
    senderNumber: string,
    waService: WhatsAppService,
    workflowService: MeetingWorkflowService,
  ): Promise<void> {
    await this.startWorkflowInternal(sessionKey, jid, senderNumber, waService, workflowService);
  }

  async startWorkflowForExistingRun(
    sessionKey: string,
    jid: string,
    senderNumber: string,
    waService: WhatsAppService,
    workflowService: MeetingWorkflowService,
    runId: string,
    introMessage?: string | null,
  ): Promise<void> {
    await this.startWorkflowInternal(sessionKey, jid, senderNumber, waService, workflowService, runId, introMessage);
  }

  async handleMessage(sessionKey: string, text: string): Promise<boolean> {
    const workflow = this.activeWorkflows.get(sessionKey);
    if (!workflow) return false;

    const stillActive = await workflow.handleInput(text);
    if (!stillActive) {
      workflow.dispose();
      this.activeWorkflows.delete(sessionKey);
    }
    return true;
  }

  endWorkflow(sessionKey: string): void {
    const workflow = this.activeWorkflows.get(sessionKey);
    workflow?.dispose();
    this.activeWorkflows.delete(sessionKey);
  }

  private async startWorkflowInternal(
    sessionKey: string,
    jid: string,
    senderNumber: string,
    waService: WhatsAppService,
    workflowService: MeetingWorkflowService,
    runId?: string | null,
    introMessage?: string | null,
  ): Promise<void> {
    const existingWorkflow = this.activeWorkflows.get(sessionKey);
    existingWorkflow?.dispose();
    const workflow = new MeetingWhatsAppWorkflow(
      sessionKey,
      jid,
      senderNumber,
      waService,
      workflowService,
      runId ?? null,
      introMessage ?? null,
    );
    this.activeWorkflows.set(sessionKey, workflow);
    await workflow.start();
  }
}

export const MeetingWorkflowManager = new MeetingWorkflowManagerClass();
