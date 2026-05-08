import {
  describeResolutionCandidates,
  resolveSearchCandidate,
} from '../../../src/shared/iris-resolution';
import { getTeams } from '../teams';
import type { IrisTeam, ResolveResult } from '../types';
import { isUuidLike } from './common';

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
