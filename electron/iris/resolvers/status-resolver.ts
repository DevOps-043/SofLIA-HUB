import {
  describeResolutionCandidates,
  resolveSearchCandidate,
} from '../../../src/shared/iris-resolution';
import { buildStatusAliases, fetchStatusesByTeamId } from '../statuses';
import type { IrisStatusRecord, ResolveResult } from '../types';
import { isUuidLike } from './common';

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
