import fs from 'node:fs/promises';
import path from 'node:path';
import { normalizePath, getFileExtension } from '../../utils/file-utils';
import type { FileOperationManifest, MovedFile, ProgressCallback } from './types';
import { collectFiles, resolveCollision } from './file-utils';
import { buildManifestId, saveManifest } from './manifest-store';

export async function batchMoveFiles(args: Record<string, any>, onProgress?: ProgressCallback): Promise<any> {
  try {
    const sourceDir = normalizePath(args.source_directory);
    const destDir = normalizePath(args.destination_directory);
    const pattern = (args.pattern as string || '*').toLowerCase();
    const extensions = args.extensions as string[] | undefined;
    const recursive: boolean = !!args.recursive;

    await fs.mkdir(destDir, { recursive: true });
    const files = await collectFiles(sourceDir, recursive);
    onProgress?.(`Analizando ${files.length} archivos para mover de ${sourceDir} a ${destDir}...`);

    const movedFiles: MovedFile[] = [];
    const errors: string[] = [];

    let processedCount = 0;
    for (const file of files) {
      processedCount += 1;
      if (processedCount % 50 === 0) {
        onProgress?.(`Moviendo... procesados ${processedCount} de ${files.length} archivos.`);
      }

      const ext = getFileExtension(file.name);
      const nameLC = file.name.toLowerCase();
      if (extensions?.length && !extensions.some((entry) => ext === entry.toLowerCase().replace('.', ''))) continue;
      if (pattern !== '*' && !nameLC.includes(pattern)) continue;

      try {
        const destination = await resolveCollision(path.join(destDir, file.name));
        await fs.rename(file.fullPath, destination);
        movedFiles.push({ name: file.name, from: file.fullPath, to: destination });
      } catch (err: any) {
        errors.push(`${file.relativePath}: ${err.message}`);
      }
    }

    const operationId = await persistBatchMoveManifest(sourceDir, destDir, pattern, extensions, recursive, movedFiles);
    return {
      success: true,
      recursive,
      operationId,
      movedCount: movedFiles.length,
      errorCount: errors.length,
      moved: movedFiles.slice(0, 50),
      errors: errors.slice(0, 10),
      message: `Movidos ${movedFiles.length} archivos de ${path.basename(sourceDir)} a ${path.basename(destDir)}.${operationId ? ` Puedes deshacer con undo_last_file_operation usando ${operationId}.` : ''}`,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

async function persistBatchMoveManifest(
  sourceDir: string,
  destDir: string,
  pattern: string,
  extensions: string[] | undefined,
  recursive: boolean,
  movedFiles: MovedFile[],
): Promise<string | undefined> {
  if (movedFiles.length === 0) return undefined;
  const manifest: FileOperationManifest = {
    id: buildManifestId('batch_move_files'),
    createdAt: new Date().toISOString(),
    operation: 'batch_move_files',
    sourcePath: sourceDir,
    destinationPath: destDir,
    options: { pattern, extensions: extensions || null, recursive },
    moved: movedFiles,
  };
  await saveManifest(manifest);
  return manifest.id;
}
