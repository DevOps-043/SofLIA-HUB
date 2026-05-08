import * as fsPromises from 'node:fs/promises';
import * as path from 'node:path';
import { EXCLUDED_DIRS, EXCLUDED_PREFIXES, MAX_DEPTH, MAX_ENTRIES_PER_DIR } from './constants';
import type { DirEntry, ScannedDir } from './types';

export async function scanDirectory(
  scannedDirs: Map<string, ScannedDir>,
  dirPath: string,
  label: string,
  maxDepth: number,
  currentDepth = 0,
): Promise<void> {
  if (currentDepth > maxDepth || currentDepth > MAX_DEPTH) return;

  const normalizedPath = path.normalize(dirPath);
  const dirName = path.basename(normalizedPath);
  if (EXCLUDED_DIRS.has(dirName)) return;
  if (EXCLUDED_PREFIXES.some((prefix) => dirName.startsWith(prefix)) && currentDepth > 0) return;

  try {
    const rawEntries = await fsPromises.readdir(normalizedPath, { withFileTypes: true });
    const entries: DirEntry[] = [];
    const subdirs: string[] = [];

    for (const entry of rawEntries.slice(0, MAX_ENTRIES_PER_DIR)) {
      const nextEntry = await collectEntry(normalizedPath, entry);
      if (!nextEntry) continue;
      entries.push(nextEntry.entry);
      if (nextEntry.subdir) subdirs.push(nextEntry.subdir);
    }

    entries.sort(sortEntries);
    scannedDirs.set(normalizedPath, { path: normalizedPath, label: currentDepth === 0 ? label : '', entries, lastScanMs: Date.now() });

    for (const subdir of subdirs) await scanDirectory(scannedDirs, subdir, '', maxDepth, currentDepth + 1);
  } catch (err: any) {
    if (!['EPERM', 'EACCES', 'ENOENT'].includes(err.code)) {
      console.warn(`[PathMemory] Error escaneando ${normalizedPath}:`, err.message);
    }
  }
}

async function collectEntry(normalizedPath: string, entry: any): Promise<{ entry: DirEntry; subdir?: string } | null> {
  if (EXCLUDED_PREFIXES.some((prefix) => entry.name.startsWith(prefix))) return null;
  if (entry.isDirectory() && EXCLUDED_DIRS.has(entry.name)) return null;

  const isDir = entry.isDirectory();
  const fullPath = path.join(normalizedPath, entry.name);
  const result: DirEntry = { name: entry.name, isDir };

  if (!isDir) {
    try {
      const stats = await fsPromises.stat(fullPath);
      result.size = stats.size;
      result.mtime = stats.mtimeMs;
    } catch {}
  }

  return { entry: result, subdir: isDir ? fullPath : undefined };
}

function sortEntries(a: DirEntry, b: DirEntry): number {
  if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
  if (a.mtime && b.mtime) return b.mtime - a.mtime;
  return a.name.localeCompare(b.name);
}
