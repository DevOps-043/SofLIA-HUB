import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { normalizePath } from '../../utils/file-utils';
import { MAX_SEARCH_DEPTH, MAX_SEARCH_RESULTS, SEARCH_SKIP_DIRS } from './constants';
import type { ProgressCallback, SearchHit } from './types';

export async function handleSearchFiles(
  args: Record<string, any>,
  onProgress?: ProgressCallback,
): Promise<any> {
  try {
    const resolved = normalizePath(args.directory || os.homedir());
    onProgress?.(`Iniciando busqueda en ${resolved}...`);
    const results: SearchHit[] = [];
    const lowerPattern = String(args.pattern).toLowerCase();
    let scanned = 0;

    async function walk(dir: string, depth: number): Promise<void> {
      if (depth > MAX_SEARCH_DEPTH || results.length >= MAX_SEARCH_RESULTS) return;
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (results.length >= MAX_SEARCH_RESULTS) break;
          scanned += 1;
          if (scanned % 500 === 0) {
            onProgress?.(`Buscando... Escaneados ${scanned} elementos, encontrados ${results.length}.`);
          }
          if (entry.name.startsWith('.') || SEARCH_SKIP_DIRS.has(entry.name)) continue;
          const fullPath = path.join(dir, entry.name);
          if (entry.name.toLowerCase().includes(lowerPattern)) {
            results.push({ name: entry.name, path: fullPath, isDirectory: entry.isDirectory() });
          }
          if (entry.isDirectory()) await walk(fullPath, depth + 1);
        }
      } catch {
        // Permisos denegados o links muertos: seguir con el siguiente directorio.
      }
    }

    await walk(resolved, 0);
    return { success: true, pattern: args.pattern, searchPath: resolved, results, count: results.length };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
