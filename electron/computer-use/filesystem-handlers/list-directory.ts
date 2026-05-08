import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { formatBytes, getFileExtension, normalizePath } from '../../utils/file-utils';
import type { DirectoryItem, ProgressCallback } from './types';

async function mapDirectoryEntry(root: string, entry: any): Promise<DirectoryItem> {
  const fullPath = path.join(root, entry.name);
  try {
    const stat = await fs.stat(fullPath);
    return {
      name: entry.name,
      path: fullPath,
      isDirectory: entry.isDirectory(),
      size: entry.isDirectory() ? null : formatBytes(stat.size),
      sizeBytes: stat.size,
      extension: entry.isDirectory() ? null : getFileExtension(entry.name),
      modified: stat.mtime.toISOString(),
      created: stat.birthtime.toISOString(),
    };
  } catch {
    return {
      name: entry.name,
      path: fullPath,
      isDirectory: entry.isDirectory(),
      size: null,
      sizeBytes: 0,
      extension: entry.isDirectory() ? null : getFileExtension(entry.name),
      modified: null,
      created: null,
    };
  }
}

export async function handleListDirectory(
  args: Record<string, any>,
  onProgress?: ProgressCallback,
): Promise<any> {
  try {
    const resolved = normalizePath(args.path || os.homedir());
    onProgress?.(`Listando directorio: ${resolved}...`);
    const entries = await fs.readdir(resolved, { withFileTypes: true });
    const visibleEntries = entries.filter((entry) => args.show_hidden || !entry.name.startsWith('.'));

    if (entries.length > 100) onProgress?.(`Analizando detalles de ${entries.length} elementos...`);
    let processedCount = 0;
    const items = await Promise.all(visibleEntries.map(async (entry) => {
      processedCount += 1;
      if (processedCount % 100 === 0) {
        onProgress?.(`Leyendo detalles... ${processedCount} de ${entries.length} archivos procesados.`);
      }
      return mapDirectoryEntry(resolved, entry);
    }));

    items.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });

    return { success: true, path: resolved, items, count: items.length };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
