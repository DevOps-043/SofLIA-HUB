import { describeResolutionCandidates, resolveSearchCandidate } from '../../shared/iris-resolution';
import { getProjects } from './projects';
import type { IrisProject, ResolveResult } from './types';
import { isUuidLike } from './uuid';

export async function resolveProjectReference(refs: {
  projectId?: string;
  projectName?: string;
  scopedTeamId?: string;
}): Promise<ResolveResult<IrisProject | null>> {
  const query = refs.projectName?.trim() || refs.projectId?.trim() || '';
  if (!query) return { success: true, value: null, warnings: [] };

  const projects = await getProjects(refs.scopedTeamId);
  if (projects.length === 0) return { success: false, error: 'No hay proyectos disponibles en el alcance seleccionado.' };

  const explicitId = refs.projectId?.trim();
  if (explicitId) {
    const byId = projects.find((project) => project.project_id === explicitId);
    if (byId) return { success: true, value: byId, warnings: [] };
    if (isUuidLike(explicitId) && !refs.projectName?.trim()) return { success: false, error: `No existe el proyecto con ID ${explicitId}.` };
  }

  const resolution = resolveSearchCandidate(
    query,
    projects.map((project) => ({ item: project, label: project.project_name, aliases: [project.project_key, project.project_description] })),
  );
  if (resolution.match) return { success: true, value: resolution.match, warnings: [] };
  if (resolution.reason === 'ambiguous') {
    return { success: false, error: `El proyecto "${query}" es ambiguo. Opciones: ${describeResolutionCandidates(resolution.candidates)}.` };
  }
  return { success: false, error: `No encontre el proyecto "${query}" en IRIS.` };
}
