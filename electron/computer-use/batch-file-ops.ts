/**
 * Batch file operations for organize_files, batch_move_files,
 * list_directory_summary and undo_last_file_operation.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { normalizePath, formatBytes, getFileExtension } from '../utils/file-utils';

const TYPE_CATEGORIES: Record<string, string[]> = {
  Documentos: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'rtf', 'odt', 'ods', 'odp', 'csv', 'epub'],
  Imagenes: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'ico', 'tiff', 'tif', 'raw', 'heic', 'heif', 'avif'],
  Videos: ['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm', 'mpg', 'mpeg', 'm4v', '3gp'],
  Audio: ['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma', 'm4a', 'opus', 'aiff'],
  Comprimidos: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'cab', 'iso'],
  Programas: ['exe', 'msi', 'dmg', 'deb', 'rpm', 'appimage', 'bat', 'cmd', 'ps1', 'sh'],
  Codigo: ['js', 'ts', 'py', 'java', 'cpp', 'c', 'h', 'cs', 'go', 'rs', 'rb', 'php', 'html', 'css', 'json', 'xml', 'yaml', 'yml', 'sql', 'md'],
  Fuentes: ['ttf', 'otf', 'woff', 'woff2', 'eot'],
  Diseno: ['psd', 'ai', 'sketch', 'fig', 'xd', 'indd', 'cdr'],
  Datos: ['db', 'sqlite', 'sqlite3', 'mdb', 'accdb', 'bak'],
};

const MANIFEST_DIR = path.join(os.homedir(), '.soflia-hub', 'file-op-manifests');

type CollectedFile = {
  name: string;
  fullPath: string;
  relativePath: string;
};

type MovedFile = {
  name: string;
  from: string;
  to: string;
};

type FileOperationManifest = {
  id: string;
  createdAt: string;
  operation: 'organize_files' | 'batch_move_files';
  sourcePath: string;
  destinationPath?: string;
  options: Record<string, any>;
  moved: MovedFile[];
  undoneAt?: string;
};

function getCategoryForExt(ext: string, mode: string, customRules?: Record<string, string>): string {
  if (mode === 'custom' && customRules) {
    return customRules[ext] || customRules['*'] || ext;
  }
  if (mode === 'type') {
    for (const [category, exts] of Object.entries(TYPE_CATEGORIES)) {
      if (exts.includes(ext)) return category;
    }
    return 'Otros';
  }
  return ext.toUpperCase();
}

async function ensureManifestDir(): Promise<void> {
  await fs.mkdir(MANIFEST_DIR, { recursive: true });
}

function buildManifestId(operation: FileOperationManifest['operation']): string {
  return `${operation}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function saveManifest(manifest: FileOperationManifest): Promise<string> {
  await ensureManifestDir();
  const manifestPath = path.join(MANIFEST_DIR, `${manifest.id}.json`);
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
  return manifestPath;
}

async function loadManifest(operationId?: string): Promise<{ manifest: FileOperationManifest; manifestPath: string }> {
  await ensureManifestDir();

  if (operationId) {
    const manifestPath = path.join(MANIFEST_DIR, `${operationId}.json`);
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8')) as FileOperationManifest;
    return { manifest, manifestPath };
  }

  const entries = await fs.readdir(MANIFEST_DIR, { withFileTypes: true });
  const manifests = await Promise.all(entries
    .filter(entry => entry.isFile() && entry.name.endsWith('.json'))
    .map(async entry => {
      const manifestPath = path.join(MANIFEST_DIR, entry.name);
      const stat = await fs.stat(manifestPath);
      return { manifestPath, mtimeMs: stat.mtimeMs };
    }));

  if (manifests.length === 0) {
    throw new Error('No hay operaciones de archivos registradas para deshacer.');
  }

  manifests.sort((a, b) => b.mtimeMs - a.mtimeMs);
  const latest = manifests[0];
  const manifest = JSON.parse(await fs.readFile(latest.manifestPath, 'utf-8')) as FileOperationManifest;
  return { manifest, manifestPath: latest.manifestPath };
}

async function collectFiles(root: string, recursive: boolean, maxDepth = 8): Promise<CollectedFile[]> {
  const collected: CollectedFile[] = [];

  async function walk(currentDir: string, depth: number) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        if (recursive && depth < maxDepth) {
          await walk(fullPath, depth + 1);
        }
        continue;
      }

      collected.push({
        name: entry.name,
        fullPath,
        relativePath: path.relative(root, fullPath),
      });
    }
  }

  await walk(root, 0);
  return collected;
}

async function resolveCollision(targetPath: string): Promise<string> {
  try {
    await fs.access(targetPath);
    const parsed = path.parse(targetPath);
    return path.join(parsed.dir, `${parsed.name}_${Date.now()}${parsed.ext}`);
  } catch {
    return targetPath;
  }
}

export async function organizeFiles(
  args: Record<string, any>,
  onProgress?: (message: string) => void,
): Promise<any> {
  try {
    const resolved = normalizePath(args.path || os.homedir());
    const mode: string = args.mode || 'extension';
    const dryRun: boolean = !!args.dry_run;
    const customRules: Record<string, string> | undefined = args.rules;
    const recursive: boolean = !!args.recursive;

    if (onProgress) onProgress(`Analizando directorio ${resolved} para organizar...`);
    const files = await collectFiles(resolved, recursive);
    if (onProgress) onProgress(`Se encontraron ${files.length} archivos. Iniciando organizacion (${mode})...`);

    const movedFiles: MovedFile[] = [];
    const skippedFiles: string[] = [];
    const errors: string[] = [];
    const createdFolders = new Set<string>();

    let processedCount = 0;
    for (const file of files) {
      processedCount++;
      if (processedCount % 50 === 0 && onProgress) {
        onProgress(`Organizando... procesados ${processedCount} de ${files.length} archivos.`);
      }

      const ext = getFileExtension(file.name);
      if (!ext) {
        skippedFiles.push(file.relativePath);
        continue;
      }

      let targetFolder: string;
      if (mode === 'date') {
        try {
          const stat = await fs.stat(file.fullPath);
          const date = stat.mtime;
          targetFolder = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        } catch {
          skippedFiles.push(file.relativePath);
          continue;
        }
      } else {
        targetFolder = getCategoryForExt(ext, mode, customRules);
      }

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

    let operationId: string | undefined;
    if (!dryRun && movedFiles.length > 0) {
      const manifest: FileOperationManifest = {
        id: buildManifestId('organize_files'),
        createdAt: new Date().toISOString(),
        operation: 'organize_files',
        sourcePath: resolved,
        options: { mode, dryRun, recursive, rules: customRules || null },
        moved: movedFiles,
      };
      await saveManifest(manifest);
      operationId = manifest.id;
    }

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
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function batchMoveFiles(
  args: Record<string, any>,
  onProgress?: (message: string) => void,
): Promise<any> {
  try {
    const sourceDir = normalizePath(args.source_directory);
    const destDir = normalizePath(args.destination_directory);
    const pattern = (args.pattern as string || '*').toLowerCase();
    const extensions = args.extensions as string[] | undefined;
    const recursive: boolean = !!args.recursive;

    await fs.mkdir(destDir, { recursive: true });
    const files = await collectFiles(sourceDir, recursive);
    if (onProgress) onProgress(`Analizando ${files.length} archivos para mover de ${sourceDir} a ${destDir}...`);

    const movedFiles: MovedFile[] = [];
    const errors: string[] = [];

    let processedCount = 0;
    for (const file of files) {
      processedCount++;
      if (processedCount % 50 === 0 && onProgress) {
        onProgress(`Moviendo... procesados ${processedCount} de ${files.length} archivos.`);
      }

      const ext = getFileExtension(file.name);
      const nameLC = file.name.toLowerCase();
      if (extensions?.length && !extensions.some(entry => ext === entry.toLowerCase().replace('.', ''))) continue;
      if (pattern !== '*' && !nameLC.includes(pattern)) continue;

      try {
        const destination = await resolveCollision(path.join(destDir, file.name));
        await fs.rename(file.fullPath, destination);
        movedFiles.push({ name: file.name, from: file.fullPath, to: destination });
      } catch (err: any) {
        errors.push(`${file.relativePath}: ${err.message}`);
      }
    }

    let operationId: string | undefined;
    if (movedFiles.length > 0) {
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
      operationId = manifest.id;
    }

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

export async function listDirectorySummary(
  args: Record<string, any>,
  onProgress?: (message: string) => void,
): Promise<any> {
  try {
    const resolved = normalizePath(args.path || os.homedir());
    const recursive: boolean = !!args.recursive;
    const maxDepth = Number.isFinite(args.max_depth) ? Math.max(1, Math.min(Number(args.max_depth), 12)) : 8;
    if (onProgress) onProgress(`Generando resumen del directorio ${resolved}...`);

    const files = await collectFiles(resolved, recursive, maxDepth);
    const summary: Record<string, { count: number; totalSize: number; files: string[] }> = {};
    const directories = new Set<string>();
    let totalSize = 0;

    let processedCount = 0;
    for (const file of files) {
      processedCount++;
      if (processedCount % 200 === 0 && onProgress) {
        onProgress(`Analizando para resumen... ${processedCount} de ${files.length} archivos evaluados.`);
      }

      const ext = getFileExtension(file.name) || '[sin extension]';
      directories.add(path.dirname(file.relativePath));

      try {
        const stat = await fs.stat(file.fullPath);
        totalSize += stat.size;
        if (!summary[ext]) summary[ext] = { count: 0, totalSize: 0, files: [] };
        summary[ext].count++;
        summary[ext].totalSize += stat.size;
        if (summary[ext].files.length < 5) summary[ext].files.push(file.relativePath);
      } catch {
        if (!summary[ext]) summary[ext] = { count: 0, totalSize: 0, files: [] };
        summary[ext].count++;
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
      totalDirectories: Array.from(directories).filter(dir => dir && dir !== '.').length,
      totalSize: formatBytes(totalSize),
      extensionSummary: sortedSummary,
      message: `${files.length} archivos analizados${recursive ? ' de forma recursiva' : ''} en ${path.basename(resolved)}.`,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function undoLastFileOperation(
  args: Record<string, any>,
  onProgress?: (message: string) => void,
): Promise<any> {
  try {
    const { manifest, manifestPath } = await loadManifest(args.operation_id);
    if (manifest.undoneAt) {
      return { success: false, error: `La operacion ${manifest.id} ya fue revertida el ${manifest.undoneAt}.` };
    }

    let restoredCount = 0;
    const errors: string[] = [];
    const restored: Array<{ from: string; to: string }> = [];

    for (const move of [...manifest.moved].reverse()) {
      try {
        if (onProgress && restoredCount % 25 === 0) {
          onProgress(`Revirtiendo operacion ${manifest.id}... ${restoredCount}/${manifest.moved.length}`);
        }

        await fs.access(move.to);
        await fs.mkdir(path.dirname(move.from), { recursive: true });
        const restoreTarget = await resolveCollision(move.from);
        await fs.rename(move.to, restoreTarget);
        restored.push({ from: move.to, to: restoreTarget });
        restoredCount++;
      } catch (err: any) {
        errors.push(`${move.to}: ${err.message}`);
      }
    }

    manifest.undoneAt = new Date().toISOString();
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

    return {
      success: true,
      operationId: manifest.id,
      restoredCount,
      errorCount: errors.length,
      restored: restored.slice(0, 50),
      errors: errors.slice(0, 10),
      message: `Se revirtio la operacion ${manifest.id}. Archivos restaurados: ${restoredCount}.`,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
