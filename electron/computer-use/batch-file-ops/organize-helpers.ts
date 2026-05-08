import fs from 'node:fs/promises';
import type { FileOperationManifest, MovedFile } from './types';
import { getCategoryForExt } from './file-utils';
import { buildManifestId, saveManifest } from './manifest-store';

export async function resolveTargetFolder(
  fullPath: string,
  relativePath: string,
  ext: string,
  mode: string,
  skippedFiles: string[],
  customRules?: Record<string, string>,
): Promise<string | null> {
  if (mode !== 'date') return getCategoryForExt(ext, mode, customRules);
  try {
    const stat = await fs.stat(fullPath);
    const date = stat.mtime;
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  } catch {
    skippedFiles.push(relativePath);
    return null;
  }
}

export async function persistOrganizeManifest(
  resolved: string,
  mode: string,
  dryRun: boolean,
  recursive: boolean,
  customRules: Record<string, string> | undefined,
  movedFiles: MovedFile[],
): Promise<string | undefined> {
  if (dryRun || movedFiles.length === 0) return undefined;
  const manifest: FileOperationManifest = {
    id: buildManifestId('organize_files'),
    createdAt: new Date().toISOString(),
    operation: 'organize_files',
    sourcePath: resolved,
    options: { mode, dryRun, recursive, rules: customRules || null },
    moved: movedFiles,
  };
  await saveManifest(manifest);
  return manifest.id;
}

export function buildOrganizeResult(options: {
  resolved: string;
  mode: string;
  dryRun: boolean;
  recursive: boolean;
  operationId?: string;
  movedFiles: MovedFile[];
  skippedFiles: string[];
  errors: string[];
  createdFolders: Set<string>;
}) {
  const { resolved, mode, dryRun, recursive, operationId, movedFiles, skippedFiles, errors, createdFolders } = options;
  return {
    success: true,
    path: resolved,
    mode,
    dryRun,
    recursive,
    operationId,
    movedCount: movedFiles.length,
    skippedCount: skippedFiles.length,
    errorCount: errors.length,
    foldersCreated: Array.from(createdFolders),
    moved: movedFiles.slice(0, 50),
    skipped: skippedFiles.slice(0, 20),
    errors: errors.slice(0, 10),
    message: dryRun
      ? `Simulacion: se moverian ${movedFiles.length} archivos a ${createdFolders.size} carpetas.`
      : `Organizados ${movedFiles.length} archivos en ${createdFolders.size} carpetas.${operationId ? ` Puedes deshacer con undo_last_file_operation usando ${operationId}.` : ''}`,
  };
}
