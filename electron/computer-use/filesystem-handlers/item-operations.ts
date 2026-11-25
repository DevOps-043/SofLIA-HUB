import { shell } from 'electron';
import fs from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { formatBytes, getFileExtension, normalizePath } from '../../utils/file-utils';
import type { ProgressCallback } from './types';

export async function handleMoveItem(args: Record<string, any>, onProgress?: ProgressCallback): Promise<any> {
  try {
    const src = normalizePath(args.source_path);
    const dst = normalizePath(args.destination_path);
    onProgress?.(`Moviendo ${src} a ${dst}...`);
    if (args.no_overwrite === true) return await moveFileWithoutOverwrite(src, dst);
    try {
      await fs.rename(src, dst);
    } catch (err: any) {
      if (err.code !== 'ENOENT') throw err;
      await fs.mkdir(path.dirname(dst), { recursive: true });
      await fs.rename(src, dst);
    }
    return { success: true, from: src, to: dst, message: `Movido: ${path.basename(src)} -> ${path.basename(dst)}` };
  } catch (err: any) {
    if (args.no_overwrite === true && err.code === 'EEXIST') {
      return { success: false, code: 'DESTINATION_EXISTS', error: 'El destino ya existe. El archivo de origen se conservó.' };
    }
    return { success: false, error: err.message };
  }
}

async function moveFileWithoutOverwrite(src: string, dst: string) {
  const source = await fs.lstat(src);
  // Enlaces, directorios y destinos de red quedan fuera de la operación ordinaria.
  const parents = await Promise.all([fs.realpath(path.dirname(src)), fs.realpath(path.dirname(dst))]);
  if (!source.isFile() || parents.some(parent => /^[\\/]{2}/.test(parent))) {
    return { success: false, error: 'El movimiento sin sobrescritura requiere un archivo local y una carpeta local existente.' };
  }
  const origin = path.join(parents[0], path.basename(src));
  const target = path.join(parents[1], path.basename(dst));
  try { await fs.link(origin, target); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EXDEV') throw error;
    await fs.copyFile(origin, target, constants.COPYFILE_EXCL);
  }
  const current = await fs.lstat(origin);
  if (!current.isFile() || current.dev !== source.dev || current.ino !== source.ino || current.mtimeMs !== source.mtimeMs || current.size !== source.size) {
    return { success: false, error: 'El archivo de origen cambió durante el movimiento. Comprueba ambas rutas antes de volver a intentarlo.' };
  }
  await fs.unlink(origin);
  return { success: true, from: origin, to: target, message: `Movido: ${path.basename(target)}` };
}

export async function handleCopyItem(args: Record<string, any>, onProgress?: ProgressCallback): Promise<any> {
  try {
    const src = normalizePath(args.source_path);
    const dst = normalizePath(args.destination_path);
    onProgress?.(`Copiando de ${src} a ${dst}...`);
    const stat = await fs.stat(src);
    if (stat.isDirectory()) await fs.cp(src, dst, { recursive: true });
    else {
      await fs.mkdir(path.dirname(dst), { recursive: true });
      await fs.copyFile(src, dst);
    }
    return { success: true, from: src, to: dst, message: `Copiado: ${path.basename(src)}` };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function handleDeleteItem(args: Record<string, any>, onProgress?: ProgressCallback): Promise<any> {
  try {
    const resolved = normalizePath(args.path);
    onProgress?.(`Enviando a la papelera: ${resolved}...`);
    await shell.trashItem(resolved);
    return { success: true, path: resolved, message: `Enviado a papelera: ${path.basename(resolved)}` };
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
