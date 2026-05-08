import fs from 'node:fs/promises';
import path from 'node:path';
import { formatBytes, getFileExtension, normalizePath } from '../../utils/file-utils';
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
