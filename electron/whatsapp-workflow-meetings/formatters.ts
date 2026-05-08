import type { MeetingRunDetail } from '../meetings/meeting-types';

export function looksLikeDriveReference(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.includes('drive.google.com') || /^[a-zA-Z0-9_-]{20,}$/.test(trimmed);
}

export function formatRunDetail(detail: MeetingRunDetail, deduplicated: boolean): string {
  const asset = detail.latest_asset;
  return [
    deduplicated ? 'Ya existia un run con la misma fuente. Reuso ese resultado.' : 'Reunion importada correctamente.',
    `Run: ${detail.run.id}`,
    `Estado: ${detail.run.status}`,
    '',
    `Resumen ejecutivo: ${getExecutiveSummary(asset)}`,
    '',
    `Compromisos: ${asset?.payload.commitments.length || 0}`,
    `Decisiones: ${asset?.payload.decisions.length || 0}`,
    `Issues: ${asset?.payload.issues.length || 0}`,
    `Acciones propuestas: ${detail.sync_actions.length}`,
    `Flags de revision: ${asset?.review_flags.length || 0}`,
    '',
    'Siguiente paso: responde "acciones" para revisar, luego "aprobar resumen" y despues "aprobar accion N", "aprobar acciones" o "rechazar".',
  ].join('\n');
}

export function formatStatus(detail: MeetingRunDetail): string {
  const approvedActions = detail.sync_actions.filter((action) => action.approval_state === 'approved').length;
  const syncedActions = detail.sync_actions.filter((action) => action.sync_state === 'synced').length;
  return [
    `Run: ${detail.run.id}`,
    `Estado: ${detail.run.status}`,
    `Resumen aprobado: ${detail.approvals.some((approval) => approval.scope === 'asset' && approval.decision === 'approved') ? 'si' : 'no'}`,
    `Acciones aprobadas: ${approvedActions}/${detail.sync_actions.length}`,
    `Acciones sincronizadas: ${syncedActions}/${detail.sync_actions.length}`,
    `Resumen ejecutivo: ${getExecutiveSummary(detail.latest_asset)}`,
  ].join('\n');
}

export function getExecutiveSummary(asset: MeetingRunDetail['latest_asset']): string {
  return asset?.executive_summary?.trim() || asset?.payload?.executive_summary?.trim() || 'Sin resumen.';
}

export function shouldCloseWorkflow(detail: MeetingRunDetail): boolean {
  const hasPendingReview = detail.sync_actions.some((action) => action.approval_state === 'draft');
  const hasApprovedPendingSync = detail.sync_actions.some((action) => action.approval_state === 'approved' && action.sync_state !== 'synced');
  return !hasPendingReview && !hasApprovedPendingSync;
}

export function formatActionList(detail: MeetingRunDetail): string {
  if (detail.sync_actions.length === 0) return 'No hay acciones propuestas en este run.';
  return [
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
  ].join('\n');
}

export function formatSyncResult(detail: MeetingRunDetail, result: { synced: number; failed: number; skipped: number }): string {
  return [
    'Sincronizacion terminada.',
    `Estado final: ${detail.run.status}`,
    `Sincronizadas: ${result.synced}`,
    `Fallidas: ${result.failed}`,
    `Omitidas: ${result.skipped}`,
  ].join('\n');
}

export function getActionByNumber(detail: MeetingRunDetail, actionNumber: number) {
  if (!Number.isFinite(actionNumber) || actionNumber < 1) return null;
  return detail.sync_actions[actionNumber - 1] || null;
}
