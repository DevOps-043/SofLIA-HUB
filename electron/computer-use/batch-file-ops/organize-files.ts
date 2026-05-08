import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { normalizePath, getFileExtension } from '../../utils/file-utils';
import type { MovedFile, ProgressCallback } from './types';
import { collectFiles, resolveCollision } from './file-utils';
import { buildOrganizeResult, persistOrganizeManifest, resolveTargetFolder } from './organize-helpers';

export async function organizeFiles(args: Record<string, any>, onProgress?: ProgressCallback): Promise<any> {
  try {
    const resolved = normalizePath(args.path || os.homedir());
    const mode: string = args.mode || 'extension';
    const dryRun: boolean = !!args.dry_run;
    const customRules: Record<string, string> | undefined = args.rules;
    const recursive: boolean = !!args.recursive;

    onProgress?.(`Analizando directorio ${resolved} para organizar...`);
    const files = await collectFiles(resolved, recursive);
    onProgress?.(`Se encontraron ${files.length} archivos. Iniciando organizacion (${mode})...`);

    const movedFiles: MovedFile[] = [];
    const skippedFiles: string[] = [];
    const errors: string[] = [];
    const createdFolders = new Set<string>();

    let processedCount = 0;
    for (const file of files) {
      processedCount += 1;
      if (processedCount % 50 === 0) {
        onProgress?.(`Organizando... procesados ${processedCount} de ${files.length} archivos.`);
      }

      const ext = getFileExtension(file.name);
      if (!ext) {
        skippedFiles.push(file.relativePath);
        continue;
      }

      const targetFolder = await resolveTargetFolder(file.fullPath, file.relativePath, ext, mode, skippedFiles, customRules);
      if (!targetFolder) continue;

      const targetDir = path.join(resolved, targetFolder);
      const initialDestination = path.join(targetDir, file.name);
      if (path.resolve(path.dirname(file.fullPath)) === path.resolve(targetDir)) {
        skippedFiles.push(file.relativePath);
        continue;
      }

      if (dryRun) {
        movedFiles.push({ name: file.name, from: file.fullPath, to: initialDestination });
        createdFolders.add(targetFolder);
        continue;
      }

      try {
        if (!createdFolders.has(targetFolder)) {
          await fs.mkdir(targetDir, { recursive: true });
          createdFolders.add(targetFolder);
        }
        const finalDestination = await resolveCollision(initialDestination);
        await fs.rename(file.fullPath, finalDestination);
        movedFiles.push({ name: file.name, from: file.fullPath, to: finalDestination });
      } catch (err: any) {
        errors.push(`${file.relativePath}: ${err.message}`);
      }
    }

    const operationId = await persistOrganizeManifest(resolved, mode, dryRun, recursive, customRules, movedFiles);
    return buildOrganizeResult({
      resolved,
      mode,
      dryRun,
      recursive,
      operationId,
      movedFiles,
      skippedFiles,
      errors,
      createdFolders,
    });
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
