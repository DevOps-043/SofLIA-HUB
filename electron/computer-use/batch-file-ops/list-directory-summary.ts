import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { normalizePath, formatBytes, getFileExtension } from '../../utils/file-utils';
import type { ProgressCallback } from './types';
import { collectFiles } from './file-utils';

export async function listDirectorySummary(args: Record<string, any>, onProgress?: ProgressCallback): Promise<any> {
  try {
    const resolved = normalizePath(args.path || os.homedir());
    const recursive: boolean = !!args.recursive;
    const maxDepth = Number.isFinite(args.max_depth) ? Math.max(1, Math.min(Number(args.max_depth), 12)) : 8;
    onProgress?.(`Generando resumen del directorio ${resolved}...`);

    const files = await collectFiles(resolved, recursive, maxDepth);
    const summary: Record<string, { count: number; totalSize: number; files: string[] }> = {};
    const directories = new Set<string>();
    let totalSize = 0;

    let processedCount = 0;
    for (const file of files) {
      processedCount += 1;
      if (processedCount % 200 === 0) {
        onProgress?.(`Analizando para resumen... ${processedCount} de ${files.length} archivos evaluados.`);
      }

      const ext = getFileExtension(file.name) || '[sin extension]';
      directories.add(path.dirname(file.relativePath));

      try {
        const stat = await fs.stat(file.fullPath);
        totalSize += stat.size;
        if (!summary[ext]) summary[ext] = { count: 0, totalSize: 0, files: [] };
        summary[ext].count += 1;
        summary[ext].totalSize += stat.size;
        if (summary[ext].files.length < 5) summary[ext].files.push(file.relativePath);
      } catch {
        if (!summary[ext]) summary[ext] = { count: 0, totalSize: 0, files: [] };
        summary[ext].count += 1;
      }
    }

    const sortedSummary = Object.entries(summary)
      .sort((a, b) => b[1].count - a[1].count)
      .map(([ext, data]) => ({
        extension: ext,
        count: data.count,
        totalSize: formatBytes(data.totalSize),
        sampleFiles: data.files,
      }));

    return {
      success: true,
      path: resolved,
      recursive,
      totalFiles: files.length,
      totalDirectories: Array.from(directories).filter((dir) => dir && dir !== '.').length,
      totalSize: formatBytes(totalSize),
      extensionSummary: sortedSummary,
      message: `${files.length} archivos analizados${recursive ? ' de forma recursiva' : ''} en ${path.basename(resolved)}.`,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
