/**
 * Resolvers — convierten referencias humanas (nombre, slug, alias) a entidades IRIS.
 *
 * Necesario porque el LLM produce strings como "equipo de marketing", "alta",
 * "Juan", y la BD requiere UUIDs. Cada resolver:
 *  - acepta IDs explícitos (UUID-like) y devuelve match exacto si existen
 *  - si no, usa búsqueda fuzzy con aliases (`resolveSearchCandidate`)
 *  - distingue entre "no encontrado" y "ambiguo" para mensajes claros al usuario
 *
 * Solo dependen de las funciones raw de cada repositorio — nunca de operations.ts.
 */

import {
  describeResolutionCandidates,
  resolveSearchCandidate,
} from '../../src/shared/iris-resolution';
import { buildPriorityAliases, getPriorities } from './priorities';
import { fetchProjectsByTeamId } from './projects';
import { buildStatusAliases, fetchStatusesByTeamId } from './statuses';
import { fetchTeamMembersDetailedByTeamId, getTeams } from './teams';
import type {
  IrisPriorityRecord,
  IrisProject,
  IrisStatusRecord,
  IrisTeam,
  IrisTeamMemberDetail,
  ResolveResult,
} from './types';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i;

function isUuidLike(value: string | null | undefined): boolean {
  return !!value && UUID_REGEX.test(value.trim());
}

export async function resolveTeamReference(
  refs: { teamId?: string; teamName?: string },
  options?: { allowSingleTeamDefault?: boolean; missingMessage?: string },
): Promise<ResolveResult<IrisTeam>> {
  const teams = await getTeams();
  if (teams.length === 0) {
    return { success: false, error: 'IRIS no tiene equipos disponibles.' };
  }

  const explicitId = refs.teamId?.trim();
  if (explicitId) {
    const byId = teams.find((team) => team.team_id === explicitId);
    if (byId) {
      return { success: true, value: byId, warnings: [] };
    }
    if (isUuidLike(explicitId) && !refs.teamName?.trim()) {
      return { success: false, error: `No existe el equipo con ID ${explicitId}.` };
    }
  }

  const query = refs.teamName?.trim() || refs.teamId?.trim() || '';
  if (query) {
    const resolution = resolveSearchCandidate(
      query,
      teams.map((team) => ({
        item: team,
        label: team.name,
        aliases: [team.slug],
      })),
    );

    if (resolution.match) {
      return { success: true, value: resolution.match, warnings: [] };
    }

    if (resolution.reason === 'ambiguous') {
      return {
        success: false,
        error: `El equipo "${query}" es ambiguo. Opciones: ${describeResolutionCandidates(resolution.candidates)}.`,
      };
    }

    return {
      success: false,
      error: options?.missingMessage || `No encontre el equipo "${query}" en IRIS.`,
    };
  }

  if (options?.allowSingleTeamDefault && teams.length === 1) {
    return {
      success: true,
      value: teams[0],
      warnings: [`Se uso el unico equipo activo disponible: ${teams[0].name}.`],
    };
  }

  return {
    success: false,
    error: options?.missingMessage || 'Debes indicar el equipo objetivo antes de escribir en IRIS.',
  };
}

export async function resolveProjectReference(refs: {
  projectId?: string;
  projectName?: string;
  scopedTeamId?: string;
}): Promise<ResolveResult<IrisProject | null>> {
  const query = refs.projectName?.trim() || refs.projectId?.trim() || '';
  if (!query) {
    return { success: true, value: null, warnings: [] };
  }

  const projects = await fetchProjectsByTeamId(refs.scopedTeamId ?? null);
  if (projects.length === 0) {
    return { success: false, error: 'No hay proyectos disponibles en el alcance seleccionado.' };
  }

  const explicitId = refs.projectId?.trim();
  if (explicitId) {
    const byId = projects.find((project) => project.project_id === explicitId);
    if (byId) {
      return { success: true, value: byId, warnings: [] };
    }
    if (isUuidLike(explicitId) && !refs.projectName?.trim()) {
      return { success: false, error: `No existe el proyecto con ID ${explicitId}.` };
    }
  }

  const resolution = resolveSearchCandidate(
    query,
    projects.map((project) => ({
      item: project,
      label: project.project_name,
      aliases: [project.project_key, project.project_description],
    })),
  );

  if (resolution.match) {
    return { success: true, value: resolution.match, warnings: [] };
  }

  if (resolution.reason === 'ambiguous') {
    return {
      success: false,
      error: `El proyecto "${query}" es ambiguo. Opciones: ${describeResolutionCandidates(resolution.candidates)}.`,
    };
  }

  return { success: false, error: `No encontre el proyecto "${query}" en IRIS.` };
}

export async function resolveStatusReference(refs: {
  statusId?: string;
  statusName?: string;
  teamId: string;
}): Promise<ResolveResult<IrisStatusRecord>> {
  const statuses = await fetchStatusesByTeamId(refs.teamId);
  if (statuses.length === 0) {
    return { success: false, error: 'El equipo no tiene estados configurados en IRIS.' };
  }

  const explicitId = refs.statusId?.trim();
  if (explicitId) {
    const byId = statuses.find((status) => status.status_id === explicitId);
    if (byId) {
      return { success: true, value: byId, warnings: [] };
    }
    if (isUuidLike(explicitId) && !refs.statusName?.trim()) {
      return { success: false, error: `No existe el estado con ID ${explicitId}.` };
    }
  }

  const query = refs.statusName?.trim() || refs.statusId?.trim() || '';
  if (!query) {
    const fallback =
      statuses.find((status) => status.is_default) ||
      statuses.find((status) => status.status_type === 'backlog') ||
      statuses.find((status) => status.status_type === 'todo') ||
      statuses[0];
    return { success: true, value: fallback, warnings: [] };
  }

  const resolution = resolveSearchCandidate(
    query,
    statuses.map((status) => ({
      item: status,
      label: status.name,
      aliases: buildStatusAliases(status),
    })),
  );

  if (resolution.match) {
    return { success: true, value: resolution.match, warnings: [] };
  }

  if (resolution.reason === 'ambiguous') {
    return {
      success: false,
      error: `El estado "${query}" es ambiguo. Opciones: ${describeResolutionCandidates(resolution.candidates)}.`,
    };
  }

  return { success: false, error: `No encontre el estado "${query}" para el equipo seleccionado.` };
}

export async function resolvePriorityReference(refs: {
  priorityId?: string;
  priorityName?: string;
}): Promise<ResolveResult<IrisPriorityRecord | null>> {
  const query = refs.priorityName?.trim() || refs.priorityId?.trim() || '';
  if (!query) {
    return { success: true, value: null, warnings: [] };
  }

  const priorities = await getPriorities();
  if (priorities.length === 0) {
    return { success: false, error: 'IRIS no tiene prioridades configuradas.' };
  }

  const explicitId = refs.priorityId?.trim();
  if (explicitId) {
    const byId = priorities.find((priority) => priority.priority_id === explicitId);
    if (byId) {
      return { success: true, value: byId, warnings: [] };
    }
    if (isUuidLike(explicitId) && !refs.priorityName?.trim()) {
      return { success: false, error: `No existe la prioridad con ID ${explicitId}.` };
    }
  }

  const resolution = resolveSearchCandidate(
    query,
    priorities.map((priority) => ({
      item: priority,
      label: priority.name,
      aliases: buildPriorityAliases(priority),
    })),
  );

  if (resolution.match) {
    return { success: true, value: resolution.match, warnings: [] };
  }

  if (resolution.reason === 'ambiguous') {
    return {
      success: false,
      error: `La prioridad "${query}" es ambigua. Opciones: ${describeResolutionCandidates(resolution.candidates)}.`,
    };
  }

  return { success: false, error: `No encontre la prioridad "${query}" en IRIS.` };
}

export async function resolveAssigneeReference(refs: {
  assigneeId?: string;
  assigneeQuery?: string;
  teamId: string;
}): Promise<ResolveResult<IrisTeamMemberDetail | null>> {
  const query = refs.assigneeQuery?.trim() || refs.assigneeId?.trim() || '';
  if (!query) {
    return { success: true, value: null, warnings: [] };
  }

  const members = await fetchTeamMembersDetailedByTeamId(refs.teamId);
  if (members.length === 0) {
    return {
      success: false,
      error: 'El equipo seleccionado no tiene miembros disponibles para asignacion.',
    };
  }

  const explicitId = refs.assigneeId?.trim();
  if (explicitId) {
    const byId = members.find((member) => member.user_id === explicitId);
    if (byId) {
      return { success: true, value: byId, warnings: [] };
    }
    if (isUuidLike(explicitId) && !refs.assigneeQuery?.trim()) {
      return { success: false, error: 'El usuario asignado no pertenece al equipo seleccionado.' };
    }
  }

  const resolution = resolveSearchCandidate(
    query,
    members.map((member) => ({
      item: member,
      label: member.display_name || member.username || member.email || member.user_id,
      aliases: [member.username, member.email, member.email?.split('@')[0], member.user_id],
    })),
  );

  if (resolution.match) {
    return { success: true, value: resolution.match, warnings: [] };
  }

  if (resolution.reason === 'ambiguous') {
    return {
      success: false,
      error: `El responsable "${query}" es ambiguo dentro del equipo. Opciones: ${describeResolutionCandidates(resolution.candidates)}.`,
    };
  }

  return { success: false, error: `No encontre a "${query}" dentro del equipo seleccionado.` };
}
