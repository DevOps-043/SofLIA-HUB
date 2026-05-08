import fs from 'node:fs/promises';
import path from 'node:path';
import { MAX_APP_SEARCH_DIRS, MAX_APP_SEARCH_RESULTS } from './constants';
import { normalizeLookupToken, isLaunchableCandidatePath, stripLaunchExtension, shouldSkipApplicationSearchDirectory } from './path-helpers';
import { scoreApplicationCandidate } from './scoring';
import { getWindowsApplicationSearchRoots } from './search-roots';
import type { ResolvedApplicationTarget } from './types';

export async function searchWindowsApplicationRoots(
  queryVariants: string[],
): Promise<ResolvedApplicationTarget[]> {
  const normalizedQueries = queryVariants
    .map((variant) => normalizeLookupToken(stripLaunchExtension(variant)))
    .filter(Boolean);
  const matches = new Map<string, ResolvedApplicationTarget>();
  let scannedDirs = 0;

  for (const searchRoot of getWindowsApplicationSearchRoots()) {
    const queue: Array<{ dir: string; depth: number }> = [{ dir: searchRoot.root, depth: 0 }];

    while (queue.length > 0 && matches.size < MAX_APP_SEARCH_RESULTS && scannedDirs < MAX_APP_SEARCH_DIRS) {
      const current = queue.shift();
      if (!current) break;
      scannedDirs += 1;

      let entries: Array<{ name: string; isDirectory(): boolean }> = [];
      try {
        entries = await fs.readdir(current.dir, { withFileTypes: true });
      } catch {
        continue;
      }

      for (const entry of entries) {
        const fullPath = path.join(current.dir, entry.name);
        if (entry.isDirectory()) {
          if (current.depth < searchRoot.maxDepth && !shouldSkipApplicationSearchDirectory(entry.name)) {
            queue.push({ dir: fullPath, depth: current.depth + 1 });
          }
          continue;
        }

        if (!isLaunchableCandidatePath(fullPath)) continue;
        const score = scoreApplicationCandidate(fullPath, normalizedQueries);
        if (score <= 0) continue;

        const key = fullPath.toLowerCase();
        const existing = matches.get(key);
        if (!existing || score > (existing.score ?? 0)) {
          matches.set(key, { path: fullPath, source: searchRoot.source, score });
        }
      }
    }
  }

  return Array.from(matches.values()).sort((a, b) => {
    const byScore = (b.score ?? 0) - (a.score ?? 0);
    if (byScore !== 0) return byScore;
    return a.path.length - b.path.length;
  });
}
