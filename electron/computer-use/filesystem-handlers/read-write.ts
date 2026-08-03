import fs from 'node:fs/promises';
import path from 'node:path';
import { formatBytes, getFileExtension, normalizePath } from '../../utils/file-utils';
import { isSidecarDocument, pythonToolsService } from '../../python-tools-service';
import { MAX_FILE_READ_SIZE } from './constants';
import type { ProgressCallback } from './types';

export async function handleReadFile(args: Record<string, any>): Promise<any> {
  try {
    const resolved = normalizePath(args.path);
    const stat = await fs.stat(resolved);
    if (stat.isDirectory()) return { success: false, error: 'La ruta es un directorio, no un archivo.' };
    if (stat.size > MAX_FILE_READ_SIZE) {
      return {
        success: false,
        error: `Archivo demasiado grande (${formatBytes(stat.size)}). Maximo: ${formatBytes(MAX_FILE_READ_SIZE)}.`,
      };
    }

    const ext = getFileExtension(resolved);

    // Documentos (PDF, Excel, PowerPoint, Word): los lee el sidecar Python y
    // devuelve Markdown + tablas estructuradas. Antes un PDF se leia como
    // utf-8 (binario ilegible) y el unico camino era subirlo entero a Gemini.
    if (isSidecarDocument(resolved)) {
      const parsed = await readDocumentWithSidecar(resolved, ext, stat.size);
      // El .docx tiene respaldo en TypeScript (mammoth): si el sidecar no esta
      // disponible se conserva el comportamiento anterior en vez de fallar.
      if (parsed || ext !== 'docx') return parsed ?? sidecarUnavailableError(ext);
    }

    if (ext === 'docx') {
      try {
        const mammoth = await import('mammoth');
        const buffer = await fs.readFile(resolved);
        const result = await mammoth.extractRawText({ buffer });
        return { success: true, path: resolved, content: result.value, size: formatBytes(stat.size), extension: ext, format: 'docx (texto extraido)' };
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

/** Devuelve el documento como Markdown, o null si el sidecar no esta disponible. */
async function readDocumentWithSidecar(resolved: string, ext: string, size: number): Promise<any | null> {
  if (!pythonToolsService.isAvailable()) return null;

  const result = await pythonToolsService.parseDocument(resolved);
  if (result.success) {
    return {
      success: true,
      path: resolved,
      content: result.data.markdown,
      tables: result.data.tables,
      size: formatBytes(size),
      extension: ext,
      format: `${ext} (convertido a Markdown, ${result.data.tables.length} tabla(s))`,
    };
  }
  // El sidecar existe pero no pudo leerlo (cifrado, escaneado, corrupto): se
  // devuelve el motivo real, que es accionable para el usuario y el agente.
  if (result.error.code === 'SIDECAR_UNAVAILABLE') return null;
  return { success: false, error: result.error.message, code: result.error.code };
}

function sidecarUnavailableError(ext: string): any {
  return {
    success: false,
    error: `Para leer archivos .${ext} hace falta el runtime Python de Pulse. Ejecuta "npm run python:setup" (desarrollo) o reinstala la app.`,
    code: 'SIDECAR_UNAVAILABLE',
  };
}

export async function handleWriteFile(
  args: Record<string, any>,
  onProgress?: ProgressCallback,
): Promise<any> {
  try {
    const resolved = normalizePath(args.path);
    onProgress?.(`Escribiendo archivo: ${resolved}...`);
    await fs.mkdir(path.dirname(resolved), { recursive: true });
    await fs.writeFile(resolved, args.content, 'utf-8');
    return { success: true, path: resolved, message: `Archivo creado/actualizado: ${path.basename(resolved)}` };
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
      if (err.code === 'EEXIST') {
        return { success: true, path: resolved, message: `La carpeta ya existe: ${path.basename(resolved)}` };
      }
      throw err;
    }
    return { success: true, path: resolved, message: `Carpeta creada: ${path.basename(resolved)}` };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
