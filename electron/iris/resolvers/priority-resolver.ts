import {
  describeResolutionCandidates,
  resolveSearchCandidate,
} from '../../../src/shared/iris-resolution';
import { buildPriorityAliases, getPriorities } from '../priorities';
import type { IrisPriorityRecord, ResolveResult } from '../types';
import { isUuidLike } from './common';

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
