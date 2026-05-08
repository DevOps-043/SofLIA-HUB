import { describeResolutionCandidates, resolveSearchCandidate } from '../../shared/iris-resolution';
import { irisSupa, isIrisConfigured } from '../../lib/iris-client';
import { resolveTeamReference } from './team-resolution';
import type { IrisPriority, IrisStatus, ResolveResult } from './types';
import { isUuidLike } from './uuid';

function buildStatusAliases(status: IrisStatus): string[] {
  const aliases = [status.name, status.status_type];
  if (status.status_type === 'todo') aliases.push('to do', 'pendiente', 'por hacer');
  if (status.status_type === 'in_progress') aliases.push('en progreso', 'doing');
  if (status.status_type === 'in_review') aliases.push('revision', 'review', 'en revision');
  if (status.status_type === 'done') aliases.push('hecho', 'completado', 'completed');
  if (status.status_type === 'backlog') aliases.push('por definir');
  if (status.status_type === 'cancelled') aliases.push('cancelado');
  return aliases;
}

function buildPriorityAliases(priority: IrisPriority): string[] {
  const normalized = priority.name.toLowerCase();
  const aliases = [priority.name];
  if (normalized.includes('urgente')) aliases.push('urgent', 'critical');
  if (normalized.includes('alta')) aliases.push('high');
  if (normalized.includes('media')) aliases.push('medium');
  if (normalized.includes('baja')) aliases.push('low');
  if (normalized.includes('sin prioridad')) aliases.push('none', 'no priority');
  return aliases;
}

export async function getStatuses(teamRef: string): Promise<IrisStatus[]> {
  if (!irisSupa || !isIrisConfigured()) return [];
  const teamResult = await resolveTeamReference(
    { teamId: teamRef, teamName: teamRef },
    { allowSingleTeamDefault: false, missingMessage: 'No encontre el equipo solicitado para listar estados.' },
  );
  if (!teamResult.success) return [];
  const { data, error } = await irisSupa.from('task_statuses').select('*').eq('team_id', teamResult.value.team_id).order('position');
  return error ? [] : data || [];
}

export async function getPriorities(): Promise<IrisPriority[]> {
  if (!irisSupa || !isIrisConfigured()) return [];
  const { data, error } = await irisSupa.from('task_priorities').select('*').order('level');
  return error ? [] : data || [];
}

export async function resolveStatusReference(refs: { statusId?: string; statusName?: string; teamId: string }): Promise<ResolveResult<IrisStatus>> {
  const statuses = await getStatuses(refs.teamId);
  if (!statuses.length) return { success: false, error: 'El equipo no tiene estados configurados en IRIS.' };
  const explicitId = refs.statusId?.trim();
  if (explicitId) {
    const byId = statuses.find((status) => status.status_id === explicitId);
    if (byId) return { success: true, value: byId, warnings: [] };
    if (isUuidLike(explicitId) && !refs.statusName?.trim()) return { success: false, error: `No existe el estado con ID ${explicitId}.` };
  }
  const query = refs.statusName?.trim() || refs.statusId?.trim() || '';
  if (!query) {
    const fallback = statuses.find((status) => status.is_default) || statuses.find((status) => status.status_type === 'backlog') || statuses.find((status) => status.status_type === 'todo') || statuses[0];
    return { success: true, value: fallback, warnings: [] };
  }
  const resolution = resolveSearchCandidate(query, statuses.map((status) => ({ item: status, label: status.name, aliases: buildStatusAliases(status) })));
  if (resolution.match) return { success: true, value: resolution.match, warnings: [] };
  if (resolution.reason === 'ambiguous') {
    return { success: false, error: `El estado "${query}" es ambiguo. Opciones: ${describeResolutionCandidates(resolution.candidates)}.` };
  }
  return { success: false, error: `No encontre el estado "${query}" para el equipo seleccionado.` };
}

export async function resolvePriorityReference(refs: { priorityId?: string; priorityName?: string }): Promise<ResolveResult<IrisPriority | null>> {
  const query = refs.priorityName?.trim() || refs.priorityId?.trim() || '';
  if (!query) return { success: true, value: null, warnings: [] };
  const priorities = await getPriorities();
  if (!priorities.length) return { success: false, error: 'IRIS no tiene prioridades configuradas.' };
  const explicitId = refs.priorityId?.trim();
  if (explicitId) {
    const byId = priorities.find((priority) => priority.priority_id === explicitId);
    if (byId) return { success: true, value: byId, warnings: [] };
    if (isUuidLike(explicitId) && !refs.priorityName?.trim()) return { success: false, error: `No existe la prioridad con ID ${explicitId}.` };
  }
  const resolution = resolveSearchCandidate(query, priorities.map((priority) => ({ item: priority, label: priority.name, aliases: buildPriorityAliases(priority) })));
  if (resolution.match) return { success: true, value: resolution.match, warnings: [] };
  if (resolution.reason === 'ambiguous') {
    return { success: false, error: `La prioridad "${query}" es ambigua. Opciones: ${describeResolutionCandidates(resolution.candidates)}.` };
  }
  return { success: false, error: `No encontre la prioridad "${query}" en IRIS.` };
}
