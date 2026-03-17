import type { MeetingWorkflowService } from './meetings/meeting-workflow-service';
import type { MeetingRunDetail, UpdateMeetingActionInput } from './meetings/meeting-types';
import type { WhatsAppService } from './whatsapp-service';

class MeetingWhatsAppWorkflow {
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
    if (this.runId) {
      await this.waService.sendText(
        this.jid,
        this.introMessage || [
          'Detecte una reunion nueva y ya cargue la transcripcion.',
          `Run: ${this.runId}`,
          'Usa "estado", "acciones", "aprobar resumen", "aprobar accion N" o "sincronizar".',
        ].join('\n'),
      );
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
        'Luego podras responder: "estado", "aprobar resumen", "aprobar acciones", "sincronizar" o "cancelar".',
      ].join('\n'),
    );
  }

  async handleInput(text: string): Promise<boolean> {
    const lower = text.trim().toLowerCase();

    try {
      if (lower === 'cancelar' || lower === 'cerrar') {
        await this.waService.sendText(this.jid, 'Workflow de reuniones cancelado.');
        return false;
      }

      if (!this.runId) {
        const result = await this.importSource(text);
        this.runId = result.detail.run.id;
        await this.waService.sendText(this.jid, this.formatRunDetail(result.detail, result.deduplicated));
        return true;
      }

      if (lower === 'estado') {
        const detail = await this.workflowService.getRunDetail(this.runId);
        await this.waService.sendText(this.jid, this.formatStatus(detail));
        return true;
      }

      if (lower === 'acciones') {
        const detail = await this.workflowService.getRunDetail(this.runId);
        await this.waService.sendText(this.jid, this.formatActionList(detail));
        return true;
      }

      if (lower === 'aprobar resumen') {
        const detail = await this.workflowService.approveAsset(this.runId, this.senderNumber, 'Aprobado desde WhatsApp');
        await this.waService.sendText(this.jid, `Resumen aprobado.\n\n${this.formatStatus(detail)}`);
        return true;
      }

      if (lower === 'aprobar acciones') {
        const detail = await this.workflowService.approveActions(
          this.runId,
          this.senderNumber,
          undefined,
          'Acciones aprobadas desde WhatsApp',
        );
        await this.waService.sendText(this.jid, `Acciones aprobadas.\n\n${this.formatStatus(detail)}`);
        return true;
      }

      const approveSingleMatch = lower.match(/^aprobar accion\s+(\d+)$/);
      if (approveSingleMatch) {
        const action = this.getActionByNumber(await this.workflowService.getRunDetail(this.runId), Number(approveSingleMatch[1]));
        if (!action) {
          await this.waService.sendText(this.jid, 'No encontre ese numero de accion.');
          return true;
        }
        const detail = await this.workflowService.approveActions(
          this.runId,
          this.senderNumber,
          [action.id],
          'Accion aprobada desde WhatsApp',
        );
        await this.waService.sendText(this.jid, `Accion ${approveSingleMatch[1]} aprobada.\n\n${this.formatActionList(detail)}`);
        return true;
      }

      const editMatch = text.trim().match(/^editar accion\s+(\d+)\s+(.+)$/i);
      if (editMatch) {
        const detail = await this.workflowService.getRunDetail(this.runId);
        const action = this.getActionByNumber(detail, Number(editMatch[1]));
        if (!action) {
          await this.waService.sendText(this.jid, 'No encontre ese numero de accion.');
          return true;
        }

        const updates = this.parseActionUpdates(editMatch[2]);
        if (Object.keys(updates).length === 0) {
          await this.waService.sendText(
            this.jid,
            'No detecte cambios validos. Usa por ejemplo: editar accion 1 titulo="Preparar minuta" fecha=2026-03-20 team=TEAM_ID proyecto=PROJECT_ID responsable="Juan Perez" assignee=USER_ID',
          );
          return true;
        }

        const updatedDetail = await this.workflowService.updateAction(action.id, updates);
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
        'No reconoci la instruccion. Usa: "estado", "acciones", "aprobar resumen", "aprobar acciones", "aprobar accion N", "editar accion N ...", "sincronizar" o "cancelar".',
      );
      return true;
    } catch (error: any) {
      await this.waService.sendText(this.jid, `No pude completar la accion: ${error?.message || String(error)}`);
      return true;
    }
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
      `Resumen ejecutivo: ${asset?.executive_summary || 'Sin resumen.'}`,
      '',
      `Compromisos: ${asset?.payload.commitments.length || 0}`,
      `Decisiones: ${asset?.payload.decisions.length || 0}`,
      `Issues: ${asset?.payload.issues.length || 0}`,
      `Acciones propuestas: ${actionCount}`,
      `Flags de revision: ${flags.length}`,
      '',
      'Siguiente paso: responde "acciones" para revisar, luego "aprobar resumen" y despues "aprobar accion N" o "aprobar acciones".',
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
      `Resumen ejecutivo: ${asset?.executive_summary || 'Sin resumen.'}`,
    ].join('\n');
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
      this.activeWorkflows.delete(sessionKey);
    }
    return true;
  }

  endWorkflow(sessionKey: string): void {
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
