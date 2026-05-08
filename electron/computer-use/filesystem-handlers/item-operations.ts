import { shell } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { formatBytes, getFileExtension, normalizePath } from '../../utils/file-utils';
import type { ProgressCallback } from './types';

export async function handleMoveItem(args: Record<string, any>, onProgress?: ProgressCallback): Promise<any> {
  try {
    const src = normalizePath(args.source_path);
    const dst = normalizePath(args.destination_path);
    onProgress?.(`Moviendo ${src} a ${dst}...`);
    try {
      await fs.rename(src, dst);
    } catch (err: any) {
      if (err.code !== 'ENOENT') throw err;
      await fs.mkdir(path.dirname(dst), { recursive: true });
      await fs.rename(src, dst);
    }
    return { success: true, from: src, to: dst, message: `Movido: ${path.basename(src)} -> ${path.basename(dst)}` };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
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
