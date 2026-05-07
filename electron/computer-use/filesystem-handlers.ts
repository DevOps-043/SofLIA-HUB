/**
 * Handlers de operaciones de filesystem para `executeToolDirect`.
 *
 * Cada función maneja una tool específica de Computer Use, devolviendo el
 * mismo formato de respuesta que el dispatcher original esperaba:
 * `{ success: true, ... }` o `{ success: false, error }`.
 *
 * Las operaciones batch (`organize_files`, `batch_move_files`, etc.) viven
 * en `./batch-file-ops.ts` — aquí solo cubrimos las operaciones unitarias.
 */

import { shell } from 'electron';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { formatBytes, getFileExtension, normalizePath } from '../utils/file-utils';

const MAX_FILE_READ_SIZE = 1 * 1024 * 1024; // 1 MB
const MAX_SEARCH_RESULTS = 200;
const MAX_SEARCH_DEPTH = 8;

const SEARCH_SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'AppData',
  '$Recycle.Bin',
  'dist',
  'dist-electron',
]);

type ProgressCallback = (message: string) => void;

interface DirectoryItem {
  name: string;
  path: string;
  isDirectory: boolean;
  size: string | null;
  sizeBytes: number;
  extension: string | null;
  modified: string | null;
  created: string | null;
}

/**
 * Lista contenidos de un directorio con metadata (size, fechas, ext).
 * Reporta progreso cada 100 items para directorios grandes.
 */
export async function handleListDirectory(
  args: Record<string, any>,
  onProgress?: ProgressCallback,
): Promise<any> {
  try {
    const resolved = normalizePath(args.path || os.homedir());
    onProgress?.(`Listando directorio: ${resolved}...`);
    const entries = await fs.readdir(resolved, { withFileTypes: true });
    const showHidden = args.show_hidden || false;

    if (entries.length > 100) {
      onProgress?.(`Analizando detalles de ${entries.length} elementos...`);
    }

    let processedCount = 0;
    const items: DirectoryItem[] = await Promise.all(
      entries
        .filter((e) => showHidden || !e.name.startsWith('.'))
        .map(async (entry) => {
          processedCount += 1;
          if (processedCount % 100 === 0) {
            onProgress?.(`Leyendo detalles... ${processedCount} de ${entries.length} archivos procesados.`);
          }
          const fullPath = path.join(resolved, entry.name);
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
            // stat() falla en algunos archivos del sistema (permisos, links muertos).
            // Devolvemos entry parcial en lugar de abortar todo el listado.
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
        }),
    );

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

/**
 * Lee un archivo de texto. Maneja `.docx` con extracción via mammoth.
 * Rechaza archivos > 1 MB para evitar consumir memoria del proceso main.
 */
export async function handleReadFile(args: Record<string, any>): Promise<any> {
  try {
    const resolved = normalizePath(args.path);
    const stat = await fs.stat(resolved);
    if (stat.isDirectory()) {
      return { success: false, error: 'La ruta es un directorio, no un archivo.' };
    }
    if (stat.size > MAX_FILE_READ_SIZE) {
      return {
        success: false,
        error: `Archivo demasiado grande (${formatBytes(stat.size)}). Máximo: ${formatBytes(MAX_FILE_READ_SIZE)}.`,
      };
    }

    const ext = getFileExtension(resolved);

    if (ext === 'docx') {
      try {
        const mammoth = await import('mammoth');
        const buffer = await fs.readFile(resolved);
        const result = await mammoth.extractRawText({ buffer });
        return {
          success: true,
          path: resolved,
          content: result.value,
          size: formatBytes(stat.size),
          extension: ext,
          format: 'docx (texto extraído)',
        };
      } catch (docxErr: any) {
        return { success: false, error: `Error al leer archivo .docx: ${docxErr.message}` };
      }
    }

    const content = await fs.readFile(resolved, 'utf-8');
    return { success: true, path: resolved, content, size: formatBytes(stat.size), extension: ext };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function handleWriteFile(
  args: Record<string, any>,
  onProgress?: ProgressCallback,
): Promise<any> {
  try {
    const resolved = normalizePath(args.path);
    onProgress?.(`Escribiendo archivo: ${resolved}...`);
    // Asegurar que el directorio destino exista para que el write no falle.
    await fs.mkdir(path.dirname(resolved), { recursive: true });
    await fs.writeFile(resolved, args.content, 'utf-8');
    return {
      success: true,
      path: resolved,
      message: `Archivo creado/actualizado: ${path.basename(resolved)}`,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function handleCreateDirectory(args: Record<string, any>): Promise<any> {
  try {
    const resolved = normalizePath(args.path);
    try {
      await fs.mkdir(resolved, { recursive: true });
    } catch (err: any) {
      // EEXIST es éxito idempotente — el caller pidió que existiera, ya existe.
      if (err.code === 'EEXIST') {
        return {
          success: true,
          path: resolved,
          message: `La carpeta ya existe: ${path.basename(resolved)}`,
        };
      }
      throw err;
    }
    return { success: true, path: resolved, message: `Carpeta creada: ${path.basename(resolved)}` };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function handleMoveItem(
  args: Record<string, any>,
  onProgress?: ProgressCallback,
): Promise<any> {
  try {
    const src = normalizePath(args.source_path);
    const dst = normalizePath(args.destination_path);
    onProgress?.(`Moviendo ${src} a ${dst}...`);
    try {
      await fs.rename(src, dst);
    } catch (err: any) {
      // Si el directorio destino no existe, lo creamos y reintentamos.
      if (err.code === 'ENOENT') {
        await fs.mkdir(path.dirname(dst), { recursive: true });
        await fs.rename(src, dst);
      } else {
        throw err;
      }
    }
    return {
      success: true,
      from: src,
      to: dst,
      message: `Movido: ${path.basename(src)} → ${path.basename(dst)}`,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function handleCopyItem(
  args: Record<string, any>,
  onProgress?: ProgressCallback,
): Promise<any> {
  try {
    const src = normalizePath(args.source_path);
    const dst = normalizePath(args.destination_path);
    onProgress?.(`Copiando de ${src} a ${dst}...`);
    const stat = await fs.stat(src);
    if (stat.isDirectory()) {
      await fs.cp(src, dst, { recursive: true });
    } else {
      await fs.mkdir(path.dirname(dst), { recursive: true });
      await fs.copyFile(src, dst);
    }
    return { success: true, from: src, to: dst, message: `Copiado: ${path.basename(src)}` };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Manda un archivo a la papelera del SO. Reversible por el usuario desde la
 * papelera del sistema. Para borrado permanente se usa execute_command.
 */
export async function handleDeleteItem(
  args: Record<string, any>,
  onProgress?: ProgressCallback,
): Promise<any> {
  try {
    const resolved = normalizePath(args.path);
    onProgress?.(`Enviando a la papelera: ${resolved}...`);
    await shell.trashItem(resolved);
    return {
      success: true,
      path: resolved,
      message: `Enviado a papelera: ${path.basename(resolved)}`,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function handleGetFileInfo(args: Record<string, any>): Promise<any> {
  try {
    const resolved = normalizePath(args.path);
    const stat = await fs.stat(resolved);
    return {
      success: true,
      path: resolved,
      name: path.basename(resolved),
      isDirectory: stat.isDirectory(),
      size: formatBytes(stat.size),
      sizeBytes: stat.size,
      extension: stat.isDirectory() ? null : getFileExtension(resolved),
      created: stat.birthtime.toISOString(),
      modified: stat.mtime.toISOString(),
      accessed: stat.atime.toISOString(),
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

interface SearchHit {
  name: string;
  path: string;
  isDirectory: boolean;
}

/**
 * Búsqueda recursiva por nombre con cap de profundidad y resultados.
 * Skipea directorios "ruidosos" (node_modules, .git, AppData) que harían
 * la búsqueda demasiado lenta y poco útil.
 */
export async function handleSearchFiles(
  args: Record<string, any>,
  onProgress?: ProgressCallback,
): Promise<any> {
  try {
    const resolved = normalizePath(args.directory || os.homedir());
    onProgress?.(`Iniciando búsqueda en ${resolved}...`);
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
        // Permisos denegados o link muerto: skip silencioso, sigue con el siguiente dir.
      }
    }

    await walk(resolved, 0);
    return {
      success: true,
      pattern: args.pattern,
      searchPath: resolved,
      results,
      count: results.length,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
