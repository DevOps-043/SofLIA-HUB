import fsSync from 'node:fs';
import path from 'node:path';
import { normalizePath } from '../../utils/file-utils';
import { searchWindowsApplicationRoots } from './filesystem-source';
import { looksLikeConcretePath, stripLaunchExtension } from './path-helpers';
import { buildApplicationQueryVariants } from './query-variants';
import { collectRegistryMatches } from './registry-source';
import type { ResolvedApplicationTarget } from './types';
import { collectWhereMatches } from './where-source';

export function looksLikeConcreteApplicationPath(value: string): boolean {
  return looksLikeConcretePath(value);
}

export async function resolveApplicationTarget(
  target: string,
  onProgress?: (message: string) => void,
): Promise<ResolvedApplicationTarget | null> {
  const rawTarget = (target || '').trim();
  if (!rawTarget) return null;

  const directPath = normalizePath(rawTarget);
  if (looksLikeConcretePath(rawTarget) && fsSync.existsSync(directPath)) {
    return { path: directPath, source: 'direct', searchedQuery: rawTarget };
  }

  if (process.platform !== 'win32') {
    return null;
  }

  const query = stripLaunchExtension(path.basename(rawTarget));
  const queryVariants = buildApplicationQueryVariants(query);
  if (queryVariants.length === 0) return null;

  const candidates = new Map<string, ResolvedApplicationTarget>();
  const addCandidates = (items: ResolvedApplicationTarget[]) => {
    for (const item of items) {
      if (!item?.path || !fsSync.existsSync(item.path)) continue;
      const key = item.path.toLowerCase();
      const existing = candidates.get(key);
      if (!existing || (item.score ?? 0) > (existing.score ?? 0)) {
        candidates.set(key, { ...item, searchedQuery: query });
      }
    }
  };

  onProgress?.(`Buscando "${query}" en alias de Windows y aplicaciones instaladas...`);
  addCandidates(await collectWhereMatches(queryVariants));
  addCandidates(await collectRegistryMatches(queryVariants));

  if (candidates.size < 3) {
    onProgress?.(`Explorando ubicaciones comunes de programas para "${query}"...`);
    addCandidates(await searchWindowsApplicationRoots(queryVariants));
  }

  const ranked = Array.from(candidates.values()).sort((a, b) => {
    const byScore = (b.score ?? 0) - (a.score ?? 0);
    if (byScore !== 0) return byScore;
    return a.path.length - b.path.length;
  });

  if (ranked.length === 0) return null;

  return {
    ...ranked[0],
    alternatives: ranked.slice(1, 5).map((candidate) => candidate.path),
  };
}
