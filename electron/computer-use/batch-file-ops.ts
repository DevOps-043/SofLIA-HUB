/**
 * Batch file operations — organize_files, batch_move_files, list_directory_summary.
 * Extraído de computer-use-handlers.ts para reducir el tamaño del archivo principal.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { normalizePath, formatBytes, getFileExtension } from '../utils/file-utils';
import os from 'node:os';

// Extension → category mapping for 'type' mode
const TYPE_CATEGORIES: Record<string, string[]> = {
  'Documentos': ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'rtf', 'odt', 'ods', 'odp', 'csv', 'epub'],
  'Imagenes': ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'ico', 'tiff', 'tif', 'raw', 'heic', 'heif', 'avif'],
  'Videos': ['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm', 'mpg', 'mpeg', 'm4v', '3gp'],
  'Audio': ['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma', 'm4a', 'opus', 'aiff'],
  'Comprimidos': ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'cab', 'iso'],
  'Programas': ['exe', 'msi', 'dmg', 'deb', 'rpm', 'appimage', 'bat', 'cmd', 'ps1', 'sh'],
  'Codigo': ['js', 'ts', 'py', 'java', 'cpp', 'c', 'h', 'cs', 'go', 'rs', 'rb', 'php', 'html', 'css', 'json', 'xml', 'yaml', 'yml', 'sql', 'md'],
  'Fuentes': ['ttf', 'otf', 'woff', 'woff2', 'eot'],
  'Diseno': ['psd', 'ai', 'sketch', 'fig', 'xd', 'indd', 'cdr'],
  'Datos': ['db', 'sqlite', 'sqlite3', 'mdb', 'accdb', 'bak'],
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

export async function organizeFiles(
  args: Record<string, any>,
  onProgress?: (message: string) => void,
): Promise<any> {
  try {
    const resolved = normalizePath(args.path || os.homedir());
    if (onProgress) onProgress(`Analizando directorio ${resolved} para organizar...`);
    const entries = await fs.readdir(resolved, { withFileTypes: true });
    const mode: string = args.mode || 'extension';
    const dryRun: boolean = args.dry_run || false;
    const customRules: Record<string, string> | undefined = args.rules;

    if (onProgress) onProgress(`Se encontraron ${entries.length} elementos. Iniciando organización (Modo: ${mode})...`);

    const movedFiles: Array<{ name: string; from: string; to: string }> = [];
    const skippedFiles: string[] = [];
    const errors: string[] = [];
    const createdFolders = new Set<string>();
    let processedCount = 0;

    for (const entry of entries) {
      processedCount++;
      if (processedCount % 50 === 0 && onProgress) {
        onProgress(`Organizando... procesados ${processedCount} de ${entries.length} elementos.`);
      }
      if (entry.isDirectory()) continue;
      if (entry.name.startsWith('.')) continue;

      const ext = getFileExtension(entry.name);
      if (!ext) {
        skippedFiles.push(entry.name);
        continue;
      }

      let targetFolder: string;
      if (mode === 'date') {
        try {
          const stat = await fs.stat(path.join(resolved, entry.name));
          const date = stat.mtime;
          targetFolder = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        } catch {
          skippedFiles.push(entry.name);
          continue;
        }
      } else {
        targetFolder = getCategoryForExt(ext, mode, customRules);
      }

      const targetDir = path.join(resolved, targetFolder);
      const srcPath = path.join(resolved, entry.name);
      const dstPath = path.join(targetDir, entry.name);

      if (dryRun) {
        movedFiles.push({ name: entry.name, from: srcPath, to: dstPath });
        createdFolders.add(targetFolder);
        continue;
      }

      try {
        if (!createdFolders.has(targetFolder)) {
          await fs.mkdir(targetDir, { recursive: true });
          createdFolders.add(targetFolder);
        }
        let finalDst = dstPath;
        try {
          await fs.access(finalDst);
          const base = path.basename(entry.name, path.extname(entry.name));
          const extWithDot = path.extname(entry.name);
          finalDst = path.join(targetDir, `${base}_${Date.now()}${extWithDot}`);
        } catch { /* file doesn't exist, good */ }
        await fs.rename(srcPath, finalDst);
        movedFiles.push({ name: entry.name, from: srcPath, to: finalDst });
      } catch (err: any) {
        errors.push(`${entry.name}: ${err.message}`);
      }
    }

    return {
      success: true,
      path: resolved,
      mode,
      dryRun,
      movedCount: movedFiles.length,
      skippedCount: skippedFiles.length,
      errorCount: errors.length,
      foldersCreated: Array.from(createdFolders),
      moved: movedFiles.slice(0, 50),
      skipped: skippedFiles.slice(0, 20),
      errors: errors.slice(0, 10),
      message: dryRun
        ? `Simulación: se moverían ${movedFiles.length} archivos a ${createdFolders.size} carpetas.`
        : `Organizados ${movedFiles.length} archivos en ${createdFolders.size} carpetas. ${errors.length > 0 ? `${errors.length} errores.` : ''}`,
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
    if (onProgress) onProgress(`Analizando elementos para mover de ${sourceDir} a ${destDir}...`);
    const pattern = (args.pattern as string || '*').toLowerCase();
    const extensions = args.extensions as string[] | undefined;

    await fs.mkdir(destDir, { recursive: true });
    const entries = await fs.readdir(sourceDir, { withFileTypes: true });

    if (onProgress) onProgress(`Iniciando movimiento de ${entries.length} elementos...`);
    const movedFiles: Array<{ name: string; from: string; to: string }> = [];
    const errors: string[] = [];

    let processedCount = 0;
    for (const entry of entries) {
      processedCount++;
      if (processedCount % 50 === 0 && onProgress) {
        onProgress(`Moviendo... procesados ${processedCount} de ${entries.length} archivos.`);
      }
      if (entry.isDirectory()) continue;

      const ext = getFileExtension(entry.name);
      const nameLC = entry.name.toLowerCase();

      if (extensions && extensions.length > 0) {
        if (!extensions.some(e => ext === e.toLowerCase().replace('.', ''))) continue;
      }
      if (pattern !== '*' && !nameLC.includes(pattern)) continue;

      const srcPath = path.join(sourceDir, entry.name);
      let dstPath = path.join(destDir, entry.name);

      try {
        try {
          await fs.access(dstPath);
          const base = path.basename(entry.name, path.extname(entry.name));
          const extWithDot = path.extname(entry.name);
          dstPath = path.join(destDir, `${base}_${Date.now()}${extWithDot}`);
        } catch { /* doesn't exist, proceed */ }
        await fs.rename(srcPath, dstPath);
        movedFiles.push({ name: entry.name, from: srcPath, to: dstPath });
      } catch (err: any) {
        errors.push(`${entry.name}: ${err.message}`);
      }
    }

    return {
      success: true,
      movedCount: movedFiles.length,
      errorCount: errors.length,
      moved: movedFiles.slice(0, 50),
      errors: errors.slice(0, 10),
      message: `Movidos ${movedFiles.length} archivos de ${path.basename(sourceDir)} a ${path.basename(destDir)}.`,
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
    if (onProgress) onProgress(`Generando resumen del directorio ${resolved}...`);
    const entries = await fs.readdir(resolved, { withFileTypes: true });

    const summary: Record<string, { count: number; totalSize: number; files: string[] }> = {};
    let totalFiles = 0;
    let totalDirs = 0;
    let totalSize = 0;

    let processedCount = 0;
    for (const entry of entries) {
      processedCount++;
      if (processedCount % 200 === 0 && onProgress) {
        onProgress(`Analizando para resumen... ${processedCount} de ${entries.length} elementos evaluados.`);
      }
      if (entry.isDirectory()) {
        totalDirs++;
        if (!summary['[Carpetas]']) summary['[Carpetas]'] = { count: 0, totalSize: 0, files: [] };
        summary['[Carpetas]'].count++;
        if (summary['[Carpetas]'].files.length < 10) summary['[Carpetas]'].files.push(entry.name);
        continue;
      }
      if (entry.name.startsWith('.')) continue;

      totalFiles++;
      const ext = getFileExtension(entry.name) || '[sin extensión]';
      const fullPath = path.join(resolved, entry.name);

      try {
        const stat = await fs.stat(fullPath);
        totalSize += stat.size;
        if (!summary[ext]) summary[ext] = { count: 0, totalSize: 0, files: [] };
        summary[ext].count++;
        summary[ext].totalSize += stat.size;
        if (summary[ext].files.length < 5) summary[ext].files.push(entry.name);
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
      totalFiles,
      totalDirectories: totalDirs,
      totalSize: formatBytes(totalSize),
      extensionSummary: sortedSummary,
      message: `${totalFiles} archivos y ${totalDirs} carpetas en ${path.basename(resolved)}. Extensiones: ${sortedSummary.filter(s => s.extension !== '[Carpetas]').map(s => `${s.extension}(${s.count})`).join(', ')}`,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
